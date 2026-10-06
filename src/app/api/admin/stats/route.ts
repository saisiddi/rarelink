import { getDb } from "@/lib/db";
import { guard, json } from "@/lib/api";
import { dashboardStats } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin statistics.
 *
 * A production deployment puts OTP/session auth in front of this; for the
 * hackathon build it is read-only and exposes no private donor fields.
 */
export const GET = guard(async () => {
  const db = getDb();
  const staleSince = new Date(Date.now() - 3 * 3600_000).toISOString();

  const staleRows = db
    .prepare(
      `SELECT b.name, b.city, i.blood_group, i.component, i.last_updated_at
       FROM blood_inventory i JOIN blood_banks b ON b.id = i.blood_bank_id
       WHERE i.last_updated_at < ?
       ORDER BY i.last_updated_at ASC LIMIT 8`,
    )
    .all(staleSince) as Record<string, string | number>[];

  const pendingDonors = db
    .prepare(
      `SELECT id, display_name, blood_group, city, verification_status, created_at
       FROM donors WHERE verification_status = 'PENDING'
       ORDER BY created_at DESC LIMIT 8`,
    )
    .all() as Record<string, string | number>[];

  const requests = db
    .prepare(
      `SELECT id, request_code, blood_group, component, city, urgency, status, created_at
       FROM emergency_requests ORDER BY created_at DESC LIMIT 10`,
    )
    .all() as Record<string, string | number>[];

  const audit = db
    .prepare(
      `SELECT action, subject_kind, subject_id, actor, created_at
       FROM audit_logs ORDER BY created_at DESC LIMIT 20`,
    )
    .all() as Record<string, string | number>[];

  return json({
    stats: dashboardStats(),
    staleInventory: staleRows.map((r) => ({
      bank: String(r.name),
      city: String(r.city),
      bloodGroup: String(r.blood_group),
      component: String(r.component),
      lastUpdatedAt: String(r.last_updated_at),
    })),
    pendingDonors: pendingDonors.map((r) => ({
      id: String(r.id),
      // Minimal projection — the admin sees who to verify, not private data.
      displayName: String(r.display_name),
      bloodGroup: String(r.blood_group),
      city: String(r.city),
      status: String(r.verification_status),
      createdAt: String(r.created_at),
    })),
    emergencyRequests: requests.map((r) => ({
      id: String(r.id),
      requestCode: String(r.request_code),
      bloodGroup: String(r.blood_group),
      component: String(r.component),
      city: String(r.city),
      urgency: String(r.urgency),
      status: String(r.status),
      createdAt: String(r.created_at),
    })),
    auditLogs: audit.map((r) => ({
      action: String(r.action),
      subjectKind: r.subject_kind ? String(r.subject_kind) : null,
      subjectId: r.subject_id ? String(r.subject_id) : null,
      actor: r.actor ? String(r.actor) : null,
      createdAt: String(r.created_at),
    })),
  });
});
