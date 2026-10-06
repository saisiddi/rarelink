/**
 * The emergency search engine.
 *
 * Pipeline (deterministic end to end — the LLM only ever calls this):
 *   resolve location → bounding-box fetch → compatibility filter
 *   → freshness/verification scoring → rank → actionable result cards
 */

import type {
  AvailabilityStatus,
  BloodBank,
  BloodComponent,
  BloodGroup,
  Donor,
  GeoPoint,
  SearchQuery,
  SearchResult,
} from "@/lib/types";
import { getDb, bool, nowIso } from "@/lib/db";
import { checkCompatibility, isRareGroup, bloodGroupLabel } from "@/lib/blood/compatibility";
import {
  computeFreshness,
  effectiveAvailability,
  freshnessLabel,
} from "@/lib/blood/freshness";
import { boundingBox, formatDistance, haversineKm } from "@/lib/geo/distance";
import { resolvePlace } from "@/lib/geo/places";
import { getGeocoder } from "@/lib/geocoding";
import { rank, scoreCandidate } from "@/lib/ranking";
import { aggregateInventory } from "@/lib/providers/registry";
import type { AggregatedInventory } from "@/lib/providers/types";

const DEFAULT_RADIUS_KM = 50;

/** Components assumed when the request names a group but not a component. */
const RED_CELL_COMPONENTS: readonly BloodComponent[] = ["PRBC", "WHOLE_BLOOD"];

export interface SearchOutcome {
  query: SearchQuery;
  resolvedCity: string | null;
  resolvedPoint: GeoPoint | null;
  bloodBanks: SearchResult[];
  donors: SearchResult[];
  /** Data-quality notices: staleness, provider failures, source conflicts. */
  notices: string[];
  /** Safety copy — always shown on emergency searches. */
  safety: string[];
  searchedAt: string;
  tookMs: number;
}

// ---------------------------------------------------------------------------
// Location
// ---------------------------------------------------------------------------

export async function resolveSearchLocation(
  query: SearchQuery,
): Promise<{ city: string | null; point: GeoPoint | null; notice?: string }> {
  if (query.location) {
    const geocoder = getGeocoder();
    let city = query.city;
    try {
      const name = await geocoder.reverse(query.location);
      city = city ?? name;
    } catch {
      /* reverse geocoding is best-effort */
    }
    return { city, point: query.location };
  }

  if (query.city) {
    const direct = resolvePlace(query.city);
    if (direct) return { city: direct.name, point: { latitude: direct.latitude, longitude: direct.longitude } };
    try {
      const geocoded = await getGeocoder().geocode(query.city);
      if (geocoded) {
        return { city: geocoded.name, point: { latitude: geocoded.latitude, longitude: geocoded.longitude } };
      }
    } catch {
      /* fall through */
    }
    return { city: query.city, point: null, notice: `No coordinates found for "${query.city}" — results are sorted by directory order, not distance.` };
  }

  return { city: null, point: null };
}

// ---------------------------------------------------------------------------
// Blood banks + inventory
// ---------------------------------------------------------------------------

function fetchBanks(opts: {
  city: string | null;
  point: GeoPoint | null;
  radiusKm: number;
  limit?: number;
}): BloodBank[] {
  const db = getDb();
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (opts.point) {
    const box = boundingBox(opts.point, opts.radiusKm);
    where.push("latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?");
    params.push(box.minLat, box.maxLat, box.minLon, box.maxLon);
  } else if (opts.city) {
    where.push("LOWER(city) = LOWER(?)");
    params.push(opts.city);
  }

  const sql = `SELECT * FROM blood_banks
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY verified DESC, name ASC
    LIMIT ?`;
  params.push(opts.limit ?? 200);

  const rows = db.prepare(sql).all(...params) as Record<string, string | number>[];
  return rows.map(mapBankRow);
}

