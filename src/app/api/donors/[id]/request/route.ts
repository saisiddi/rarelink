import { getDb, newId, nowIso } from "@/lib/db";
import { badRequest, guard, json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Privacy-preserving contact request.
 *
 * The requester leaves their own handle + note. The donor's contact details
 * are never returned — the donor decides whether to respond.
 */
export const POST = guard(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id: donorId } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return badRequest("Invalid JSON body");
  }

  const db = getDb();
  const donor = db
    .prepare(
      `SELECT id, verification_status, emergency_notifications, city
       FROM donors WHERE id = ?`,
    )
    .get(donorId) as Record<string, string | number> | undefined;

  if (!donor) return badRequest("Donor not found", { id: donorId });
  if (String(donor.verification_status) === "SUSPENDED") {
    return json({ error: "This donor is not accepting requests" }, { status: 403 });
  }
  if (Number(donor.emergency_notifications) !== 1) {
    return json({ error: "This donor has opted out of emergency notifications" }, { status: 403 });
  }

  const note = typeof body.note === "string" ? body.note.trim().slice(0, 300) : null;
  const handle = typeof body.handle === "string" ? body.handle.trim().slice(0, 60) : null;
  if (!handle) return badRequest("handle is required (a phone number or email the donor can reply to)");

  const requestId =
    typeof body.requestId === "string" && body.requestId.trim()
      ? body.requestId.trim()
      : null;
  if (requestId) {
    const exists = db.prepare("SELECT id FROM emergency_requests WHERE id = ?").get(requestId);
    if (!exists) return badRequest("requestId does not match an emergency request");
  }

  const id = newId("dreq");
  db.prepare(
    `INSERT INTO donor_requests (id, donor_id, request_id, requester_note, requester_city, requester_handle, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
  ).run(id, donorId, requestId, note, typeof body.city === "string" ? body.city.slice(0, 60) : null, handle, nowIso());

  return json(
    {
      id,
      status: "PENDING",
      message: "Request sent. The donor decides whether to share contact details — nothing is revealed automatically.",
    },
    { status: 201 },
  );
});
