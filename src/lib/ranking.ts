/**
 * Deterministic result ranking.
 *
 * score = 0.35·availability + 0.20·freshness + 0.20·proximity
 *       + 0.15·verification + 0.10·emergencyCapability  (+ rare boost)
 *
 * Hard rule: an unverified candidate is never ordered above a verified
 * candidate of the same kind, no matter how close it is.
 */

import type { AvailabilityStatus, Freshness, ScoreBreakdown, Urgency } from "@/lib/types";
import { freshnessScore } from "@/lib/blood/freshness";
import { proximityScore } from "@/lib/geo/distance";

export const RANKING_WEIGHTS = {
  availability: 0.35,
  freshness: 0.2,
  proximity: 0.2,
  verification: 0.15,
  emergencyCapability: 0.1,
} as const;

export interface Rankable {
  availabilityStatus: AvailabilityStatus | null;
  freshness: Freshness;
  lastUpdatedAt: string | null;
  distanceKm: number | null;
  verified: boolean;
  emergency24x7: boolean;
  unitsAvailable?: number | null;
  /** Rare-phenotype candidates get a boost so verified rare matches surface first. */
  rareMatch?: boolean;
  urgency?: Urgency;
}

export function availabilityScore(status: AvailabilityStatus | null): number {
  switch (status) {
    case "AVAILABLE":
      return 1;
    case "LOW":
      return 0.55;
    case "UNKNOWN":
      return 0.3;
    case "STALE":
      return 0.2;
    case "UNAVAILABLE":
      return 0;
    default:
      return 0.35;
  }
}

export function scoreCandidate(
  candidate: Rankable,
  radiusKm: number,
  weights = RANKING_WEIGHTS,
): ScoreBreakdown {
  const availability = availabilityScore(candidate.availabilityStatus);
  const freshness = freshnessScore(candidate.freshness, candidate.lastUpdatedAt);
  const proximity = proximityScore(candidate.distanceKm, radiusKm);
  const verification = candidate.verified ? 1 : 0;

  // Emergency capability: 24x7 facilities score full marks; others partial.
  let emergency = candidate.emergency24x7 ? 1 : 0.4;
  if (candidate.urgency === "emergency" && candidate.emergency24x7) emergency = 1;
  if (candidate.urgency === "routine" && candidate.emergency24x7) emergency = 0.8;

  const base =
    availability * weights.availability +
    freshness * weights.freshness +
    proximity * weights.proximity +
    verification * weights.verification +
    emergency * weights.emergencyCapability;

  // Rare boost — capped so it reorders but never dominates.
  const rareBoost = candidate.rareMatch
    ? candidate.verified
      ? 0.12
      : 0.05
    : 0;

  const total = Math.min(1, base + rareBoost);

  return {
    availability: round(availability * weights.availability),
    freshness: round(freshness * weights.freshness),
    proximity: round(proximity * weights.proximity),
    verification: round(verification * weights.verification),
    emergencyCapability: round(emergency * weights.emergencyCapability),
    rareBoost: round(rareBoost),
    total: round(total),
  };
}

export function rank<T extends Rankable>(items: T[], radiusKm: number): T[] {
  return items
    .map((item) => ({ item, breakdown: scoreCandidate(item, radiusKm) }))
    .sort((a, b) => {
      // Verification tier first — closeness never overrides trust.
      const tierA = a.item.verified ? 0 : 1;
      const tierB = b.item.verified ? 0 : 1;
      if (tierA !== tierB) return tierA - tierB;
      if (b.breakdown.total !== a.breakdown.total) {
        return b.breakdown.total - a.breakdown.total;
      }
      const da = a.item.distanceKm ?? Number.POSITIVE_INFINITY;
      const db = b.item.distanceKm ?? Number.POSITIVE_INFINITY;
      return da - db;
    })
    .map(({ item }) => item);
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
