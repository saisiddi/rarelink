"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldAlert, CheckCircle2, Clock, Activity } from "lucide-react";

interface Stats {
  activeEmergencies: number;
  availableUnits: number;
  rareDonors: number;
  verifiedDonors: number;
  staleInventory: number;
  pendingVerification: number;
  bloodBanks: number;
  donors: number;
  emergencyRequests: number;
  searchEvents: number;
}

interface Payload {
  stats: Stats;
  staleInventory: Array<{ bank: string; city: string; bloodGroup: string; component: string; lastUpdatedAt: string }>;
  pendingDonors: Array<{ id: string; displayName: string; bloodGroup: string; city: string; status: string; createdAt: string }>;
  emergencyRequests: Array<{ id: string; requestCode: string; bloodGroup: string; component: string; city: string; urgency: string; status: string; createdAt: string }>;
  auditLogs: Array<{ action: string; subjectKind: string | null; subjectId: string | null; actor: string | null; createdAt: string }>;
}

export default function AdminPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifyState, setVerifyState] = useState<Record<string, "idle" | "busy" | "done">>({});

  async function fetchStats(): Promise<Payload> {
    const res = await fetch("/api/admin/stats", { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load (${res.status})`);
    return (await res.json()) as Payload;
  }

  async function load() {
    try {
      setData(await fetchStats());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }

  // Initial load. The work is awaited in a callback rather than in the effect
  // body, and the result is dropped if the page unmounts first.
  useEffect(() => {
    let active = true;
    void fetchStats().then(
      (payload) => {
        if (active) setData(payload);
      },
      (err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Failed to load");
      },
    );
    return () => {
      active = false;
    };
  }, []);

  async function verifyDonor(id: string) {
    setVerifyState((s) => ({ ...s, [id]: "busy" }));
    try {
      const res = await fetch("/api/admin/verify-donor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, action: "verify" }),
      });
      setVerifyState((s) => ({ ...s, [id]: res.ok ? "done" : "idle" }));
      if (res.ok) await load();
    } catch {
      setVerifyState((s) => ({ ...s, [id]: "idle" }));
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div role="alert" className="rounded-2xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto grid max-w-5xl place-items-center gap-2 px-4 py-20 text-ink-mute">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading dashboard…
      </div>
    );
  }

  const s = data.stats;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Admin</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Operations dashboard
          </h1>
        </div>
        <span className="rounded-full bg-warn-soft px-3 py-1.5 text-xs font-semibold text-warn">
          Prototype — no authentication in front of this route yet
        </span>
      </div>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Active emergencies" value={s.activeEmergencies} tone="brand" />
        <Kpi label="Available units" value={s.availableUnits} tone="ok" />
        <Kpi label="Verified donors" value={s.verifiedDonors} tone="info" />
        <Kpi label="Rare donors" value={s.rareDonors} tone="brand" />
        <Kpi label="Stale inventory" value={s.staleInventory} tone="warn" />
        <Kpi label="Blood banks" value={s.bloodBanks} />
        <Kpi label="Registered donors" value={s.donors} />
        <Kpi label="Pending verification" value={s.pendingVerification} tone="warn" />
        <Kpi label="Emergency requests" value={s.emergencyRequests} />
        <Kpi label="Search events" value={s.searchEvents} />
      </section>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Panel
          title="Stale inventory"
          icon={<Clock className="h-4 w-4 text-warn" aria-hidden="true" />}
          count={data.staleInventory.length}
          empty="No stale inventory — every record is under 3 hours old."
        >
          <ul className="divide-y divide-line">
            {data.staleInventory.map((r) => (
              <li key={`${r.bank}-${r.bloodGroup}-${r.component}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{r.bank}</p>
                  <p className="text-xs text-ink-mute">
                    {r.bloodGroup === "OH" ? "Oh" : r.bloodGroup} · {r.component.replace("_", " ")} · {r.city}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-warn tabular">
                  {relative(r.lastUpdatedAt)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title="Pending donor verification"
          icon={<ShieldAlert className="h-4 w-4 text-brand" aria-hidden="true" />}
          count={data.pendingDonors.length}
          empty="Nothing pending — all registrations are verified."
        >
          <ul className="divide-y divide-line">
            {data.pendingDonors.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">
                    {d.displayName} · {d.bloodGroup === "OH" ? "Oh" : d.bloodGroup}
                  </p>
                  <p className="text-xs text-ink-mute">
                    {d.city} · self-reported · registered {relative(d.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={verifyState[d.id] === "busy" || verifyState[d.id] === "done"}
                  onClick={() => void verifyDonor(d.id)}
                  className="shrink-0 rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {verifyState[d.id] === "done" ? "Verified ✓" : verifyState[d.id] === "busy" ? "…" : "Verify"}
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title="Emergency requests"
          icon={<Activity className="h-4 w-4 text-info" aria-hidden="true" />}
          count={data.emergencyRequests.length}
          empty="No requests yet."
        >
          <ul className="divide-y divide-line">
            {data.emergencyRequests.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">
                    {r.bloodGroup === "OH" ? "Oh" : r.bloodGroup} · {r.component.replace("_", " ")} · {r.city}
                  </p>
                  <p className="text-xs text-ink-mute tabular">{r.requestCode}</p>
                </div>
                <span
                  className={
                    r.status === "FULFILLED"
                      ? "rounded-full bg-ok-soft px-2.5 py-1 text-xs font-semibold text-ok"
                      : r.status === "OPEN"
                        ? "rounded-full bg-line px-2.5 py-1 text-xs font-semibold text-ink-soft"
                        : "rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand"
                  }
                >
                  {r.status}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title="Audit log"
          icon={<CheckCircle2 className="h-4 w-4 text-ok" aria-hidden="true" />}
          count={data.auditLogs.length}
          empty="No sensitive actions recorded yet."
        >
          <ul className="divide-y divide-line">
            {data.auditLogs.map((a, i) => (
              <li key={`${a.action}-${i}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{a.action}</p>
                  <p className="text-xs text-ink-mute">
                    {a.subjectKind ?? "—"} {a.subjectId ? `· ${a.subjectId.slice(0, 12)}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-ink-mute tabular">{relative(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <p className="mt-6 text-xs text-ink-mute">
        Every sensitive action writes to <code>audit_logs</code>. OTPs, API keys, government IDs and
        donor private fields are never logged.
      </p>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "brand" | "ok" | "warn" | "info";
}) {
  const tones = {
    brand: "border-brand/30 bg-brand-soft text-brand",
    ok: "border-ok/30 bg-ok-soft text-ok",
    warn: "border-warn/30 bg-warn-soft text-warn",
    info: "border-info/30 bg-info-soft text-info",
  };
  return (
    <div className={`card border px-4 py-3 ${tone ? tones[tone] : "border-line"}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider opacity-80">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular">{value}</p>
    </div>
  );
}

function Panel({
  title,
  icon,
  empty,
  count,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  empty: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-5">
      <h2 className="flex items-center gap-2 font-semibold text-ink">
        {icon}
        {title}
      </h2>
      <div className="mt-3">
        {count === 0 ? <p className="text-sm text-ink-mute">{empty}</p> : children}
      </div>
    </section>
  );
}

function relative(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  if (Number.isNaN(diff)) return "—";
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}
