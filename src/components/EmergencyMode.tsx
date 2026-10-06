"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Phone, Navigation, Siren, Loader2, CheckCircle2, Clock } from "lucide-react";

import type { SearchResult, BloodComponent } from "@/lib/types";
import { cn } from "@/lib/cn";
import { Button, ButtonLink } from "@/components/ui";
import { AvailabilityBadge, DistanceBadge, FreshnessBadge, VerificationBadge } from "@/components/badges";
import { SafetyBanner } from "@/components/Banners";

const GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "OH"];
const COMPONENTS: BloodComponent[] = ["PRBC", "PLATELETS", "FFP", "WHOLE_BLOOD", "SDP", "CRYO"];

interface CreateResponse {
  id: string;
  request: {
    id: string;
    bloodGroup: string;
    component: string;
    unitsRequired: number;
    city: string;
    urgency: string;
    neededBy: string | null;
    status: string;
  };
  matches: number;
  bloodBanks: SearchResult[];
  donors: SearchResult[];
  safety: string[];
  notices: string[];
}

export function EmergencyMode() {
  const [form, setForm] = useState({
    bloodGroup: "",
    component: "PRBC" as BloodComponent,
    units: 2,
    city: "",
    hospital: "",
    contact: "",
  });
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateResponse | null>(null);
  const [tick, setTick] = useState(0);

  // Emergency mode refreshes the result list so freshness stays honest.
  useEffect(() => {
    if (state !== "done" || !result) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 45_000);
    return () => window.clearInterval(id);
  }, [state, result]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setState("sending");
    try {
      const res = await fetch("/api/emergency", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bloodGroup: form.bloodGroup,
          component: form.component,
          units: form.units,
          city: form.city,
          hospitalName: form.hospital || undefined,
          contact: form.contact,
          urgency: "emergency",
        }),
      });
      const data = (await res.json()) as { error?: string } & CreateResponse;
      if (!res.ok) throw new Error(data.error ?? "Could not create the request");
      setResult(data);
      setState("done");
      void fetch("/api/analytics", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event: "emergency_created", metadata: { group: form.bloodGroup } }),
      }).catch(() => undefined);
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Request failed");
    }
  }

  /* ---------------------------------------------------------------- RESULT */
  if (state === "done" && result) {
    const options = [
      ...result.bloodBanks.map((r) => ({ ...r, isDonor: false })),
      ...result.donors.map((r) => ({ ...r, isDonor: true })),
    ].sort((a, b) => (a.distanceKm ?? 9e9) - (b.distanceKm ?? 9e9));

    return (
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6" key={tick}>
        <div className="rounded-3xl border-2 border-brand bg-brand px-5 py-4 text-white shadow-lift">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 text-2xl" aria-hidden="true">
              🚨
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/80">
                Emergency blood required
              </p>
              <h1 className="truncate text-3xl font-black tracking-tight">
                {result.request.bloodGroup === "OH" ? "Bombay (Oh)" : result.request.bloodGroup} ·{" "}
                {result.request.unitsRequired} {result.request.unitsRequired === 1 ? "unit" : "units"}
              </h1>
              <p className="text-sm text-white/85">
                {result.request.component.replace("_", " ")} · {result.request.city} ·{" "}
                {result.request.status}
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-white/15 px-2.5 py-1 font-semibold">
              Request {result.id.slice(0, 10).toUpperCase()}
            </span>
            {result.request.neededBy ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 font-semibold">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                Needed by {new Date(result.request.neededBy).toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            ) : null}
            <span className="rounded-full bg-white/15 px-2.5 py-1 font-semibold">
              {result.matches} matches ranked
            </span>
            <Link href={`/emergency/${result.id}`} className="ml-auto underline hover:text-white">
              Track request →
            </Link>
          </div>
        </div>

        <div className="mt-4">
          <SafetyBanner lines={result.safety.slice(0, 2)} />
        </div>

        <h2 className="mt-6 flex items-center gap-2 text-lg font-bold text-ink">
          <CheckCircle2 className="h-5 w-5 text-ok" aria-hidden="true" />
          Best options — nearest first
        </h2>

        <ol className="mt-3 space-y-2.5">
          {options.map((o, i) => (
            <li
              key={o.key ?? o.id}
              className={cn(
                "card flex flex-wrap items-center gap-3 p-3.5",
                i === 0 && "border-brand/50 shadow-lift",
              )}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-navy text-sm font-bold text-white tabular">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">
                  {o.title}
                  {o.isDonor ? (
                    <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-bold text-brand">
                      DONOR
                    </span>
                  ) : null}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                  <DistanceBadge km={o.distanceKm} />
                  <AvailabilityBadge status={o.availabilityStatus} />
                  <FreshnessBadge freshness={o.freshness} lastUpdatedAt={o.lastUpdatedAt} />
                  <VerificationBadge verified={o.verified} label={o.verificationLabel} />
                </div>
              </div>
              <div className="flex gap-2">
                {o.isDonor ? (
                  <Link
                    href={`/donors?group=${encodeURIComponent(o.bloodGroup ?? "")}&city=${encodeURIComponent(o.city)}`}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-brand px-3.5 text-sm font-semibold text-white"
                  >
                    <Phone className="h-4 w-4" aria-hidden="true" /> Request
                  </Link>
                ) : (
                  <>
                    <a
                      href={`tel:${(o.emergencyPhone ?? o.phone ?? "").replace(/\s/g, "")}`}
                      className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-navy px-3.5 text-sm font-semibold text-white"
                    >
                      <Phone className="h-4 w-4" aria-hidden="true" /> Call
                    </a>
                    <a
                      href={`https://www.openstreetmap.org/directions?to=${encodeURIComponent(
                        o.coordinates
                          ? `${o.title}@${o.coordinates.latitude},${o.coordinates.longitude}`
                          : `${o.title}, ${o.city}`,
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line px-3.5 text-sm font-semibold text-ink"
                    >
                      <Navigation className="h-4 w-4" aria-hidden="true" /> Directions
                    </a>
                  </>
                )}
              </div>
            </li>
          ))}
          {options.length === 0 ? (
            <li className="card p-6 text-sm text-ink-soft">
              No matching options in this radius right now. Try a wider radius or a nearby city, and
              contact your hospital&apos;s transfusion department.
            </li>
          ) : null}
        </ol>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setState("idle");
              setResult(null);
            }}
          >
            New request
          </Button>
          <ButtonLink href="/map" variant="secondary">
            Open map
          </ButtonLink>
          <ButtonLink href={`/emergency/${result.id}`} variant="ghost">
            Track status
          </ButtonLink>
        </div>

        <p className="mt-4 text-xs text-ink-mute">
          Availability refreshes every 45 seconds while this screen is open. Data sources are shown
          on each row — call before travelling.
        </p>
      </div>
    );
  }

  /* ------------------------------------------------------------------ FORM */
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="flex items-center gap-3 rounded-3xl border border-brand/40 bg-brand-soft px-5 py-4">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand text-2xl text-white" aria-hidden="true">
          🚨
        </span>
        <div>
          <h1 className="text-xl font-bold text-ink">Emergency mode</h1>
          <p className="text-sm text-ink-soft">
            Minimal inputs. Ranked results. Call and directions in one tap.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="card mt-5 space-y-4 p-5 sm:p-6">
        <fieldset>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-soft">
            Blood group
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {GROUPS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setForm({ ...form, bloodGroup: g })}
                className={cn(
                  "h-11 min-w-12 rounded-xl border px-2.5 text-sm font-bold transition",
                  form.bloodGroup === g
                    ? "border-brand bg-brand text-white"
                    : g === "OH"
                      ? "border-brand/40 bg-brand-soft text-brand"
                      : "border-line bg-white text-ink-soft",
                )}
                aria-pressed={form.bloodGroup === g}
              >
                {g === "OH" ? "Oh" : g}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-ink-soft">Component</span>
            <select
              value={form.component}
              onChange={(e) => setForm({ ...form, component: e.target.value as BloodComponent })}
              className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-brand"
            >
              {COMPONENTS.map((c) => (
                <option key={c} value={c}>
                  {c.replace("_", " ")}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-ink-soft">Units</span>
            <input
              type="number"
              min={1}
              max={50}
              value={form.units}
              onChange={(e) => setForm({ ...form, units: Number(e.target.value) })}
              className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-brand"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-ink-soft">City</span>
            <input
              required
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder="e.g. Bengaluru"
              className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-brand"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-ink-soft">
              Hospital / location <span className="font-normal text-ink-mute">(optional)</span>
            </span>
            <input
              value={form.hospital}
              onChange={(e) => setForm({ ...form, hospital: e.target.value })}
              placeholder="e.g. City General Hospital"
              className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-brand"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-ink-soft">
              Your phone or email
            </span>
            <input
              required
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
              placeholder="+91 … or you@example.com"
              className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-brand"
            />
          </label>
        </div>

        <p className="rounded-xl bg-canvas px-3 py-2.5 text-xs leading-relaxed text-ink-mute">
          We never ask for the patient&apos;s name, age, diagnosis or identity — only what is needed
          to match blood and reach you.
        </p>

        {error ? (
          <p role="alert" className="text-sm text-danger">{error}</p>
        ) : null}

        <Button type="submit" disabled={state === "sending" || !form.bloodGroup} size="lg" className="w-full">
          {state === "sending" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Matching…
            </>
          ) : (
            <>
              <Siren className="h-5 w-5" aria-hidden="true" /> Find matches now
            </>
          )}
        </Button>
      </form>

      <p className="mt-4 rounded-2xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm leading-relaxed text-warn">
        If someone is in immediate danger, contact emergency medical services or the treating
        hospital first. RARELINK coordinates information — it does not dispatch services.
      </p>
    </div>
  );
}
