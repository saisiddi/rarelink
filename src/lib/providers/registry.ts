/**
 * Provider registry + aggregation.
 *
 * Conflicting inventory from two sources is NEVER merged silently: the record
 * is flagged, its availability is downgraded to UNKNOWN, and the UI tells the
 * user to call the blood bank.
 */

import type { InventoryRecord } from "@/lib/types";
import { nowIso } from "@/lib/db";
import { eraktkoshProvider } from "./eraktkosh";
import { indianRedCrossProvider } from "./ircs";
import { localProvider } from "./local";
import type { AggregatedInventory, BloodDataProvider, ProviderResult } from "./types";

const ALL_PROVIDERS: BloodDataProvider[] = [
  localProvider,
  eraktkoshProvider,
  indianRedCrossProvider,
];

/** Providers selected by `BLOOD_DATA_PROVIDERS` (default: local only). */
export function getProviders(): BloodDataProvider[] {
  const raw = (process.env.BLOOD_DATA_PROVIDERS || "local")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const selected = ALL_PROVIDERS.filter((p) => raw.includes(p.id));
  // The local directory is always present — it is what makes the app work offline.
  if (!selected.includes(localProvider)) selected.unshift(localProvider);
  return selected;
}

export function getLiveProviders(): BloodDataProvider[] {
  return getProviders().filter((p) => p.isLive());
}

export interface Aggregation {
  records: AggregatedInventory[];
  /** Non-fatal provider failures, surfaced in the UI as a data notice. */
  issues: Array<{ source: string; error: string }>;
  fetchedAt: string;
}

type Query = Parameters<BloodDataProvider["searchBlood"]>[0];

export async function aggregateInventory(query: Query): Promise<Aggregation> {
  const providers = getProviders();
  const results = await Promise.all(
    providers
      .filter((p) => p.isLive())
      .map(async (p) => {
        try {
          return await p.searchBlood(query);
        } catch (err) {
          return {
            ok: false,
            source: p.name,
            records: [],
            fetchedAt: nowIso(),
            error: err instanceof Error ? err.message : "Provider failed",
          } as ProviderResult<InventoryRecord>;
        }
      }),
  );

  const issues = results
    .filter((r) => !r.ok && r.error)
    .map((r) => ({ source: r.source, error: r.error as string }));

  const buckets = new Map<string, AggregatedInventory[]>();
  for (const result of results) {
    for (const record of result.records) {
      const key = `${record.bloodBankId}|${record.bloodGroup}|${record.component}`;
      const list = buckets.get(key) ?? [];
      list.push({ ...record, source: result.source });
      buckets.set(key, list);
    }
  }

  const merged: AggregatedInventory[] = [];
  for (const list of buckets.values()) {
    if (list.length === 1) {
      merged.push(list[0]);
      continue;
    }
    const distinct = new Set(list.map((r) => `${r.unitsAvailable}:${r.availabilityStatus}`));
    if (distinct.size === 1) {
      // Identical values — take the freshest timestamp.
      const freshest = [...list].sort(
        (a, b) => Date.parse(b.lastUpdatedAt) - Date.parse(a.lastUpdatedAt),
      )[0];
      merged.push(freshest);
      continue;
    }
    // Conflict: do not pick a winner.
    const freshest = [...list].sort(
      (a, b) => Date.parse(b.lastUpdatedAt) - Date.parse(a.lastUpdatedAt),
    )[0];
    merged.push({
      ...freshest,
      availabilityStatus: "UNKNOWN",
      conflicting: true,
      conflictWith: list.map((r) => ({
        source: r.source,
        units: r.unitsAvailable,
        status: r.availabilityStatus,
      })),
    });
  }

  return {
    records: merged,
    issues,
    fetchedAt: nowIso(),
  };
}

export const providerAttribution = ALL_PROVIDERS.map((p) => ({
  id: p.id,
  name: p.name,
  kind: p.kind,
  live: p.isLive(),
  attribution: p.attribution ?? null,
}));
