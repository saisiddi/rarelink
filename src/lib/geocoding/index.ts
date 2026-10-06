/**
 * Geocoding provider abstraction.
 *
 * The public Nominatim instance must not be used for generic/high-volume
 * search — its usage policy is explicit about that. Default is the bundled
 * gazetteer; set `GEOCODING_PROVIDER=nominatim` + `NOMINATIM_BASE_URL` to
 * point at your own instance. Results are cached either way.
 */

import type { GeoPoint } from "@/lib/types";
import { resolvePlace } from "@/lib/geo/places";

export interface GeocodeResult extends GeoPoint {
  name: string;
  state: string;
  source: string;
}

export interface GeocodingProvider {
  id: string;
  name: string;
  geocode(query: string): Promise<GeocodeResult | null>;
  reverse(point: GeoPoint): Promise<string | null>;
}

// --- in-memory TTL cache (shared by all providers) -------------------------

interface CacheEntry<T> {
  value: T;
  expires: number;
}
const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 30 * 60_000;

function cached<T>(key: string, compute: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return Promise.resolve(hit.value as T);
  return compute().then((value) => {
    cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
    return value;
  });
}

// --- local gazetteer --------------------------------------------------------

export const localGeocoder: GeocodingProvider = {
  id: "local",
  name: "Bundled gazetteer",
  async geocode(query: string) {
    return cached(`g:${query.toLowerCase()}`, async () => {
      const place = resolvePlace(query);
      if (!place) return null;
      return {
        name: place.name,
        state: place.state,
        latitude: place.latitude,
        longitude: place.longitude,
        source: "local",
      } satisfies GeocodeResult;
    });
  },
  async reverse(point: GeoPoint) {
    return cached(`r:${point.latitude.toFixed(3)},${point.longitude.toFixed(3)}`, async () => {
      // Nearest gazetteer entry — good enough for "approximate location" labels.
      let best: { name: string; d: number } | null = null;
      const { PLACES } = await import("@/lib/geo/places");
      for (const p of PLACES) {
        const d =
          (p.latitude - point.latitude) ** 2 + (p.longitude - point.longitude) ** 2;
        if (!best || d < best.d) best = { name: p.name, d };
      }
      return best?.name ?? null;
    });
  },
};

// --- self-hosted / Nominatim-compatible ------------------------------------

let lastNominatimCall = 0;
const NOMINATIM_MIN_INTERVAL_MS = 1_100; // ≤1 request/second, per policy

export const nominatimGeocoder: GeocodingProvider = {
  id: "nominatim",
  name: "Nominatim (self-hosted)",
  async geocode(query: string) {
    const base = process.env.NOMINATIM_BASE_URL?.trim();
    if (!base) return localGeocoder.geocode(query);

    return cached(`n:${query.toLowerCase()}`, async () => {
      const wait = NOMINATIM_MIN_INTERVAL_MS - (Date.now() - lastNominatimCall);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      lastNominatimCall = Date.now();

      const url = new URL("/search", base.replace(/\/$/, ""));
      url.searchParams.set("q", query);
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("limit", "1");
      url.searchParams.set("countrycodes", "in");

      const res = await fetch(url, {
        signal: AbortSignal.timeout(6_000),
        headers: {
          "user-agent":
            process.env.NOMINATIM_USER_AGENT || "RARELINK/0.1 (contact: admin@example.com)",
        },
      });
      if (!res.ok) throw new Error(`Geocoder responded ${res.status}`);
      const rows = (await res.json()) as Array<{
        lat: string;
        lon: string;
        display_name: string;
      }>;
      const first = rows[0];
      if (!first) return null;
      return {
        name: first.display_name.split(",")[0]?.trim() ?? query,
        state: "",
        latitude: Number(first.lat),
        longitude: Number(first.lon),
        source: "nominatim",
      } satisfies GeocodeResult;
    });
  },
  async reverse(point: GeoPoint) {
    const base = process.env.NOMINATIM_BASE_URL?.trim();
    if (!base) return localGeocoder.reverse(point);
    return cached(`nr:${point.latitude.toFixed(3)},${point.longitude.toFixed(3)}`, async () => {
      const url = new URL("/reverse", base.replace(/\/$/, ""));
      url.searchParams.set("lat", String(point.latitude));
      url.searchParams.set("lon", String(point.longitude));
      url.searchParams.set("format", "jsonv2");
      const res = await fetch(url, {
        signal: AbortSignal.timeout(6_000),
        headers: {
          "user-agent":
            process.env.NOMINATIM_USER_AGENT || "RARELINK/0.1 (contact: admin@example.com)",
        },
      });
      if (!res.ok) return null;
      const row = (await res.json()) as { display_name?: string };
      return row.display_name ?? null;
    });
  },
};

export function getGeocoder(): GeocodingProvider {
  return process.env.GEOCODING_PROVIDER === "nominatim" ? nominatimGeocoder : localGeocoder;
}
