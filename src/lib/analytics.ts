/**
 * Privacy-safe analytics.
 *
 * Only product events are recorded — no person, device or account is
 * identifiable. What survives is aggregate query shape: which group,
 * component, city and urgency people search for. Nothing here can be joined
 * back to a donor or a patient: no phone, no address, no government ID, no
 * OTP, no API key, no free-text.
 */

import { getDb, newId, nowIso } from "@/lib/db";

const ALLOWED = new Set([
  "search_started",
  "blood_search",
  "donor_search",
  "emergency_created",
  "blood_bank_clicked",
  "call_clicked",
  "directions_clicked",
  "donor_request_sent",
  "request_fulfilled",
]);

export async function track(event: string, metadata?: Record<string, unknown>): Promise<void> {
  if (!ALLOWED.has(event)) return;
  try {
    const db = getDb();
    db.prepare(
      "INSERT INTO analytics_events (id, event, metadata, created_at) VALUES (?, ?, ?, ?)",
    ).run(
      newId("evt"),
      event,
      metadata ? JSON.stringify(sanitise(metadata)) : null,
      nowIso(),
    );
  } catch (err) {
    console.error("[analytics]", err instanceof Error ? err.message : err);
  }
}

/**
 * Drops anything that could identify a person.
 *
 * Key filter: matched twice — once as a raw regex (name/phone/email/patient/
 * address/handle/contact/mobile/OTP/Aadhaar/PAN/passport/licence/secret/
 * token/password/consent) and once against camelCase-split tokens, so that
 * `donorId`, `id_number`, `govtId` and `panNumber` are all caught while a
 * harmless `group`, `city` or `component` survives.
 *
 * Value filter: strings that look like an email address, a phone number or a
 * long digit run (OTP / Aadhaar / PAN) are replaced wholesale, so a value
 * smuggled through a neutral key ("note": "call 9876543210") still never
 * reaches storage.
 */
const DROP_KEY =
  /(name|phone|email|patient|address|identity|handle|contact|mobile|otp|passcode|aadhaar|aadhar|passport|licence|license|secret|token|password|consent)/i;

/** Exact tokens that mark a key as an identifier once camelCase/snake_case is split. */
const DROP_TOKENS = new Set([
  "id",
  "uid",
  "otp",
  "pan",
  "dob",
  "govt",
  "gov",
  "key",
  "auth",
  "pin",
  "session",
  "cookie",
  "bearer",
  "voter",
  "ration",
  "driving",
]);

function keyIsSafe(key: string): boolean {
  if (DROP_KEY.test(key)) return false;
  const tokens = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .map((t) => t.toLowerCase())
    .filter(Boolean);
  return !tokens.some((t) => DROP_TOKENS.has(t));
}

const EMAILISH = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const DIGITISH = /\+?\d[\d\s().-]{6,}\d|\d{7,}/;

function scrub(value: string): string {
  if (EMAILISH.test(value) || DIGITISH.test(value)) return "[redacted]";
  return value.slice(0, 60);
}

export function sanitise(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (!keyIsSafe(k)) continue;
    if (v === null || typeof v === "number" || typeof v === "boolean") {
      out[k] = v;
    } else if (typeof v === "string") {
      out[k] = scrub(v);
    }
    // Objects, arrays and functions are dropped rather than serialised.
  }
  return out;
}

export function dashboardStats() {
  const db = getDb();
  const one = <T>(sql: string, ...params: Array<string | number>): T | undefined =>
    db.prepare(sql).get(...params) as T | undefined;

  return {
    activeEmergencies: Number(
      (one<{ n: number }>(
        "SELECT COUNT(*) AS n FROM emergency_requests WHERE status IN ('OPEN','MATCHING','PARTIALLY_MATCHED')",
      )?.n ?? 0),
    ),
    availableUnits: Number(
      (one<{ n: number }>(
        "SELECT COALESCE(SUM(units_available),0) AS n FROM blood_inventory WHERE availability_status IN ('AVAILABLE','LOW')",
      )?.n ?? 0),
    ),
    rareDonors: Number(
      (one<{ n: number }>(
        "SELECT COUNT(*) AS n FROM donors WHERE rare_phenotype IS NOT NULL AND verification_status = 'VERIFIED'",
      )?.n ?? 0),
    ),
    verifiedDonors: Number(
      (one<{ n: number }>("SELECT COUNT(*) AS n FROM donors WHERE verification_status = 'VERIFIED'")
        ?.n ?? 0),
    ),
    staleInventory: Number(
      (one<{ n: number }>(
        "SELECT COUNT(*) AS n FROM blood_inventory WHERE availability_status = 'STALE'",
      )?.n ?? 0),
    ),
    pendingVerification: Number(
      (one<{ n: number }>("SELECT COUNT(*) AS n FROM donors WHERE verification_status = 'PENDING'")
        ?.n ?? 0),
    ),
    bloodBanks: Number((one<{ n: number }>("SELECT COUNT(*) AS n FROM blood_banks")?.n ?? 0)),
    donors: Number((one<{ n: number }>("SELECT COUNT(*) AS n FROM donors")?.n ?? 0)),
    emergencyRequests: Number(
      (one<{ n: number }>("SELECT COUNT(*) AS n FROM emergency_requests")?.n ?? 0),
    ),
    searchEvents: Number(
      (one<{ n: number }>(
        "SELECT COUNT(*) AS n FROM analytics_events WHERE event IN ('blood_search','donor_search')",
      )?.n ?? 0),
    ),
  };
}
