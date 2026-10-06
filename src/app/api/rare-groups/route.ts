import { getDb } from "@/lib/db";
import { guard, json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = guard(async () => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, name, code, system, description, compatibility_notes,
              verification_required, source, updated_at
       FROM rare_blood_groups ORDER BY name ASC`,
    )
    .all() as Record<string, string | number>[];

  const donorCounts = db
    .prepare(
      `SELECT blood_group AS code, COUNT(*) AS n
       FROM donors
       WHERE rare_phenotype IS NOT NULL AND verification_status = 'VERIFIED'
       GROUP BY blood_group`,
    )
    .all() as Array<{ code: string; n: number | bigint }>;

  const counts = new Map(donorCounts.map((d) => [String(d.code), Number(d.n)]));

  return json({
    groups: rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      code: String(r.code),
      system: String(r.system),
      description: String(r.description),
      compatibilityNotes: String(r.compatibility_notes),
      verificationRequired: Number(r.verification_required) === 1,
      source: String(r.source),
      updatedAt: String(r.updated_at),
      verifiedDonors: counts.get(String(r.code)) ?? 0,
    })),
    notice:
      "Rare phenotype compatibility must always be confirmed by a qualified blood bank / transfusion service.",
  });
});
