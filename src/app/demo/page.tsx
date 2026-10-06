import type { Metadata } from "next";
import Link from "next/link";
import { FlaskConical } from "lucide-react";

import { getDb, isDemoDataset } from "@/lib/db";
import { ButtonLink } from "@/components/ui";

export const metadata: Metadata = { title: "Demo dataset" };
export const dynamic = "force-dynamic";

export default function DemoPage() {
  const db = getDb();
  const demo = isDemoDataset();

  const count = (sql: string): number => {
    const row = db.prepare(sql).get() as { n?: number | bigint } | undefined;
    return Number(row?.n ?? 0);
  };

  const banksByCity = db
    .prepare(
      `SELECT city, COUNT(*) AS n FROM blood_banks WHERE is_demo = 1 GROUP BY city ORDER BY n DESC`,
    )
    .all() as Array<{ city: string; n: number | bigint }>;

  const sources = db
    .prepare("SELECT id, name, kind, is_live FROM data_sources")
    .all() as Array<{ id: string; name: string; kind: string; is_live: number }>;

  const groups = db
    .prepare(
      `SELECT blood_group AS g, COUNT(*) AS n FROM blood_inventory GROUP BY blood_group ORDER BY n DESC`,
    )
    .all() as Array<{ g: string; n: number | bigint }>;

  let groupRows: Array<{ g: string; n: number }> = [];
  try {
    groupRows = groups.map((g) => ({ g: String(g.g), n: Number(g.n) }));
  } catch {
    groupRows = [];
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="flex items-start gap-4 rounded-3xl border border-warn/40 bg-warn-soft p-5">
        <FlaskConical className="mt-1 h-6 w-6 shrink-0 text-warn" aria-hidden="true" />
        <div>
          <h1 className="text-xl font-bold text-ink">DEMO DATASET — NOT FOR REAL MEDICAL USE</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-warn">
            {demo
              ? "No live provider is configured, so RARELINK is running entirely on its bundled demo dataset."
              : "A live provider is configured; demo rows are still present and are labelled individually."}
          </p>
        </div>
      </div>

      <p className="mt-6 max-w-3xl text-sm leading-relaxed text-ink-soft">
        The demo dataset exists so the full product can be exercised without depending on an
        external API: blood banks with inventory of varying freshness, verified and self-reported
        donors, rare donors, and emergency requests in different states. Every row is marked{" "}
        <code className="rounded bg-line px-1.5 py-0.5 text-xs">is_demo = 1</code> and every result
        card carries a <strong>Demo data</strong> tag.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Metric label="Blood banks" value={count("SELECT COUNT(*) AS n FROM blood_banks")} />
        <Metric label="Inventory records" value={count("SELECT COUNT(*) AS n FROM blood_inventory")} />
        <Metric label="Donors" value={count("SELECT COUNT(*) AS n FROM donors")} />
        <Metric
          label="Rare donors"
          value={count("SELECT COUNT(*) AS n FROM donors WHERE rare_phenotype IS NOT NULL")}
        />
        <Metric
          label="Verified donors"
          value={count("SELECT COUNT(*) AS n FROM donors WHERE verification_status = 'VERIFIED'")}
        />
        <Metric label="Emergency requests" value={count("SELECT COUNT(*) AS n FROM emergency_requests")} />
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-bold text-ink">What&apos;s included</h2>
        <ul className="mt-3 space-y-2 text-sm text-ink-soft">
          <li>
            <strong className="text-ink">10+ blood banks</strong> across Bengaluru, Mumbai, Delhi,
            Chennai, Hyderabad, Kolkata, Pune, Jaipur, Kochi and Manipal — with fictional names and
            obviously fake all-zero phone exchanges so they can never be dialled by accident.
          </li>
          <li>
            <strong className="text-ink">20 normal donors</strong>, mixing blood-bank verified,
            phone verified and self-reported states.
          </li>
          <li>
            <strong className="text-ink">5 rare donors</strong> — Bombay phenotype (Oh) and
            Para-Bombay, kept out of ordinary O− searches.
          </li>
          <li>
            <strong className="text-ink">Inventory with mixed freshness</strong> — live, recent,
            stale and outdated rows, so the freshness policy is visible in the UI.
          </li>
          <li>
            <strong className="text-ink">Emergency requests</strong> in MATCHING, OPEN and FULFILLED
            states with pre-computed ranked matches.
          </li>
        </ul>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-semibold text-ink">Banks by city</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-ink-soft">
            {banksByCity.map((b) => (
              <li key={b.city} className="flex justify-between border-b border-line pb-1.5 last:border-0">
                <span>{b.city}</span>
                <span className="font-semibold tabular">{Number(b.n)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-5">
          <h2 className="font-semibold text-ink">Configured sources</h2>
          <ul className="mt-2 space-y-2 text-sm text-ink-soft">
            {sources.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2">
                <span>{s.name}</span>
                <span
                  className={
                    s.is_live
                      ? "rounded-full bg-ok-soft px-2 py-0.5 text-xs font-semibold text-ok"
                      : "rounded-full bg-line px-2 py-0.5 text-xs font-semibold text-ink-mute"
                  }
                >
                  {s.is_live ? "LIVE" : s.kind}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-mute">
            Set <code>ERAKTKOSH_BASE_URL</code> or <code>IRCS_BASE_URL</code> (and{" "}
            <code>BLOOD_DATA_PROVIDERS</code>) to switch a provider on — no application code
            changes.
          </p>
        </div>
      </section>

      {groupRows.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-bold text-ink">Inventory coverage</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {groupRows.map((g) => (
              <span key={g.g} className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-semibold text-ink">
                {g.g === "OH" ? "Oh" : g.g} <span className="text-ink-mute tabular">· {g.n}</span>
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-2">
        <ButtonLink href="/search">Try a search</ButtonLink>
        <ButtonLink href="/rare" variant="outline">
          Rare blood workflow
        </ButtonLink>
        <ButtonLink href="/emergency" variant="secondary">
          Emergency mode
        </ButtonLink>
        <Link href="/about" className="inline-flex h-11 items-center rounded-xl border border-line px-5 text-sm font-semibold text-ink">
          Architecture
        </Link>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="card px-4 py-3">
      <p className="text-[11px] uppercase tracking-wider text-ink-mute">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink tabular">{value}</p>
    </div>
  );
}
