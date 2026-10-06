import { getDb, nowIso, newId } from "@/lib/db";
import { badRequest, guard, json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = guard(async (req: Request) => {
  let body: { id?: unknown; verified?: unknown; notes?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return badRequest("Invalid JSON body");
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) return badRequest("id is required");

  const db = getDb();
  const row = db
    .prepare("SELECT id, verified FROM blood_banks WHERE id = ?")
    .get(id) as { id?: string; verified?: number } | undefined;
  if (!row?.id) return json({ error: "Blood bank not found" }, { status: 404 });

  const verified = body.verified === false ? 0 : 1;
  const now = nowIso();

  db.prepare(
    "UPDATE blood_banks SET verified = ?, last_verified_at = ?, updated_at = ? WHERE id = ?",
  ).run(verified, verified ? now : null, now, row.id);

  db.prepare(
    `INSERT INTO audit_logs (id, action, subject_kind, subject_id, actor, metadata, created_at)
     VALUES (?, ?, 'blood_bank', ?, 'admin', ?, ?)`,
  ).run(
    newId("audit"),
    verified ? "blood_bank.verify" : "blood_bank.unverify",
    row.id,
    JSON.stringify({ verified: Boolean(verified), notes: typeof body.notes === "string" ? body.notes.slice(0, 300) : null }),
    now,
  );

  return json({ id: row.id, verified: Boolean(verified) });
});