function mapBankRow(row: Record<string, string | number>): BloodBank {
  return {
    id: String(row.id),
    name: String(row.name),
    hospitalName: row.hospital_name ? String(row.hospital_name) : null,
    address: String(row.address),
    city: String(row.city),
    district: row.district ? String(row.district) : null,
    state: String(row.state),
    pincode: row.pincode ? String(row.pincode) : null,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    phone: row.phone ? String(row.phone) : null,
    emergencyPhone: row.emergency_phone ? String(row.emergency_phone) : null,
    email: row.email ? String(row.email) : null,
    website: row.website ? String(row.website) : null,
    category: String(row.category) as BloodBank["category"],
    licenseNumber: row.license_number ? String(row.license_number) : null,
    componentsSupported: safeJson<BloodComponent[]>(row.components_supported, []),
    apheresisAvailable: bool(row.apheresis_available),
    openingHours: row.opening_hours ? String(row.opening_hours) : null,
    emergency24x7: bool(row.emergency_24x7),
    source: String(row.source),
    sourceId: row.source_id ? String(row.source_id) : null,
    verified: bool(row.verified),
    isDemo: bool(row.is_demo),
    lastVerifiedAt: row.last_verified_at ? String(row.last_verified_at) : null,
    lastInventoryUpdate: row.last_inventory_update ? String(row.last_inventory_update) : null,
  };
}

function safeJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

interface ResultContext {
  point: GeoPoint | null;
  recipient: BloodGroup | null;
  component: BloodComponent | null;
  urgency: SearchQuery["urgency"];
  radiusKm: number;
}

/**
 * Wording for components the compatibility engine will not assert outright —
 * they are plausible matches that still need a blood-bank decision.
 */
const COMPONENT_ESCALATION_NOTES: Partial<Record<BloodComponent, string>> = {
  PLATELETS:
    "Platelets are selected ABO-preferred (RhD-negative for RhD-negative recipients) — confirm this match with the blood bank.",
  CRYO: "Cryoprecipitate is generally ABO-non-specific; local blood-bank policy applies — confirm before transfusion.",
};

function bankToResult(bank: BloodBank, inventory: AggregatedInventory | null, ctx: ResultContext): SearchResult {
  const distanceKm = ctx.point
    ? haversineKm(ctx.point, { latitude: bank.latitude, longitude: bank.longitude })
    : null;

  const freshness = computeFreshness(inventory?.lastUpdatedAt ?? bank.lastInventoryUpdate);
  const rawStatus: AvailabilityStatus | null = inventory
    ? effectiveAvailability(inventory.availabilityStatus, freshness)
    : "UNKNOWN";
  const group = inventory?.bloodGroup ?? ctx.recipient;
  const component = inventory?.component ?? ctx.component;

  const notes: string[] = [];
  if (!inventory) {
    notes.push("No matching inventory record — call the blood bank to confirm availability.");
  } else if (freshness === "STALE" || freshness === "OUTDATED") {
    notes.push(freshnessLabel(freshness, inventory.lastUpdatedAt));
  }
  if (inventory?.conflicting) {
    const detail = (inventory.conflictWith ?? [])
      .map((c) => `${c.source}: ${c.units} units (${c.status})`)
      .join(" · ");
    notes.push(`Availability differs between sources — ${detail}. Please call the blood bank to confirm.`);
  }
  if (group && isRareGroup(group)) {
    notes.push("Rare phenotype — compatibility must be confirmed by a qualified blood bank.");
  }
  // Components where the engine only says "probably, ask the blood bank".
  if (inventory && ctx.recipient && !isRareGroup(ctx.recipient)) {
    const compat = checkCompatibility(ctx.recipient, component ?? "PRBC");
    if (compat.confidence === "confirmation_required") {
      notes.push(
        (component && COMPONENT_ESCALATION_NOTES[component]) ??
          "Compatibility for this component must be confirmed by the blood bank before transfusion.",
      );
    }
  }

  const result: SearchResult = {
    kind: inventory ? "inventory" : "blood_bank",
    id: `${bank.id}${inventory ? `:${inventory.id}` : ""}`,
    key: `${bank.id}:${inventory?.id ?? "no-inv"}`,
    title: bank.name,
    subtitle: bank.hospitalName,
    bloodGroup: group,
    component,
    unitsAvailable: inventory?.unitsAvailable ?? null,
    availabilityStatus: rawStatus,
    freshness,
    lastUpdatedAt: inventory?.lastUpdatedAt ?? bank.lastInventoryUpdate,
    distanceKm,
    city: bank.city,
    address: bank.address,
    phone: bank.phone,
    emergencyPhone: bank.emergencyPhone,
    verified: bank.verified,
    verificationLabel: bank.verified ? "Verified directory entry" : "Not yet verified",
    source: inventory?.source ?? bank.source,
    isDemo: bank.isDemo,
    emergency24x7: bank.emergency24x7,
    score: 0,
    scoreBreakdown: { availability: 0, freshness: 0, proximity: 0, verification: 0, emergencyCapability: 0, rareBoost: 0, total: 0 },
    notes,
    rareMatch: group ? isRareGroup(group) : false,
    coordinates: { latitude: bank.latitude, longitude: bank.longitude },
  };

  result.scoreBreakdown = scoreCandidate(
    {
      availabilityStatus: rawStatus,
      freshness,
      lastUpdatedAt: result.lastUpdatedAt,
      distanceKm,
      verified: bank.verified,
      emergency24x7: bank.emergency24x7,
      unitsAvailable: inventory?.unitsAvailable ?? null,
      rareMatch: result.rareMatch,
      urgency: ctx.urgency,
    },
    ctx.radiusKm,
  );
  result.score = result.scoreBreakdown.total;
  return result;
}

