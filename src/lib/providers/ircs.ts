/**
 * Indian Red Cross Society adapter (IRCS eBloodServices).
 *
 * Same contract as `eraktkosh.ts`: inert unless `IRCS_BASE_URL` is set, and
 * the only file that knows the upstream payload shape.
 */

import type { BloodBank, BloodComponent, BloodGroup, GeoPoint, InventoryRecord } from "@/lib/types";
import { nowIso } from "@/lib/db";
import type { BloodDataProvider, ProviderAvailabilityQuery, ProviderResult } from "./types";

const TIMEOUT_MS = 8_000;

function config(): string | null {
  const baseUrl = process.env.IRCS_BASE_URL?.trim();
  return baseUrl ? baseUrl.replace(/\/$/, "") : null;
}

function empty<T>(error?: string): ProviderResult<T> {
  return {
    ok: false,
    source: "Indian Red Cross",
    records: [],
    fetchedAt: nowIso(),
    error: error ?? "IRCS is not configured",
  };
}

function toInventory(raw: unknown): InventoryRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const r = entry as Record<string, unknown>;
    const group = String(r.bloodGroup ?? r.group ?? "") as BloodGroup;
    if (!group) return [];
    return [
      {
        id: `ircs_${String(r.centreId ?? r.id ?? "x")}_${String(r.component ?? "PRBC")}_${group}`,
        bloodBankId: String(r.centreId ?? r.id ?? ""),
        bloodGroup: group,
        component: String(r.component ?? "PRBC") as BloodComponent,
        unitsAvailable: Number(r.units ?? r.available ?? 0),
        availabilityStatus: (String(r.status ?? "UNKNOWN").toUpperCase() as InventoryRecord["availabilityStatus"]),
        lastUpdatedAt: String(r.updatedAt ?? nowIso()),
        source: "Indian Red Cross",
        sourceRecordId: r.id ? String(r.id) : null,
      } satisfies InventoryRecord,
    ];
  });
}

export const indianRedCrossProvider: BloodDataProvider = {
  id: "ircs",
  name: "Indian Red Cross",
  kind: "partner",
  attribution: "Indian Red Cross Society — eBloodServices",
  isLive: () => config() !== null,

  async searchBlood(
    query: ProviderAvailabilityQuery & { near?: GeoPoint; radiusKm?: number },
  ): Promise<ProviderResult<InventoryRecord>> {
    const base = config();
    if (!base) return empty();
    try {
      const params = new URLSearchParams();
      if (query.bloodGroup) params.set("group", query.bloodGroup);
      if (query.component) params.set("component", query.component);
      if (query.near) {
        params.set("lat", String(query.near.latitude));
        params.set("lon", String(query.near.longitude));
        params.set("radius", String(query.radiusKm ?? 25));
      }
      const res = await fetch(`${base}/api/availability?${params}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`IRCS responded ${res.status}`);
      const raw: unknown = await res.json();
      return { ok: true, source: "Indian Red Cross", records: toInventory(raw), fetchedAt: nowIso() };
    } catch (err) {
      return empty(err instanceof Error ? err.message : "Request failed");
    }
  },

  async getBloodBank(id: string): Promise<ProviderResult<BloodBank>> {
    void id;
    return empty("Directory import required");
  },

  async getBloodAvailability(bloodBankId: string): Promise<ProviderResult<InventoryRecord>> {
    void bloodBankId;
    return empty();
  },

  async getNearbyBloodBanks(
    _point: GeoPoint,
    _radiusKm: number,
  ): Promise<ProviderResult<BloodBank>> {
    return empty("Nearby search not available");
  },
};
