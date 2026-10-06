/**
 * Local directory provider — reads the RARELINK database (seeded demo data
 * or an imported, verified eRaktKosh/IRCS dataset).
 *
 * This is the default provider and the reason the app works offline.
 */

import type { BloodBank, BloodComponent, BloodGroup, GeoPoint, InventoryRecord } from "@/lib/types";
import { getDb, nowIso } from "@/lib/db";
import { boundingBox } from "@/lib/geo/distance";
import type { BloodDataProvider, ProviderAvailabilityQuery, ProviderResult } from "./types";

function now() {
  return nowIso();
}

export const localProvider: BloodDataProvider = {
  id: "local",
  name: "RARELINK directory",
  kind: "directory",
  attribution: "Imported & verified directory data",
  isLive: () => true,

  async searchBlood(
    query: ProviderAvailabilityQuery & { near?: GeoPoint; radiusKm?: number },
  ): Promise<ProviderResult<InventoryRecord>> {
    const db = getDb();
    const where: string[] = [];
    const params: Array<string | number> = [];

    if (query.bloodGroup) {
      where.push("i.blood_group = ?");
      params.push(query.bloodGroup);
    }
    if (query.component) {
      where.push("i.component = ?");
      params.push(query.component);
    }
    if (query.near && query.radiusKm) {
      const box = boundingBox(query.near, query.radiusKm);
      where.push("b.latitude BETWEEN ? AND ? AND b.longitude BETWEEN ? AND ?");
      params.push(box.minLat, box.maxLat, box.minLon, box.maxLon);
    }

    const sql = `
      SELECT i.id, i.blood_bank_id, i.blood_group, i.component, i.units_available,
             i.availability_status, i.last_updated_at, i.source, i.source_record_id
      FROM blood_inventory i
      JOIN blood_banks b ON b.id = i.blood_bank_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY i.last_updated_at DESC
      LIMIT 500`;

    const rows = db.prepare(sql).all(...params) as Record<string, string | number>[];

    return {
      ok: true,
      source: "RARELINK directory",
      fetchedAt: now(),
      records: rows.map(mapInventory),
    };
  },

  async getBloodBank(id: string): Promise<ProviderResult<BloodBank>> {
    const db = getDb();
    const row = db.prepare("SELECT * FROM blood_banks WHERE id = ?").get(id) as
      | Record<string, string | number>
      | undefined;
    return {
      ok: Boolean(row),
      source: "RARELINK directory",
      fetchedAt: now(),
      records: row ? [mapBank(row)] : [],
      error: row ? undefined : "Blood bank not found",
    };
  },

  async getBloodAvailability(bloodBankId: string): Promise<ProviderResult<InventoryRecord>> {
    const db = getDb();
    const rows = db
      .prepare("SELECT * FROM blood_inventory WHERE blood_bank_id = ?")
      .all(bloodBankId) as Record<string, string | number>[];
    return {
      ok: true,
      source: "RARELINK directory",
      fetchedAt: now(),
      records: rows.map(mapInventory),
    };
  },

  async getNearbyBloodBanks(
    point: GeoPoint,
    radiusKm: number,
  ): Promise<ProviderResult<BloodBank>> {
    const db = getDb();
    const box = boundingBox(point, radiusKm);
    const rows = db
      .prepare(
        `SELECT * FROM blood_banks
         WHERE latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?
         LIMIT 500`,
      )
      .all(box.minLat, box.maxLat, box.minLon, box.maxLon) as Record<
      string,
      string | number
    >[];
    return {
      ok: true,
      source: "RARELINK directory",
      fetchedAt: now(),
      records: rows.map(mapBank),
    };
  },
};

// --- row mappers ------------------------------------------------------------

export function mapBank(row: Record<string, string | number>): BloodBank {
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
    componentsSupported: parseJson<BloodComponent[]>(
      row.components_supported,
      [],
    ),
    apheresisAvailable: row.apheresis_available === 1,
    openingHours: row.opening_hours ? String(row.opening_hours) : null,
    emergency24x7: row.emergency_24x7 === 1,
    source: String(row.source),
    sourceId: row.source_id ? String(row.source_id) : null,
    verified: row.verified === 1,
    isDemo: row.is_demo === 1,
    lastVerifiedAt: row.last_verified_at ? String(row.last_verified_at) : null,
    lastInventoryUpdate: row.last_inventory_update
      ? String(row.last_inventory_update)
      : null,
  };
}

export function mapInventory(row: Record<string, string | number>): InventoryRecord {
  return {
    id: String(row.id),
    bloodBankId: String(row.blood_bank_id),
    bloodGroup: String(row.blood_group) as BloodGroup,
    component: String(row.component) as BloodComponent,
    unitsAvailable: Number(row.units_available),
    availabilityStatus: String(row.availability_status) as InventoryRecord["availabilityStatus"],
    lastUpdatedAt: String(row.last_updated_at),
    source: String(row.source),
    sourceRecordId: row.source_record_id ? String(row.source_record_id) : null,
  };
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