// ---------------------------------------------------------------------------
// Donors
// ---------------------------------------------------------------------------

/**
 * Public donor projection — deliberately excludes `contact_phone` /
 * `contact_email` so private fields can never leak through `SELECT *`.
 */
const DONOR_PUBLIC_COLUMNS = `
  id, display_name, blood_group, rare_phenotype, city, district, state,
  latitude, longitude, availability_status, verification_status,
  verification_label, last_donation_date, eligible_from, last_verified_at,
  preferred_contact_method, emergency_notifications, is_demo`;

function fetchDonors(opts: {
  groups: BloodGroup[] | null;
  city: string | null;
  point: GeoPoint | null;
  radiusKm: number;
  requireNotifications: boolean;
  includeIneligible: boolean;
}): Donor[] {
  const db = getDb();
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (opts.groups && opts.groups.length > 0) {
    where.push(`blood_group IN (${opts.groups.map(() => "?").join(",")})`);
    params.push(...opts.groups);
  }
  if (opts.point) {
    const box = boundingBox(opts.point, opts.radiusKm);
    where.push("latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?");
    params.push(box.minLat, box.maxLat, box.minLon, box.maxLon);
  } else if (opts.city) {
    where.push("LOWER(city) = LOWER(?)");
    params.push(opts.city);
  }
  where.push("consent_status = 'GRANTED'");
  where.push("verification_status <> 'SUSPENDED'");
  if (opts.requireNotifications) where.push("emergency_notifications = 1");
  if (!opts.includeIneligible) where.push("(eligible_from IS NULL OR eligible_from <= ?)");
  if (!opts.includeIneligible) params.push(nowIso());
  where.push("availability_status <> 'UNAVAILABLE'");

  const sql = `SELECT ${DONOR_PUBLIC_COLUMNS} FROM donors ${where.length ? `WHERE ${where.join(" AND ")}` : ""} LIMIT 300`;
  const rows = db.prepare(sql).all(...params) as Record<string, string | number>[];
  return rows.map(mapDonorRow);
}

function mapDonorRow(row: Record<string, string | number>): Donor {
  return {
    id: String(row.id),
    displayName: String(row.display_name),
    bloodGroup: String(row.blood_group) as BloodGroup,
    rarePhenotype: row.rare_phenotype ? String(row.rare_phenotype) : null,
    city: String(row.city),
    district: row.district ? String(row.district) : null,
    state: String(row.state),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    availabilityStatus: String(row.availability_status) as Donor["availabilityStatus"],
    verificationStatus: String(row.verification_status) as Donor["verificationStatus"],
    verificationLabel: String(row.verification_label) as Donor["verificationLabel"],
    lastDonationDate: row.last_donation_date ? String(row.last_donation_date) : null,
    eligibleFrom: row.eligible_from ? String(row.eligible_from) : null,
    lastVerifiedAt: row.last_verified_at ? String(row.last_verified_at) : null,
    preferredContactMethod: String(row.preferred_contact_method) as Donor["preferredContactMethod"],
    emergencyNotifications: bool(row.emergency_notifications),
    isDemo: bool(row.is_demo),
  };
}

