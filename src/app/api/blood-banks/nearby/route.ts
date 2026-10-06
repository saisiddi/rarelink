import { getDb } from "@/lib/db";
import { boundingBox, haversineKm } from "@/lib/geo/distance";
import { resolvePlace } from "@/lib/geo/places";
import { computeFreshness, freshnessLabel } from "@/lib/blood/freshness";
import { guard, json, badRequest } from "@/lib/api";
import { mapBank } from "@/lib/providers/local";
import { rank, scoreCandidate } from "@/lib/ranking";
import type { SearchResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = guard(async (req: Request) => {
  const params = new URL(req.url).searchParams;
  const latRaw = params.get("lat");
  const lonRaw = params.get("lon");
  const cityRaw = params.get("city");
  const radius = Math.min(300, Math.max(1, Number(params.get("radius") ?? 25) || 25));

  let point: { latitude: number; longitude: number } | null = null;
  if (latRaw !== null && lonRaw !== null) {
    const lat = Number(latRaw);
    const lon = Number(lonRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return badRequest("lat/lon must be numbers");
    point = { latitude: lat, longitude: lon };
  } else if (cityRaw) {
    const place = resolvePlace(cityRaw);
    if (!place) return badRequest(`Unknown location: ${cityRaw}`);
    point = { latitude: place.latitude, longitude: place.longitude };
  } else {
    return badRequest("Provide lat/lon or city");
  }

  const db = getDb();
  const box = boundingBox(point, radius);
  const rows = db
    .prepare(
      `SELECT * FROM blood_banks
       WHERE latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?
       ORDER BY verified DESC, name ASC
       LIMIT 200`,
    )
    .all(box.minLat, box.maxLat, box.minLon, box.maxLon) as Record<string, string | number>[];

  const banks = rows.map(mapBank);
  const invStmt = db.prepare(
    "SELECT * FROM blood_inventory WHERE blood_bank_id = ? ORDER BY last_updated_at DESC LIMIT 50",
  );

  const results: SearchResult[] = banks.map((bank) => {
    const invRows = invStmt.all(bank.id) as Record<string, string | number>[];
    const freshest = invRows[0];
    const freshness = computeFreshness(
      freshest ? String(freshest.last_updated_at) : bank.lastInventoryUpdate,
    );
    const distanceKm = haversineKm(point!, {
      latitude: bank.latitude,
      longitude: bank.longitude,
    });

    const result: SearchResult = {
      kind: "blood_bank",
      id: bank.id,
      key: bank.id,
      title: bank.name,
      subtitle: bank.hospitalName,
      bloodGroup: freshest ? (String(freshest.blood_group) as SearchResult["bloodGroup"]) : null,
      component: freshest ? (String(freshest.component) as SearchResult["component"]) : null,
      unitsAvailable: freshest ? Number(freshest.units_available) : null,
      availabilityStatus: freshest
        ? (String(freshest.availability_status) as SearchResult["availabilityStatus"])
        : "UNKNOWN",
      freshness,
      lastUpdatedAt: freshest ? String(freshest.last_updated_at) : bank.lastInventoryUpdate,
      distanceKm,
      city: bank.city,
      address: bank.address,
      phone: bank.phone,
      emergencyPhone: bank.emergencyPhone,
      verified: bank.verified,
      verificationLabel: bank.verified ? "Verified directory entry" : "Not yet verified",
      source: bank.source,
      isDemo: bank.isDemo,
      emergency24x7: bank.emergency24x7,
      score: 0,
      scoreBreakdown: {
        availability: 0,
        freshness: 0,
        proximity: 0,
        verification: 0,
        emergencyCapability: 0,
        rareBoost: 0,
        total: 0,
      },
      notes: freshest ? [] : ["No inventory record — call to confirm."],
      coordinates: { latitude: bank.latitude, longitude: bank.longitude },
    };

    result.scoreBreakdown = scoreCandidate(
      {
        availabilityStatus: result.availabilityStatus,
        freshness,
        lastUpdatedAt: result.lastUpdatedAt,
        distanceKm,
        verified: bank.verified,
        emergency24x7: bank.emergency24x7,
        unitsAvailable: result.unitsAvailable,
      },
      radius,
    );
    result.score = result.scoreBreakdown.total;
    return result;
  });

  const ranked = rank(results, radius).map((r) => ({
    ...r,
    freshnessText: freshnessLabel(r.freshness, r.lastUpdatedAt),
  }));

  return json({ city: cityRaw ?? null, point, radiusKm: radius, results: ranked });
});
