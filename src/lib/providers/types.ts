/**
 * Blood data provider abstraction.
 *
 * RARELINK never treats one source as "the truth". Every provider returns
 * records that carry `source` + `last_updated_at`, and conflicting values are
 * surfaced to the user instead of silently merged.
 */

import type {
  BloodBank,
  BloodComponent,
  BloodGroup,
  GeoPoint,
  InventoryRecord,
} from "@/lib/types";

export interface ProviderAvailabilityQuery {
  bloodGroup?: BloodGroup | null;
  component?: BloodComponent | null;
}

export interface ProviderResult<T> {
  ok: boolean;
  /** The provider that produced this row. */
  source: string;
  records: T[];
  /** Populated when the provider failed — never swallowed. */
  error?: string;
  fetchedAt: string;
}

export interface BloodDataProvider {
  /** Stable id, e.g. "local", "eraktkosh", "ircs". */
  id: string;
  /** Human label shown on result cards, e.g. "eRaktKosh". */
  name: string;
  /** "official" | "partner" | "directory". */
  kind: "official" | "partner" | "directory";
  /** False when no endpoint/credentials are configured. */
  isLive(): boolean;
  /** Optional documentation URL for attribution. */
  attribution?: string;

  searchBlood(
    query: ProviderAvailabilityQuery & { near?: GeoPoint; radiusKm?: number },
  ): Promise<ProviderResult<InventoryRecord>>;
  getBloodBank(id: string): Promise<ProviderResult<BloodBank>>;
  getBloodAvailability(bloodBankId: string): Promise<ProviderResult<InventoryRecord>>;
  getNearbyBloodBanks(
    point: GeoPoint,
    radiusKm: number,
  ): Promise<ProviderResult<BloodBank>>;
}

export interface AggregatedInventory extends InventoryRecord {
  /** True when two sources disagree about the same bank/group/component. */
  conflicting?: boolean;
  conflictWith?: Array<{ source: string; units: number; status: string }>;
}
