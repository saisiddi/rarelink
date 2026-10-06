import { getDb, nowIso, newId } from "@/lib/db";
import { badRequest, guard, json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ACTIONS = new Set(["verify", "suspend", "expire", "pending"]);

export const POST = guard(async (req: Request) => {
  let body: { id?: unknown; action?: unknown; notes?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return badRequest("Invalid JSON body");
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  const action = typeof body.action === "string" ? body.action.toLowerCase() : "";
  if (!id) return badRequest("id is required");
  if (!ALLOWED_ACTIONS.has(action)) return badRequest(`action must be one of: ${[...ALLOWED_ACTIONS].join(", ")}`);

  const next =
    action === "verify" ? "VERIFIED" : action === "suspend" ? "SUSPENDED" : action === "expire" ? "EXPIRED" : "PENDING";

  const db = getDb();
  const row = db
    .prepare("SELECT id, verification_status, blood_group FROM donors WHERE id = ?")
    .get(id) as { id?: string; verification_status?: string; blood_group?: string } | undefined;
  if (!row?.id) return json({ error: "Donor not found" }, { status: 404 });

  const now = nowIso();
  db.prepare(
    "UPDATE donors SET verification_status = ?, verification_label = ?, last_verified_at = ?, updated_at = ? WHERE id = ?",
  ).run(
    next,
    // A blood-bank/admin check upgrades the label; suspension does not.
    next === "VERIFIED" ? "Blood-bank verified" : next === "PENDING" ? "Self-reported" : "Expired",
    next === "VERIFIED" ? now : null,
    now,
    row.id,
  );

  db.prepare(
    `INSERT INTO verification_records (id, subject_kind, subject_id, method, previous_state, new_state, actor, notes, created_at)
     VALUES (?, 'donor', ?, 'admin', ?, ?, 'admin', ?, ?)`,
  ).run(
    newId("ver"),
    row.id,
    row.verification_status ?? "PENDING",
    next,
    typeof body.notes === "string" ? body.notes.slice(0, 300) : null,
    now,
  );

  db.prepare(
    `INSERT INTO audit_logs (id, action, subject_kind, subject_id, actor, metadata, created_at)
     VALUES (?, ?, 'donor', ?, 'admin', ?, ?)`,
  ).run(
    newId("audit"),
    `donor.${action}`,
    row.id,
    JSON.stringify({ from: row.verification_status ?? "PENDING", to: next }),
    now,
  );

  return json({ id: row.id, status: next });
});
