import { getDb, newId, nowIso } from "@/lib/db";
import { badRequest, guard, json } from "@/lib/api";
import { normalizeBloodGroup } from "@/lib/blood/compatibility";
import { resolvePlace } from "@/lib/geo/places";
import { runSearch, publicResult, formatDistance } from "@/lib/search";
import { track } from "@/lib/analytics";
import type { BloodComponent, SearchQuery, Urgency } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COMPONENTS = new Set([
  "WHOLE_BLOOD",
  "PRBC",
  "PLATELETS",
  "SDP",
  "FFP",
  "CRYO",
  "GRANULOCYTES",
]);

function requestCode(): string {
  return `RL-${Math.floor(1000 + Math.random() * 9000)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

/** Create an emergency request and immediately run the deterministic matcher. */
export const POST = guard(async (req: Request) => {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return badRequest("Invalid JSON body");
  }

  const blood =
    typeof body.bloodGroup === "string" ? normalizeBloodGroup(body.bloodGroup) : null;
  if (!blood) return badRequest("bloodGroup is required and must be valid");

  const component =
    typeof body.component === "string" && COMPONENTS.has(body.component.toUpperCase())
      ? (body.component.toUpperCase() as BloodComponent)
      : "PRBC";

  const cityInput = typeof body.city === "string" ? body.city.trim() : "";
  const place = cityInput ? resolvePlace(cityInput) : null;
  const city = place?.name ?? (cityInput ? cityInput.slice(0, 60) : null);
  if (!city) return badRequest("city is required");

  const units = Math.max(1, Math.min(50, Math.floor(Number(body.units ?? 1) || 1)));
  const urgency: Urgency =
    body.urgency === "urgent" || body.urgency === "routine" ? body.urgency : "emergency";

  // Minimal data on purpose — we never ask for patient identity.
  const contact =
    typeof body.contact === "string" && body.contact.trim()
      ? body.contact.trim().slice(0, 60)
      : null;
  if (!contact) return badRequest("contact is required (a phone number or email)");

  const db = getDb();
  const id = newId("emr");
  const now = nowIso();
  const neededBy =
    typeof body.neededBy === "string" && !Number.isNaN(Date.parse(body.neededBy))
      ? new Date(body.neededBy).toISOString()
      : new Date(Date.now() + 6 * 3600_000).toISOString();

  db.prepare(
    `INSERT INTO emergency_requests
      (id, request_code, patient_reference, blood_group, component, units_required, units_found,
       rare_phenotype, hospital_name, hospital_address, latitude, longitude, city, urgency,
       needed_by, status, contact_handle, created_by, created_at, updated_at)
     VALUES (?, ?, NULL, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, 'requester', ?, ?)`,
  ).run(
    id,
    requestCode(),
    blood.code,
    component,
    units,
    blood.isRare ? blood.label : null,
    typeof body.hospitalName === "string" ? body.hospitalName.trim().slice(0, 120) : null,
    typeof body.hospitalAddress === "string" ? body.hospitalAddress.trim().slice(0, 240) : null,
    place?.latitude ?? null,
    place?.longitude ?? null,
    city,
    urgency,
    neededBy,
    contact,
    now,
    now,
  );

  // --- deterministic matching (never LLM logic) ---------------------------
  const query: SearchQuery = {
    bloodGroup: blood.code,
    component,
    quantity: units,
    city,
    location: place ? { latitude: place.latitude, longitude: place.longitude } : null,
    radiusKm: urgency === "emergency" ? 50 : 25,
    urgency,
    rareBlood: blood.isRare,
    intent: "emergency_request",
  };
  const outcome = await runSearch(query);

  const matches: Array<{
    kind: "blood_bank" | "donor";
    id: string;
    distanceKm: number | null;
    score: number;
  }> = [];

  const insertMatch = db.prepare(
    `INSERT INTO donor_matches (id, request_id, candidate_kind, candidate_id, distance_km, score, notified_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  for (const bank of outcome.bloodBanks.filter((b) => b.availabilityStatus === "AVAILABLE").slice(0, 5)) {
    const candidateId = bank.id.split(":")[0]!;
    matches.push({ kind: "blood_bank", id: candidateId, distanceKm: bank.distanceKm, score: bank.score });
    insertMatch.run(
      newId("match"),
      id,
      "blood_bank",
      candidateId,
      bank.distanceKm,
      bank.score,
      now,
      now,
    );
  }
  for (const donor of outcome.donors.slice(0, 8)) {
    matches.push({ kind: "donor", id: donor.id, distanceKm: donor.distanceKm, score: donor.score });
    insertMatch.run(
      newId("match"),
      id,
      "donor",
      donor.id,
      donor.distanceKm,
      donor.score,
      // Only verified, notification-consenting donors are alerted.
      donor.verified ? now : null,
      now,
    );
  }

  db.prepare("UPDATE emergency_requests SET status = ?, updated_at = ? WHERE id = ?").run(
    matches.length > 0 ? "MATCHING" : "OPEN",
    now,
    id,
  );

  await track("emergency_created", { group: blood.code, component, city, urgency });

  return json(
    {
      id,
      request: {
        id,
        bloodGroup: blood.code,
        component,
        unitsRequired: units,
        city,
        urgency,
        neededBy,
        status: matches.length > 0 ? "MATCHING" : "OPEN",
      },
      matches: matches.length,
      bloodBanks: outcome.bloodBanks.slice(0, 6).map(publicResult),
      donors: outcome.donors.slice(0, 6).map(publicResult),
      safety: outcome.safety,
      notices: outcome.notices,
      nearest: outcome.bloodBanks[0]
        ? {
            name: outcome.bloodBanks[0].title,
            distance: formatDistance(outcome.bloodBanks[0].distanceKm),
          }
        : null,
    },
    { status: 201 },
  );
});

export const GET = guard(async (req: Request) => {
  const params = new URL(req.url).searchParams;
  const status = params.get("status");
  const db = getDb();
  const rows = (
    status
      ? db
          .prepare(
            `SELECT id, request_code, blood_group, component, units_required, units_found, city,
                    urgency, status, needed_by, created_at, updated_at
             FROM emergency_requests WHERE status = ? ORDER BY created_at DESC LIMIT 50`,
          )
          .all(status)
      : db
          .prepare(
            `SELECT id, request_code, blood_group, component, units_required, units_found, city,
                    urgency, status, needed_by, created_at, updated_at
             FROM emergency_requests ORDER BY created_at DESC LIMIT 50`,
          )
          .all()
  ) as Record<string, string | number>[];

  return json({
    requests: rows.map((r) => ({
      id: String(r.id),
      requestCode: String(r.request_code),
      bloodGroup: String(r.blood_group),
      component: String(r.component),
      unitsRequired: Number(r.units_required),
      unitsFound: Number(r.units_found),
      city: String(r.city),
      urgency: String(r.urgency),
      status: String(r.status),
      neededBy: r.needed_by ? String(r.needed_by) : null,
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    })),
  });
});
