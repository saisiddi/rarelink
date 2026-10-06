import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getDb } from "@/lib/db";
import { ButtonLink } from "@/components/ui";
import { SafetyBanner } from "@/components/Banners";

export const metadata: Metadata = { title: "Request status" };
export const dynamic = "force-dynamic";

interface Row {
  id: string;
  request_code: string;
  blood_group: string;
  component: string;
  units_required: number;
  units_found: number;
  rare_phenotype: string | null;
  hospital_name: string | null;
  city: string;
  urgency: string;
  needed_by: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Match {
  candidate_kind: string;
  candidate_id: string;
  distance_km: number | null;
  score: number;
  notified_at: string | null;
  response: string | null;
}

export default async function EmergencyStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();

  const row = db
    .prepare(
      `SELECT id, request_code, blood_group, component, units_required, units_found, rare_phenotype,
              hospital_name, city, urgency, needed_by, status, created_at, updated_at
       FROM emergency_requests WHERE id = ? OR request_code = ?`,
    )
    .get(id, id.toUpperCase()) as unknown as Row | undefined;

  if (!row) notFound();

  const matches = db
    .prepare(
      `SELECT candidate_kind, candidate_id, distance_km, score, notified_at, response
       FROM donor_matches WHERE request_id = ? ORDER BY score DESC LIMIT 12`,
    )
    .all(row.id) as unknown as Match[];

  const bankNames = new Map<string, string>();
  const donorNames = new Map<string, string>();
  for (const m of matches) {
    if (m.candidate_kind === "blood_bank" && !bankNames.has(m.candidate_id)) {
      const b = db
        .prepare("SELECT name, phone FROM blood_banks WHERE id = ?")
        .get(m.candidate_id) as { name?: string; phone?: string } | undefined;
      if (b?.name) bankNames.set(m.candidate_id, `${b.name}${b.phone ? ` · ${b.phone}` : ""}`);
    }
    if (m.candidate_kind === "donor" && !donorNames.has(m.candidate_id)) {
      const d = db
        .prepare(
          "SELECT display_name, city, verification_label FROM donors WHERE id = ?",
        )
        .get(m.candidate_id) as
        | { display_name?: string; city?: string; verification_label?: string }
        | undefined;
      if (d?.display_name) {
        donorNames.set(
          m.candidate_id,
          `${d.display_name} · ${d.city ?? ""} · ${d.verification_label ?? ""}`.replace(/ · $/, ""),
        );
      }
    }
  }

  const statusTone: Record<string, string> = {
    OPEN: "bg-line text-ink-soft",
    MATCHING: "bg-brand-soft text-brand",
    PARTIALLY_MATCHED: "bg-warn-soft text-warn",
    MATCHED: "bg-ok-soft text-ok",
    FULFILLED: "bg-ok-soft text-ok",
    CANCELLED: "bg-line text-ink-mute",
    EXPIRED: "bg-danger-soft text-danger",
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/emergency" className="text-sm font-semibold text-brand">
        ← Back to emergency mode
      </Link>

      <div className="mt-4 card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
              Request status
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">
              {row.blood_group === "OH" ? "Bombay (Oh)" : row.blood_group}
              <span className="ml-2 text-lg font-bold text-ink-soft">
                {row.units_required} unit{row.units_required === 1 ? "" : "s"}
              </span>
            </h1>
            <p className="mt-1 text-sm text-ink-soft">
              {row.component.replace("_", " ")} · {row.city}
              {row.hospital_name ? ` · ${row.hospital_name}` : ""}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${statusTone[row.status] ?? "bg-line text-ink-soft"}`}
          >
            {row.status}
          </span>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Code" value={row.request_code} />
          <Stat label="Found" value={`${row.units_found} / ${row.units_required}`} />
          <Stat label="Urgency" value={row.urgency} />
          <Stat
            label="Needed by"
            value={
              row.needed_by
                ? new Date(row.needed_by).toLocaleString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"
            }
          />
        </dl>

        {row.rare_phenotype ? (
          <p className="mt-4 rounded-xl bg-warn-soft px-3 py-2.5 text-sm text-warn">
            Rare phenotype: {row.rare_phenotype}. Compatibility must be confirmed by a qualified
            blood bank before transfusion.
          </p>
        ) : null}
      </div>

      <div className="mt-4">
        <SafetyBanner
          lines={[
            "Blood availability can change rapidly. Please call the blood bank or hospital before travelling.",
          ]}
        />
      </div>

      <h2 className="mt-8 text-lg font-bold text-ink">Matched candidates</h2>
      <p className="text-sm text-ink-soft">
        Ranked deterministically by availability, freshness, distance, verification and emergency
        capability.
      </p>

      <ol className="mt-3 space-y-2">
        {matches.map((m, i) => (
          <li key={`${m.candidate_kind}-${m.candidate_id}`} className="card flex items-center gap-3 px-4 py-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-navy text-sm font-bold text-white tabular">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">
                {m.candidate_kind === "blood_bank"
                  ? (bankNames.get(m.candidate_id) ?? m.candidate_id)
                  : (donorNames.get(m.candidate_id) ?? "Registered donor")}
              </p>
              <p className="text-xs text-ink-mute">
                {m.candidate_kind === "blood_bank" ? "Blood bank" : "Donor"}
                {m.distance_km !== null ? ` · ${m.distance_km.toFixed(1)} km` : ""}
                {m.notified_at ? " · notified" : " · not notified"}
                {m.response ? ` · ${m.response}` : ""}
              </p>
            </div>
            <span className="text-xs font-semibold text-ink-soft tabular">
              score {(m.score * 100).toFixed(0)}
            </span>
          </li>
        ))}
        {matches.length === 0 ? (
          <li className="card p-6 text-sm text-ink-soft">
            No candidates yet. Try widening the search or contacting your hospital&apos;s
            transfusion department directly.
          </li>
        ) : null}
      </ol>

      <div className="mt-6 flex flex-wrap gap-2">
        <ButtonLink href="/map" variant="secondary" size="sm">
          Open map
        </ButtonLink>
        <ButtonLink href="/search" variant="outline" size="sm">
          Search again
        </ButtonLink>
      </div>

      <p className="mt-6 text-xs text-ink-mute">
        Last updated {new Date(row.updated_at).toLocaleString("en-IN")} · donor contact details are
        shared only after the donor accepts.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-canvas px-3 py-2.5">
      <dt className="text-[11px] uppercase tracking-wider text-ink-mute">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-ink tabular">{value}</dd>
    </div>
  );
}
