"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Crosshair,
  Loader2,
  Map as MapIcon,
  SlidersHorizontal,
  List,
  Siren,
} from "lucide-react";

import type { SearchResult } from "@/lib/types";
import { cn } from "@/lib/cn";
import { ResultCard, EmptyState } from "@/components/ResultCard";
import { SafetyBanner, NoticeList } from "@/components/Banners";
import MapPanel, { type MapPoint } from "@/components/MapPanel";
import { ButtonLink } from "@/components/ui";

interface SearchState {
  query: {
    bloodGroup: string | null;
    component: string | null;
    city: string | null;
    radiusKm: number;
    urgency: string;
    intent: string;
  };
  city: string | null;
  point: { latitude: number; longitude: number } | null;
  bloodBanks: SearchResult[];
  donors: SearchResult[];
  notices: string[];
  safety: string[];
  searchedAt: string;
  tookMs: number;
}

const GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "OH"];
const COMPONENTS = ["PRBC", "PLATELETS", "FFP", "WHOLE_BLOOD", "SDP", "CRYO"];

export function SearchExplorer({
  initial,
  mode = "search",
}: {
  initial: {
    bloodGroup?: string;
    component?: string;
    city?: string;
    lat?: string;
    lon?: string;
    radius?: string;
    urgency?: string;
    intent?: string;
  };
  mode?: "search" | "map";
}) {
  const [group, setGroup] = useState(initial.bloodGroup ?? "");
  const [component, setComponent] = useState(initial.component ?? "");
  const [city, setCity] = useState(initial.city ?? "");
  const [radius, setRadius] = useState(Number(initial.radius ?? 50) || 50);
  const [urgency, setUrgency] = useState(initial.urgency ?? "routine");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [only24x7, setOnly24x7] = useState(false);
  const [query, setQuery] = useState<SearchState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [panel, setPanel] = useState<"list" | "map">(mode === "map" ? "map" : "list");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [geo, setGeo] = useState<{ latitude: number; longitude: number } | null>(
    initial.lat && initial.lon
      ? { latitude: Number(initial.lat), longitude: Number(initial.lon) }
      : null,
  );
  const listRef = useRef<HTMLDivElement | null>(null);
  // Unique ids so the visible field labels actually associate with their inputs.
  const uid = useId();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("intent", initial.intent ?? (group ? "find_blood" : "find_blood_bank"));
      if (group) params.set("bloodGroup", group);
      if (component) params.set("component", component);
      if (geo) {
        params.set("lat", String(geo.latitude));
        params.set("lon", String(geo.longitude));
      } else if (city) {
        params.set("city", city);
      }
      params.set("radius", String(radius));
      params.set("urgency", urgency);

      const res = await fetch(`/api/blood/search?${params.toString()}`);
      if (!res.ok) throw new Error(`Search failed (${res.status})`);
      const data = (await res.json()) as SearchState;
      setQuery(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, [group, component, city, radius, urgency, geo, initial.intent]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 220);
    return () => window.clearTimeout(t);
  }, [load]);

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setCity("");
      },
      () => setError("Location permission denied — enter a city instead."),
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 300_000 },
    );
  }

  const banks = useMemo(() => {
    const rows = query?.bloodBanks ?? [];
    return rows.filter((r) => {
      if (verifiedOnly && !r.verified) return false;
      if (only24x7 && !r.emergency24x7) return false;
      return true;
    });
  }, [query, verifiedOnly, only24x7]);

  const donors = useMemo(() => query?.donors ?? [], [query]);

  const points = useMemo<MapPoint[]>(() => {
    const out: MapPoint[] = [];
    for (const b of banks) {
      if (!b.coordinates) continue;
      out.push({
        id: b.key ?? b.id,
        latitude: b.coordinates.latitude,
        longitude: b.coordinates.longitude,
        kind: "blood_bank",
        label: b.title,
        detail: [b.bloodGroup, b.availabilityStatus, b.distanceKm !== null ? `${b.distanceKm.toFixed(1)} km` : null]
          .filter(Boolean)
          .join(" · "),
      });
    }
    for (const d of donors) {
      if (!d.coordinates) continue;
      out.push({
        id: d.key ?? d.id,
        latitude: d.coordinates.latitude,
        longitude: d.coordinates.longitude,
        kind: "donor",
        label: d.title,
        detail: d.distanceKm !== null ? `${d.distanceKm.toFixed(1)} km` : null,
      });
    }
    return out;
  }, [banks, donors]);

  const center = query?.point ?? null;

  const filterPanel = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-mute">Filters</h2>
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className="rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-ink-soft lg:hidden"
          aria-expanded={filtersOpen}
        >
          <SlidersHorizontal className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
          {filtersOpen ? "Hide" : "Show"}
        </button>
      </div>

      <div className={cn("space-y-4", filtersOpen ? "block" : "hidden lg:block")}>
        <Field label="Blood group">
          <div className="flex flex-wrap gap-1.5">
            {GROUPS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGroup(group === g ? "" : g)}
                className={cn(
                  "h-9 min-w-11 rounded-lg border px-2 text-xs font-bold transition",
                  group === g
                    ? "border-brand bg-brand text-white"
                    : g === "OH"
                      ? "border-brand/40 bg-brand-soft text-brand"
                      : "border-line bg-white text-ink-soft hover:border-ink-mute",
                )}
                aria-pressed={group === g}
              >
                {g === "OH" ? "Oh" : g}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Component">
          <div className="flex flex-wrap gap-1.5">
            {COMPONENTS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setComponent(component === c ? "" : c)}
                className={cn(
                  "h-9 rounded-lg border px-2.5 text-xs font-semibold transition",
                  component === c
                    ? "border-navy bg-navy text-white"
                    : "border-line bg-white text-ink-soft hover:border-ink-mute",
                )}
                aria-pressed={component === c}
              >
                {c.replace("_", " ")}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Location" htmlFor={`${uid}-city`}>
          <div className="flex gap-2">
            <input
              id={`${uid}-city`}
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setGeo(null);
              }}
              placeholder="City or area, e.g. Bengaluru"
              className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-brand"
            />
            <button
              type="button"
              onClick={useMyLocation}
              title="Use my location"
              aria-label="Use my location"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-line bg-white text-ink-soft hover:border-brand hover:text-brand"
            >
              <Crosshair className="h-4 w-4" />
            </button>
          </div>
          {geo ? <p className="mt-1.5 text-xs text-ink-mute">Using your current location</p> : null}
        </Field>

        <Field label={`Radius — ${radius} km`} htmlFor={`${uid}-radius`}>
          <input
            id={`${uid}-radius`}
            type="range"
            min={5}
            max={200}
            step={5}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="w-full accent-[var(--color-brand)]"
          />
        </Field>

        <Field label="Priority">
          <div className="flex gap-1.5">
            {["routine", "urgent", "emergency"].map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUrgency(u)}
                className={cn(
                  "h-9 flex-1 rounded-lg border px-2 text-xs font-semibold capitalize transition",
                  urgency === u
                    ? u === "emergency"
                      ? "border-brand bg-brand text-white"
                      : "border-navy bg-navy text-white"
                    : "border-line bg-white text-ink-soft",
                )}
                aria-pressed={urgency === u}
              >
                {u}
              </button>
            ))}
          </div>
        </Field>

        <div className="space-y-2 border-t border-line pt-3">
          <Toggle checked={verifiedOnly} onChange={setVerifiedOnly} label="Verified only" />
          <Toggle checked={only24x7} onChange={setOnly24x7} label="Open 24×7" />
        </div>

        <div className="flex flex-wrap gap-2 border-t border-line pt-3">
          <button
            type="button"
            onClick={() => {
              setGroup("");
              setComponent("");
              setCity("");
              setGeo(null);
              setRadius(50);
              setUrgency("routine");
              setVerifiedOnly(false);
              setOnly24x7(false);
            }}
            className="h-9 rounded-lg border border-line px-3 text-xs font-semibold text-ink-soft hover:border-ink-mute"
          >
            Reset filters
          </button>
          <ButtonLink href="/emergency" size="sm" variant="primary">
            <Siren className="h-3.5 w-3.5" aria-hidden="true" /> Emergency
          </ButtonLink>
        </div>
      </div>
    </div>
  );

  const results = (
    <div ref={listRef} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-ink">
            {group ? `${group === "OH" ? "Bombay (Oh)" : group} results` : "Blood banks"}
            {query?.city ? ` in ${query.city}` : ""}
          </h2>
          <p className="text-sm text-ink-soft">
            {banks.length} blood bank{banks.length === 1 ? "" : "s"}
            {donors.length > 0 ? ` · ${donors.length} donor${donors.length === 1 ? "" : "s"}` : ""}
            {query ? ` · ranked in ${query.tookMs} ms` : ""}
          </p>
        </div>
        <div className="flex gap-1.5 rounded-xl border border-line bg-white p-1 lg:hidden">
          <button
            type="button"
            onClick={() => setPanel("list")}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold",
              panel === "list" ? "bg-navy text-white" : "text-ink-soft",
            )}
          >
            <List className="h-3.5 w-3.5" aria-hidden="true" /> List
          </button>
          <button
            type="button"
            onClick={() => setPanel("map")}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold",
              panel === "map" ? "bg-navy text-white" : "text-ink-soft",
            )}
          >
            <MapIcon className="h-3.5 w-3.5" aria-hidden="true" /> Map
          </button>
        </div>
      </div>

      {query && query.safety.length > 0 ? <SafetyBanner lines={query.safety.slice(0, 2)} /> : null}
      {query && query.notices.length > 0 ? <NoticeList notices={query.notices} /> : null}
      {error ? (
        <div role="alert" className="rounded-2xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
          <strong className="font-semibold">Live inventory is temporarily unavailable.</strong>{" "}
          Showing the verified directory below. {error}
        </div>
      ) : null}

      {loading && !query ? (
        <div className="card grid place-items-center gap-2 p-10 text-ink-mute">
          <Loader2 className="h-5 w-5 animate-spin" />
          Searching verified sources…
        </div>
      ) : null}

      <ul className="grid grid-cols-1 gap-3">
        {banks.map((r, i) => (
          <ResultCard
            key={r.key ?? r.id}
            result={r}
            index={i}
            emergency={urgency === "emergency"}
            onTrack={(e) => void fetch("/api/analytics", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ event: e }),
            }).catch(() => undefined)}
          />
        ))}
        {donors.map((r, i) => (
          <ResultCard key={r.key ?? r.id} result={r} index={banks.length + i} />
        ))}
        {!loading && banks.length === 0 && donors.length === 0 ? (
          <EmptyState
            title="No results for these filters"
            body="Try a wider radius, another city, a different component, or searching a compatible group — the compatibility engine will suggest alternatives."
            action={
              <button
                type="button"
                onClick={() => {
                  setGroup("");
                  setComponent("");
                  setRadius(100);
                }}
                className="mt-2 h-10 rounded-xl bg-navy px-4 text-sm font-semibold text-white"
              >
                Widen the search
              </button>
            }
          />
        ) : null}
      </ul>
    </div>
  );

  // The page owns the outer max-width and gutters — this only lays out the
  // filter rail against the results. `grid-cols-1` is load-bearing: without it
  // the implicit single column is `minmax(auto, 1fr)` and a wide result card
  // stretches the track past the viewport on mobile.
  return (
    <div className="grid grid-cols-1 gap-5 pb-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="card h-max p-4 lg:sticky lg:top-20">{filterPanel}</aside>

      <section className={cn("min-w-0", panel === "map" ? "hidden lg:block" : "")}>
        {results}
      </section>

      <section
        className={cn(
          "min-w-0 lg:col-start-2 lg:row-start-1",
          panel === "list" ? "hidden lg:block" : "",
        )}
        aria-label="Map"
      >
        <div className="card h-[70vh] min-h-[420px] overflow-hidden p-1.5 lg:sticky lg:top-20">
          <MapPanel
            points={points}
            selectedId={selected}
            onSelect={(id) => {
              setSelected(id);
              setPanel("list");
              window.setTimeout(() => {
                const el = listRef.current?.querySelector(`[data-id="${id}"]`);
                el?.scrollIntoView({ behavior: "smooth", block: "center" });
              }, 60);
            }}
            className="h-full"
          />
        </div>
        {center ? (
          <p className="mt-2 px-1 text-xs text-ink-mute">
            Map centred on {center.latitude.toFixed(3)}, {center.longitude.toFixed(3)} · data ©
            OpenStreetMap contributors
          </p>
        ) : null}
      </section>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  /** Associate the visible label with a single control (do not use for button groups). */
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      {htmlFor ? (
        <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-semibold text-ink-soft">
          {label}
        </label>
      ) : (
        <p className="mb-1.5 text-xs font-semibold text-ink-soft">{label}</p>
      )}
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-soft">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[var(--color-brand)]"
      />
      {label}
    </label>
  );
}