function donorToResult(
  donor: Donor,
  opts: { point: GeoPoint | null; radiusKm: number; urgency: SearchQuery["urgency"] },
): SearchResult {
  const distanceKm = opts.point
    ? haversineKm(opts.point, { latitude: donor.latitude, longitude: donor.longitude })
    : null;
  const freshness = computeFreshness(donor.lastVerifiedAt);
  const verified = donor.verificationStatus === "VERIFIED";
  const notes: string[] = [];

  if (!verified) {
    notes.push("Self-reported — blood group not yet confirmed by a blood bank.");
  }
  if (donor.availabilityStatus === "LIMITED") {
    notes.push("Donor marked availability as limited.");
  }
  if (donor.eligibleFrom && Date.parse(donor.eligibleFrom) > Date.now()) {
    notes.push(`Next eligible donation after ${new Date(donor.eligibleFrom).toLocaleDateString("en-IN")}.`);
  }
  if (donor.rarePhenotype) {
    notes.push("Rare phenotype — confirm with the blood bank before arranging transfusion.");
  }

  const result: SearchResult = {
    kind: "donor",
    id: donor.id,
    key: donor.id,
    title: `${verified ? "Verified" : "Registered"} ${bloodGroupLabel(donor.bloodGroup)} donor`,
    subtitle: donor.displayName,
    bloodGroup: donor.bloodGroup,
    component: null,
    unitsAvailable: null,
    availabilityStatus: donor.availabilityStatus === "AVAILABLE" ? "AVAILABLE" : donor.availabilityStatus === "LIMITED" ? "LOW" : "UNAVAILABLE",
    freshness,
    lastUpdatedAt: donor.lastVerifiedAt,
    distanceKm,
    // Privacy: area-level only. No address, no exact coordinates.
    address: `${donor.city}, ${donor.state}`,
    city: donor.city,
    phone: null,
    emergencyPhone: null,
    verified,
    verificationLabel: donor.verificationLabel,
    source: donor.isDemo ? "demo" : "RARELINK donor registry",
    isDemo: donor.isDemo,
    emergency24x7: false,
    score: 0,
    scoreBreakdown: { availability: 0, freshness: 0, proximity: 0, verification: 0, emergencyCapability: 0, rareBoost: 0, total: 0 },
    notes,
    rareMatch: Boolean(donor.rarePhenotype),
    // Map marker only — rounded to ~1 km, never an address.
    coordinates: {
      latitude: Math.round(donor.latitude * 100) / 100,
      longitude: Math.round(donor.longitude * 100) / 100,
    },
  };

  result.scoreBreakdown = scoreCandidate(
    {
      availabilityStatus: result.availabilityStatus,
      freshness,
      lastUpdatedAt: donor.lastVerifiedAt,
      distanceKm,
      verified,
      emergency24x7: false,
      rareMatch: result.rareMatch,
      urgency: opts.urgency,
    },
    opts.radiusKm,
  );
  result.score = result.scoreBreakdown.total;
  return result;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export async function runSearch(query: SearchQuery): Promise<SearchOutcome> {
  const started = Date.now();
  const notices: string[] = [];
  const safety: string[] = [];

  const radiusKm = query.radiusKm > 0 ? query.radiusKm : DEFAULT_RADIUS_KM;
  const location = await resolveSearchLocation(query);
  if (location.notice) notices.push(location.notice);

  const wantsInventory = query.intent === "find_blood" || query.intent === "emergency_request";
  const wantsBanks =
    wantsInventory ||
    query.intent === "find_blood_bank" ||
    query.intent === "nearby_blood_bank";
  const wantsDonors =
    query.intent === "find_donor" ||
    query.intent === "emergency_request" ||
    query.intent === "find_blood";

  const banks = fetchBanks({
    city: location.city,
    point: location.point,
    radiusKm,
    limit: 200,
  });

  if (banks.length === 0 && location.city) {
    notices.push(`No blood banks found in the directory for ${location.city}. Try a larger radius or a nearby city.`);
  }

  // --- inventory -----------------------------------------------------------
  const bankResults: SearchResult[] = [];
  if (wantsBanks) {
    // A request that names a blood group but no component means red cells —
    // the same default the donor search uses. Platelets, plasma and cryo are
    // only searched when they are asked for (the parser recognises them).
    const wantedComponents: Set<BloodComponent> | null = query.component
      ? new Set<BloodComponent>([query.component])
      : query.bloodGroup
        ? new Set<BloodComponent>(RED_CELL_COMPONENTS)
        : null;

    if (query.bloodGroup && !query.component) {
      notices.push(
        "No component named — showing red cells. Use the component filter for platelets or plasma.",
      );
    }

    const aggregation = await aggregateInventory({});
    for (const issue of aggregation.issues) {
      notices.push(`${issue.source} is unavailable right now (${issue.error}).`);
    }

    const bankIds = new Set(banks.map((b) => b.id));
    const relevant = aggregation.records.filter((r) => bankIds.has(r.bloodBankId));

    const bestByBank = new Map<string, AggregatedInventory>();
    for (const record of relevant) {
      if (wantedComponents && !wantedComponents.has(record.component)) continue;
      if (query.bloodGroup) {
        const compat = checkCompatibility(query.bloodGroup, record.component);
        if (!compat.candidates.includes(record.bloodGroup)) continue;
      }

      const current = bestByBank.get(record.bloodBankId);
      if (!current) {
        bestByBank.set(record.bloodBankId, record);
        continue;
      }
      // Prefer the record with better availability + freshness for this bank.
      const curScore = rankScore(current, radiusKm, query.urgency);
      const newScore = rankScore(record, radiusKm, query.urgency);
      if (newScore > curScore) bestByBank.set(record.bloodBankId, record);
    }

    const conflicts = aggregation.records.filter((r) => r.conflicting && bankIds.has(r.bloodBankId));
    if (conflicts.length > 0) {
      notices.push(
        "Availability differs between sources for some blood banks. Please call to confirm.",
      );
    }

    for (const bank of banks) {
      bankResults.push(
        bankToResult(bank, bestByBank.get(bank.id) ?? null, {
          point: location.point,
          recipient: query.bloodGroup,
          component: query.component,
          urgency: query.urgency,
          radiusKm,
        }),
      );
    }
  }

  // --- donors --------------------------------------------------------------
  const donorResults: SearchResult[] = [];
  if (wantsDonors) {
    let groups: BloodGroup[] | null = null;
    if (query.bloodGroup) {
      groups = checkCompatibility(query.bloodGroup, query.component ?? "PRBC").candidates;
      // Never widen a rare request to ordinary groups.
      if (isRareGroup(query.bloodGroup)) groups = [query.bloodGroup];
    }

    const donors = fetchDonors({
      groups,
      city: location.city,
      point: location.point,
      radiusKm,
      requireNotifications: query.urgency === "emergency",
      includeIneligible: false,
    });

    for (const donor of donors) {
      donorResults.push(
        donorToResult(donor, { point: location.point, radiusKm, urgency: query.urgency }),
      );
    }
  }

  const bloodBanks = rank(bankResults, radiusKm);
  const donors = rank(donorResults, radiusKm);

  // --- safety --------------------------------------------------------------
  safety.push("Blood availability can change rapidly. Please call the blood bank or hospital before travelling.");
  if (query.bloodGroup && isRareGroup(query.bloodGroup)) {
    safety.push("Rare blood compatibility must be confirmed by a qualified blood bank / transfusion service.");
  }
  if (query.urgency === "emergency") {
    safety.push("If someone is in immediate danger, contact emergency medical services or the treating hospital now.");
  }

  const stale = bloodBanks.filter((b) => b.freshness === "STALE" || b.freshness === "OUTDATED");
  if (stale.length > 0) {
    notices.push(`${stale.length} result${stale.length > 1 ? "s are" : " is"} based on older data — call to confirm.`);
  }

  return {
    query: { ...query, radiusKm },
    resolvedCity: location.city,
    resolvedPoint: location.point,
    bloodBanks: bloodBanks.slice(0, 24),
    donors: donors.slice(0, 24),
    notices,
    safety,
    searchedAt: new Date().toISOString(),
    tookMs: Date.now() - started,
  };
}

function rankScore(
  record: AggregatedInventory,
  radiusKm: number,
  urgency: SearchQuery["urgency"],
): number {
  return scoreCandidate(
    {
      availabilityStatus: effectiveAvailability(
        record.availabilityStatus,
        computeFreshness(record.lastUpdatedAt),
      ),
      freshness: computeFreshness(record.lastUpdatedAt),
      lastUpdatedAt: record.lastUpdatedAt,
      distanceKm: null,
      verified: true,
      emergency24x7: true,
      unitsAvailable: record.unitsAvailable,
      urgency,
    },
    radiusKm,
  ).total;
}

/** Distance formatting re-exported so API routes and UI agree. */
export { formatDistance };

/** Strip anything private before a payload leaves the server. */
export function publicResult(result: SearchResult): SearchResult {
  const clone: SearchResult = { ...result };
  if (clone.kind === "donor") {
    // Donor coordinates are already coarse; round them to ~1 km anyway and
    // never send the phone/consent fields (they are not on this object).
    if (clone.coordinates) {
      clone.coordinates = {
        latitude: Math.round(clone.coordinates.latitude * 100) / 100,
        longitude: Math.round(clone.coordinates.longitude * 100) / 100,
      };
    }
  }
  return clone;
}
