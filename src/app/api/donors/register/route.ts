import { getDb, newId, nowIso } from "@/lib/db";
import { badRequest, guard, json } from "@/lib/api";
import { normalizeBloodGroup } from "@/lib/blood/compatibility";
import { resolvePlace } from "@/lib/geo/places";
import { isAiConfigured } from "@/lib/ai/openrouter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RegisterBody {
  displayName?: unknown;
  bloodGroup?: unknown;
  city?: unknown;
  state?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  phone?: unknown;
  email?: unknown;
  preferredContactMethod?: unknown;
  emergencyNotifications?: unknown;
  consent?: unknown;
}

export const POST = guard(async (req: Request) => {
  let body: RegisterBody;
  try {
    body = (await req.json()) as RegisterBody;
  } catch {
    return badRequest("Invalid JSON body");
  }

  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
  if (displayName.length < 2 || displayName.length > 60) {
    return badRequest("displayName must be 2-60 characters");
  }

  const blood = typeof body.bloodGroup === "string" ? normalizeBloodGroup(body.bloodGroup) : null;
  if (!blood) return badRequest("bloodGroup is not a recognised group");

  const cityInput = typeof body.city === "string" ? body.city.trim() : "";
  if (!cityInput) return badRequest("city is required");
  const place = resolvePlace(cityInput);
  const city = place?.name ?? cityInput.slice(0, 60);
  const state = place?.state ?? (typeof body.state === "string" ? body.state.trim().slice(0, 60) : "India");

  const lat = typeof body.latitude === "number" ? body.latitude : place?.latitude ?? null;
  const lon = typeof body.longitude === "number" ? body.longitude : place?.longitude ?? null;
  if (lat === null || lon === null) {
    return badRequest("Could not resolve a location — provide a city or coordinates");
  }

  if (body.consent !== true) {
    return badRequest("consent must be true to register as a donor");
  }

  const contactMethods = ["SMS", "WHATSAPP", "CALL", "EMAIL"];
  const method =
    typeof body.preferredContactMethod === "string" &&
    contactMethods.includes(body.preferredContactMethod.toUpperCase())
      ? body.preferredContactMethod.toUpperCase()
      : "SMS";

  const phone =
    typeof body.phone === "string" && body.phone.trim()
      ? body.phone.trim().replace(/[^\d+ ]/g, "").slice(0, 20)
      : null;
  const email =
    typeof body.email === "string" && body.email.includes("@")
      ? body.email.trim().toLowerCase().slice(0, 120)
      : null;
  if (!phone && !email) return badRequest("Provide a phone number or email so you can be reached");

  const db = getDb();
  const id = newId("donor");
  const now = nowIso();

  db.prepare(
    `INSERT INTO donors
      (id, display_name, blood_group, rare_phenotype, city, district, state, latitude, longitude,
       availability_status, verification_status, verification_label, last_donation_date, eligible_from,
       consent_status, consent_at, last_verified_at, preferred_contact_method, emergency_notifications,
       contact_phone, contact_email, is_demo, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE', 'PENDING', ?, NULL, NULL,
             'GRANTED', ?, NULL, ?, ?, ?, ?, 0, ?, ?)`,
  ).run(
    id,
    displayName,
    blood.code,
    blood.isRare ? blood.label : null,
    city,
    city,
    state,
    lat,
    lon,
    // Self-declared groups are never presented as medically confirmed.
    "Self-reported",
    now,
    method,
    body.emergencyNotifications === false ? 0 : 1,
    phone,
    email,
    now,
    now,
  );

  db.prepare(
    `INSERT INTO verification_records (id, subject_kind, subject_id, method, previous_state, new_state, actor, notes, created_at)
     VALUES (?, 'donor', ?, 'self_registration', NULL, 'PENDING', 'donor', 'Registered via RARELINK', ?)`,
  ).run(newId("ver"), id, now);

  return json(
    {
      id,
      status: "PENDING",
      message:
        "Registered as a self-reported donor. Your blood group must be confirmed by a blood bank before you are shown as verified.",
      privacy:
        "Your contact details are stored privately and are never shown in search results.",
    },
    { status: 201 },
  );
});

export const GET = guard(async () => {
  return json({
    aiConfigured: isAiConfigured(),
    requires: ["displayName", "bloodGroup", "city", "phone or email", "consent: true"],
  });
});
