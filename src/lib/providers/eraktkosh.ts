/**
 * eRaktKosh adapter.
 *
 * eRaktKosh (eraktkosh.mohfw.gov.in) is the Government of India's national
 * blood-bank inventory, directory, nearby-search and rare-group registry
 * portal. It does NOT publish a documented open API, so this adapter:
 *
 *   • stays inert unless `ERAKTKOSH_BASE_URL` is configured, and
 *   • is the ONLY file that knows the upstream payload shape.
 *
 * If/when official API access is granted, wire the endpoints here — nothing
 * outside this file changes. Do not scrape the portal as the core architecture.
 */

import type { BloodBank, BloodComponent, BloodGroup, GeoPoint, InventoryRecord } from "@/lib/types";
import { getDb, nowIso } from "@/lib/db";
import { mapBank } from "./local";
import type { BloodDataProvider, ProviderAvailabilityQuery, ProviderResult } from "./types";

const TIMEOUT_MS = 8_000;
const RETRIES = 1;

interface EraktKoshConfig {
  baseUrl: string;
}

function config(): EraktKoshConfig | null {
  const baseUrl = process.env.ERAKTKOSH_BASE_URL?.trim();
  if (!baseUrl) return null;
  return { baseUrl: baseUrl.replace(/\/$/, "") };
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { accept: "application/json", ...(init?.headers ?? {}) },
        // Respectful client: no bulk harvesting, one page per call.
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`eRaktKosh responded ${res.status}`);
      return (await res.json()) as unknown;
    } catch (err) {
      lastError = err;
      if (attempt < RETRIES) await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw lastError;
}

/** Upstream → RARELINK inventory mapping. The only place that shape is known. */
function toInventory(raw: unknown, bankId: string): InventoryRecord[] {
  if (!raw || typeof raw !== "object") return [];
  const rows = Array.isArray(raw)
    ? raw
    : ((raw as { data?: unknown }).data as unknown[] | undefined) ?? [];
  const out: InventoryRecord[] = [];
  for (const entry of rows) {
    if (!entry || typeof entry !== "object") continue;
    const r = entry as Record<string, unknown>;
    const group = String(r.bloodGroup ?? r.blood_group ?? "") as BloodGroup;
    const component = String(r.component ?? r.componentName ?? "PRBC") as BloodComponent;
    if (!group) continue;
    out.push({
      id: `erkt_${bankId}_${component}_${group}`,
      bloodBankId: bankId,
      bloodGroup: group,
      component,
      unitsAvailable: Number(r.unitsAvailable ?? r.units ?? 0),
      availabilityStatus: (String(
        r.availabilityStatus ?? r.status ?? "UNKNOWN",
      ).toUpperCase() as InventoryRecord["availabilityStatus"]),
      lastUpdatedAt: String(r.lastUpdated ?? r.last_updated ?? nowIso()),
      source: "eRaktKosh",
      sourceRecordId: r.id ? String(r.id) : null,
    });
  }
  return out;
}

function empty<T>(source: string, error?: string): ProviderResult<T> {
  return {
    ok: false,
    source,
    records: [],
    fetchedAt: nowIso(),
    error: error ?? "eRaktKosh is not configured",
  };
}

export const eraktkoshProvider: BloodDataProvider = {
  id: "eraktkosh",
  name: "eRaktKosh",
  kind: "official",
  attribution: "Government of India — eRaktKosh",
  isLive: () => config() !== null,

  async searchBlood(
    query: ProviderAvailabilityQuery & { near?: GeoPoint; radiusKm?: number },
  ): Promise<ProviderResult<InventoryRecord>> {
    const cfg = config();
    if (!cfg) return empty("eRaktKosh");
    try {
      const params = new URLSearchParams();
      if (query.bloodGroup) params.set("bloodGroup", query.bloodGroup);
      if (query.component) params.set("component", query.component);
      if (query.near) {
        params.set("lat", String(query.near.latitude));
        params.set("lon", String(query.near.longitude));
        params.set("radiusKm", String(query.radiusKm ?? 25));
      }
      const raw = await fetchJson(`${cfg.baseUrl}/api/blood/search?${params}`);
      return {
        ok: true,
        source: "eRaktKosh",
        fetchedAt: nowIso(),
        records: toInventory(raw, "eraktkosh"),
      };
    } catch (err) {
      return empty("eRaktKosh", err instanceof Error ? err.message : "Request failed");
    }
  },

  async getBloodBank(id: string): Promise<ProviderResult<BloodBank>> {
    const cfg = config();
    if (!cfg) return empty("eRaktKosh");
    try {
      const raw = await fetchJson(`${cfg.baseUrl}/api/blood-banks/${encodeURIComponent(id)}`);
      const row = raw as Record<string, unknown>;
      if (!row || typeof row !== "object") return empty("eRaktKosh", "Not found");
      // Directory rows are normalised into the local schema on import.
      const local = getDb()
        .prepare("SELECT * FROM blood_banks WHERE source_id = ? AND source = 'eRaktKosh'")
        .get(id) as Record<string, string | number> | undefined;
      if (local) return { ok: true, source: "eRaktKosh", records: [mapBank(local)], fetchedAt: nowIso() };
      return empty("eRaktKosh", "Directory row not imported yet");
    } catch (err) {
      return empty("eRaktKosh", err instanceof Error ? err.message : "Request failed");
    }
  },

  async getBloodAvailability(bloodBankId: string): Promise<ProviderResult<InventoryRecord>> {
    return this.searchBlood({ bloodGroup: null, component: null }).then((r) => ({
      ...r,
      records: r.records.filter((rec) => rec.bloodBankId === bloodBankId),
    }));
  },

  async getNearbyBloodBanks(
    _point: GeoPoint,
    _radiusKm: number,
  ): Promise<ProviderResult<BloodBank>> {
    return empty("eRaktKosh", "Nearby search requires official API access");
  },
};
