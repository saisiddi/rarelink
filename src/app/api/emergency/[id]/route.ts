import { getDb, nowIso } from "@/lib/db";
import { badRequest, guard, json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SELECT = `
  id, request_code, patient_reference, blood_group, component, units_required, units_found,
  rare_phenotype, hospital_name, hospital_address, latitude, longitude, city, urgency,
  needed_by, status, created_at, updated_at`;

export const GET = guard(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const db = getDb();
  const row = db
    .prepare(`SELECT ${SELECT} FROM emergency_requests WHERE id = ? OR request_code = ?`)
    .get(id, id.toUpperCase()) as Record<string, string | number> | undefined;

  if (!row) return json({ error: "Request not found" }, { status: 404 });

  const matches = db
    .prepare(
      `SELECT candidate_kind, candidate_id, distance_km, score, notified_at, response, created_at
       FROM donor_matches WHERE request_id = ? ORDER BY score DESC`,
    )
    .all(String(row.id)) as Record<string, string | number | null>[];

  return json({
    request: {
      id: String(row.id),
      requestCode: String(row.request_code),
      bloodGroup: String(row.blood_group),
      component: String(row.component),
      unitsRequired: Number(row.units_required),
      unitsFound: Number(row.units_found),
      rarePhenotype: row.rare_phenotype ? String(row.rare_phenotype) : null,
      hospitalName: row.hospital_name ? String(row.hospital_name) : null,
      city: String(row.city),
      urgency: String(row.urgency),
      neededBy: row.needed_by ? String(row.needed_by) : null,
      status: String(row.status),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    },
    matches: matches.map((m) => ({
      kind: String(m.candidate_kind),
      candidateId: String(m.candidate_id),
      distanceKm: m.distance_km === null ? null : Number(m.distance_km),
      score: Number(m.score),
      notifiedAt: m.notified_at ? String(m.notified_at) : null,
      response: m.response ? String(m.response) : null,
    })),
  });
});

/** POST with { action: "cancel" | "fulfil" } */
export const POST = guard(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  let body: { action?: string };
  try {
    body = (await req.json()) as { action?: string };
  } catch {
    return badRequest("Invalid JSON body");
  }

  const action = body.action;
  if (action !== "cancel" && action !== "fulfil") {
    return badRequest("action must be 'cancel' or 'fulfil'");
  }

  const db = getDb();
  const row = db.prepare("SELECT id, status FROM emergency_requests WHERE id = ?").get(id) as
    | { id?: string; status?: string }
    | undefined;
  if (!row?.id) return json({ error: "Request not found" }, { status: 404 });

  const next = action === "cancel" ? "CANCELLED" : "FULFILLED";
  db.prepare("UPDATE emergency_requests SET status = ?, updated_at = ? WHERE id = ?").run(
    next,
    nowIso(),
    row.id,
  );

  if (action === "fulfil") {
    const { track } = await import("@/lib/analytics");
    await track("request_fulfilled", {});
  }

  return json({ id: row.id, status: next });
});
