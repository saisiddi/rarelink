import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, TriangleAlert } from "lucide-react";

import { getDb } from "@/lib/db";
import { checkCompatibility, bloodGroupLabel } from "@/lib/blood/compatibility";

export const metadata: Metadata = {
  title: "Rare blood groups",
  description:
    "Bombay phenotype (Oh), Para-Bombay and other rare groups — how RARELINK treats them differently from O−, and how to find rare donors.",
};

export const dynamic = "force-dynamic";

interface RareRow {
  id: string;
  name: string;
  code: string;
  system: string;
  description: string;
  compatibility_notes: string;
  verification_required: number;
  source: string;
  updated_at: string;
}

export default function RarePage() {
  const db = getDb();
  const groups = db
    .prepare(
      `SELECT id, name, code, system, description, compatibility_notes,
              verification_required, source, updated_at
       FROM rare_blood_groups ORDER BY name ASC`,
    )
    .all() as unknown as RareRow[];

  const counts = db
    .prepare(
      `SELECT blood_group AS code, COUNT(*) AS n FROM donors
       WHERE rare_phenotype IS NOT NULL AND verification_status = 'VERIFIED'
       GROUP BY blood_group`,
    )
    .all() as Array<{ code: string; n: number | bigint }>;
  const countMap = new Map(counts.map((c) => [String(c.code), Number(c.n)]));

  const ohDonors = db
    .prepare(
      `SELECT id, display_name, city, state, verification_label, last_verified_at
       FROM donors WHERE blood_group = 'OH' AND verification_status = 'VERIFIED'
       ORDER BY last_verified_at DESC`,
    )
    .all() as Array<Record<string, string>>;

  const oNeg = checkCompatibility("O-", "PRBC");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Rare blood</p>
      <h1 className="mt-1 text-balance text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        Bombay phenotype is not O−.
      </h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-soft">
        Official transfusion guidance states that Bombay phenotype (Oh) red cells lack A, B and H
        antigens and that people with this phenotype require Bombay-phenotype blood. RARELINK keeps
        rare phenotypes in a separate registry, never widens a rare request to ordinary O−, and
        always routes confirmation through a qualified blood bank.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="flex items-center gap-2 font-semibold text-ink">
            <TriangleAlert className="h-4 w-4 text-brand" aria-hidden="true" />
            Why it matters
          </h2>
          <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-ink-soft">
            <li>
              <strong className="text-ink">O− is not a substitute.</strong> A donor typed as O−
              still carries the H antigen, which Bombay-phenotype patients can react to.
            </li>
            <li>
              <strong className="text-ink">Rarity is the problem.</strong> Finding a compatible
              donor can take days across a city — which is exactly why rare-donor discovery is an
              emergency feature, not a directory filter.
            </li>
            <li>
              <strong className="text-ink">Self-reported is not enough.</strong> Rare groups are
              only shown as verified when a blood bank has confirmed them.
            </li>
          </ul>

          <div className="mt-4 rounded-xl bg-canvas p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-mute">
              Compatibility engine output — recipient O−, red cells
            </p>
            <p className="mt-2 text-sm text-ink">
              Candidates: <strong>{oNeg.candidates.join(", ")}</strong>
            </p>
            <p className="mt-1 text-xs text-ink-mute">{oNeg.notes[0]}</p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/search?bloodGroup=OH&intent=find_donor&city=Bengaluru"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-strong"
            >
              Find Bombay blood in Bengaluru <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/donors?group=OH"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-line px-4 text-sm font-semibold text-ink hover:border-ink-mute"
            >
              Rare donor registry
            </Link>
          </div>
        </div>

        <div className="card bg-navy p-5 text-white">
          <p className="text-xs uppercase tracking-widest text-white/50">Verified Oh donors</p>
          <p className="mt-2 text-4xl font-bold tabular">{countMap.get("OH") ?? 0}</p>
          <ul className="mt-4 space-y-3">
            {ohDonors.slice(0, 4).map((d) => (
              <li key={d.id} className="rounded-xl bg-white/5 px-3 py-2.5">
                <p className="text-sm font-semibold">
                  {d.display_name} · {d.city}
                </p>
                <p className="text-xs text-white/60">
                  {d.verification_label}
                  {d.last_verified_at
                    ? ` · verified ${new Date(d.last_verified_at).toLocaleDateString("en-IN")}`
                    : ""}
                </p>
              </li>
            ))}
            {ohDonors.length === 0 ? (
              <li className="text-sm text-white/60">No verified rare donors registered yet.</li>
            ) : null}
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-white/50">
            Contact details are never listed here. Requests are routed through RARELINK and the
            donor decides whether to respond.
          </p>
        </div>
      </div>

      <h2 className="mt-12 text-xl font-bold text-ink">Rare group registry</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {groups.map((g) => (
          <article key={g.id} className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-ink">{g.name}</h3>
                <p className="text-xs text-ink-mute">
                  {g.code} · system: {g.system}
                </p>
              </div>
              <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">
                {countMap.get(g.code) ?? 0} verified donors
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">{g.description}</p>
            <p className="mt-3 rounded-xl bg-warn-soft px-3 py-2 text-xs leading-relaxed text-warn">
              {g.compatibility_notes}
            </p>
            <p className="mt-3 text-[11px] uppercase tracking-wide text-ink-mute">
              Source: {g.source}
            </p>
          </article>
        ))}
      </div>

      <p className="mt-8 rounded-2xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm leading-relaxed text-warn">
        Rare blood compatibility must be confirmed by a qualified blood bank or transfusion service
        before transfusion. RARELINK does not determine compatibility for rare phenotypes.
      </p>

      <p className="mt-4 text-xs text-ink-mute">
        Supported standard groups: {(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const)
          .map(bloodGroupLabel)
          .join(" · ")}
      </p>
    </div>
  );
}
