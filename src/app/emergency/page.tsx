import type { Metadata } from "next";
import { EmergencyMode } from "@/components/EmergencyMode";
import { getDb } from "@/lib/db";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Emergency request",
  description:
    "Raise an emergency blood request and get ranked, verified blood-bank and donor matches in seconds.",
};

export const dynamic = "force-dynamic";

interface RequestRow {
  id: string;
  request_code: string;
  blood_group: string;
  component: string;
  units_required: number;
  city: string;
  status: string;
  urgency: string;
  created_at: string;
}

export default function EmergencyPage() {
  let rows: RequestRow[] = [];
  try {
    rows = getDb()
      .prepare(
        `SELECT id, request_code, blood_group, component, units_required, city, status, urgency, created_at
         FROM emergency_requests
         ORDER BY created_at DESC LIMIT 8`,
      )
      .all() as unknown as RequestRow[];
  } catch {
    rows = [];
  }

  return (
    <>
      <EmergencyMode />

      {rows.length > 0 ? (
        <section className="mx-auto mt-10 max-w-3xl px-4 pb-10 sm:px-6">
          <h2 className="text-lg font-bold text-ink">Recent requests</h2>
          <ul className="mt-3 space-y-2">
            {rows.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/emergency/${r.id}`}
                  className="card flex flex-wrap items-center gap-3 px-4 py-3 transition hover:border-brand/40"
                >
                  <span className="text-sm font-bold text-brand tabular">
                    {r.blood_group === "OH" ? "Oh" : r.blood_group}
                  </span>
                  <span className="text-sm text-ink-soft">{r.component.replace("_", " ")}</span>
                  <span className="text-sm text-ink-mute">
                    {r.units_required} unit{r.units_required === 1 ? "" : "s"} · {r.city}
                  </span>
                  <span className="ml-auto rounded-full bg-line px-2.5 py-1 text-xs font-semibold text-ink-soft">
                    {r.status}
                  </span>
                  <span className="text-xs text-ink-mute tabular">{r.request_code}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
