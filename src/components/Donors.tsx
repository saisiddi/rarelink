"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Search, HeartHandshake, ShieldCheck, Lock } from "lucide-react";

import type { SearchResult } from "@/lib/types";
import { cn } from "@/lib/cn";
import { ResultCard, EmptyState } from "@/components/ResultCard";
import { NoticeList, SafetyBanner } from "@/components/Banners";
import { Button } from "@/components/ui";

const GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "OH"];

interface DonorSearchResponse {
  city: string | null;
  donors: SearchResult[];
  notices: string[];
  safety: string[];
  tookMs: number;
}

export function DonorExplorer({ initialGroup = "", initialCity = "" }: { initialGroup?: string; initialCity?: string }) {
  const [group, setGroup] = useState(initialGroup);
  const [city, setCity] = useState(initialCity);
  const [data, setData] = useState<DonorSearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("intent", "find_donor");
      if (group) params.set("bloodGroup", group);
      if (city) params.set("city", city);
      params.set("radius", "75");
      const res = await fetch(`/api/donors/search?${params.toString()}`);
      if (!res.ok) throw new Error(`Search failed (${res.status})`);
      setData((await res.json()) as DonorSearchResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, [group, city]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 200);
    return () => window.clearTimeout(t);
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-52 flex-1">
            <p className="mb-1.5 text-xs font-semibold text-ink-soft">Blood group</p>
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
                        : "border-line bg-white text-ink-soft",
                  )}
                  aria-pressed={group === g}
                >
                  {g === "OH" ? "Oh" : g}
                </button>
              ))}
            </div>
          </div>
          <div className="min-w-52 flex-1">
            <label htmlFor="donor-city" className="mb-1.5 block text-xs font-semibold text-ink-soft">
              City
            </label>
            <input
              id="donor-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Bengaluru"
              className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-brand"
            />
          </div>
          <Button type="button" onClick={() => void load()} size="md" className="h-10">
            <Search className="h-4 w-4" aria-hidden="true" /> Search donors
          </Button>
        </div>
      </div>

      {data && data.safety.length > 0 ? <SafetyBanner lines={data.safety.slice(0, 1)} /> : null}
      {data && data.notices.length > 0 ? <NoticeList notices={data.notices} /> : null}
      {error ? (
        <div role="alert" className="rounded-2xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="card grid place-items-center gap-2 p-10 text-ink-mute">
          <Loader2 className="h-5 w-5 animate-spin" /> Searching the donor registry…
        </div>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2">
        {(data?.donors ?? []).map((d, i) => (
          <ResultCard key={d.key ?? d.id} result={d} index={i} />
        ))}
        {!loading && data && data.donors.length === 0 ? (
          <EmptyState
            title="No registered donors match yet"
            body="Widen the radius, try a compatible group, or register yourself — rare and repeat donors are the scarcest resource in an emergency."
          />
        ) : null}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Registration                                                                */
/* -------------------------------------------------------------------------- */

export function DonorRegisterForm() {
  const [form, setForm] = useState({
    displayName: "",
    bloodGroup: "",
    city: "",
    phone: "",
    email: "",
    method: "SMS",
    notifications: true,
    consent: false,
  });
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.consent) {
      setState("error");
      setMessage("Consent is required to register.");
      return;
    }
    setState("sending");
    try {
      const res = await fetch("/api/donors/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: form.displayName,
          bloodGroup: form.bloodGroup,
          city: form.city,
          phone: form.phone || undefined,
          email: form.email || undefined,
          preferredContactMethod: form.method,
          emergencyNotifications: form.notifications,
          consent: form.consent,
        }),
      });
      const data = (await res.json()) as { message?: string; error?: string; id?: string };
      if (!res.ok) {
        setState("error");
        setMessage(data.error ?? "Registration failed");
        return;
      }
      setState("done");
      setMessage(data.message ?? "Registered");
    } catch {
      setState("error");
      setMessage("Network error — please try again.");
    }
  }

  if (state === "done") {
    return (
      <div className="card grid place-items-center gap-3 p-8 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-ok-soft text-ok">
          <ShieldCheck className="h-6 w-6" aria-hidden="true" />
        </span>
        <h3 className="text-lg font-semibold text-ink">You&apos;re registered</h3>
        <p className="max-w-md text-sm text-ink-soft">{message}</p>
        <p className="max-w-md text-xs text-ink-mute">
          Your contact details are stored privately and never appear in search results.
        </p>
        <Button type="button" variant="outline" onClick={() => { setState("idle"); setForm({ ...form, displayName: "", phone: "", email: "" }); }}>
          Register another donor
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <HeartHandshake className="h-5 w-5 text-brand" aria-hidden="true" />
        <h3 className="text-lg font-semibold text-ink">Become a donor</h3>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-ink-soft">Display name</span>
          <input
            required
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            placeholder="e.g. Aditi S."
            className="h-11 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-brand"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-ink-soft">Blood group</span>
          <select
            required
            value={form.bloodGroup}
            onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}
            className="h-11 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-brand"
          >
            <option value="">Select…</option>
            {GROUPS.map((g) => (
              <option key={g} value={g}>
                {g === "OH" ? "Bombay phenotype (Oh)" : g}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-ink-soft">City</span>
          <input
            required
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            placeholder="e.g. Bengaluru"
            className="h-11 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-brand"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-ink-soft">
            Phone <span className="font-normal text-ink-mute">(private)</span>
          </span>
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+91 …"
            className="h-11 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-brand"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-ink-soft">
            Email <span className="font-normal text-ink-mute">(private)</span>
          </span>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@example.com"
            className="h-11 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-brand"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-ink-soft">Preferred contact</span>
          <select
            value={form.method}
            onChange={(e) => setForm({ ...form, method: e.target.value })}
            className="h-11 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-brand"
          >
            {["SMS", "WHATSAPP", "CALL", "EMAIL"].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-2.5 rounded-xl bg-canvas p-3">
        <label className="flex items-start gap-2.5 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={form.notifications}
            onChange={(e) => setForm({ ...form, notifications: e.target.checked })}
            className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]"
          />
          Send me emergency alerts when a compatible request is raised nearby (opt out any time).
        </label>
        <label className="flex items-start gap-2.5 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={form.consent}
            onChange={(e) => setForm({ ...form, consent: e.target.checked })}
            className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]"
          />
          I consent to RARELINK storing my details for emergency donor coordination, and I can
          withdraw consent or delete my record at any time.
        </label>
      </div>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-mute">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Only your display name, blood group and approximate area are ever shown publicly. Phone,
        email and exact coordinates are never returned by the search API.
      </p>

      {message && state === "error" ? (
        <p role="alert" className="text-sm text-danger">{message}</p>
      ) : null}

      <Button type="submit" disabled={state === "sending"} className="w-full sm:w-auto">
        {state === "sending" ? "Registering…" : "Register as a donor"}
      </Button>
    </form>
  );
}
