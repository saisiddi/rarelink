import { describe, expect, it } from "vitest";

import {
  RANKING_WEIGHTS,
  availabilityScore,
  rank,
  scoreCandidate,
  type Rankable,
} from "@/lib/ranking";
import { proximityScore } from "@/lib/geo/distance";

const RADIUS = 50;

const candidate = (overrides: Partial<Rankable> = {}): Rankable => ({
  availabilityStatus: null,
  freshness: "UNKNOWN",
  lastUpdatedAt: null,
  distanceKm: null,
  verified: false,
  emergency24x7: false,
  ...overrides,
});

describe("weights", () => {
  it("add up to exactly 1", () => {
    const sum = Object.values(RANKING_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it("match the published ranking policy", () => {
    expect(RANKING_WEIGHTS).toEqual({
      availability: 0.35,
      freshness: 0.2,
      proximity: 0.2,
      verification: 0.15,
      emergencyCapability: 0.1,
    });
  });
});

describe("availabilityScore", () => {
  it("orders statuses by how usable they are", () => {
    expect(availabilityScore("AVAILABLE")).toBe(1);
    expect(availabilityScore("LOW")).toBeGreaterThan(availabilityScore("UNKNOWN"));
    expect(availabilityScore("UNKNOWN")).toBeGreaterThan(availabilityScore("STALE"));
    expect(availabilityScore("STALE")).toBeGreaterThan(availabilityScore("UNAVAILABLE"));
    expect(availabilityScore("UNAVAILABLE")).toBe(0);
  });

  it("does not reward missing data", () => {
    expect(availabilityScore(null)).toBeLessThan(availabilityScore("AVAILABLE"));
  });
});

describe("scoreCandidate", () => {
  it("never exceeds 1 no matter how good every input is", () => {
    const s = scoreCandidate(
      candidate({
        availabilityStatus: "AVAILABLE",
        freshness: "LIVE",
        lastUpdatedAt: new Date().toISOString(),
        distanceKm: 0.1,
        verified: true,
        emergency24x7: true,
        urgency: "emergency",
        rareMatch: true,
      }),
      RADIUS,
    );
    expect(s.total).toBeLessThanOrEqual(1);
    expect(s.total).toBeGreaterThan(0.9);
  });

  it("breaks the score into parts that sum to the total", () => {
    const s = scoreCandidate(
      candidate({
        availabilityStatus: "LOW",
        freshness: "RECENT",
        lastUpdatedAt: new Date().toISOString(),
        distanceKm: 12,
        verified: true,
        emergency24x7: false,
      }),
      RADIUS,
    );
    const parts =
      s.availability + s.freshness + s.proximity + s.verification + s.emergencyCapability;
    expect(parts).toBeCloseTo(s.total - s.rareBoost, 2);
  });

  it("gives a capped boost to verified rare matches", () => {
    const plain = scoreCandidate(candidate({ verified: true }), RADIUS);
    const rare = scoreCandidate(candidate({ verified: true, rareMatch: true }), RADIUS);
    const rareUnverified = scoreCandidate(candidate({ rareMatch: true }), RADIUS);
    expect(rare.rareBoost).toBe(0.12);
    expect(rareUnverified.rareBoost).toBe(0.05);
    expect(rare.total).toBeGreaterThan(plain.total);
    expect(rare.total).toBeLessThanOrEqual(1);
  });

  it("penalises distance but never below zero", () => {
    const near = scoreCandidate(candidate({ distanceKm: 0.5 }), RADIUS);
    const far = scoreCandidate(candidate({ distanceKm: 45 }), RADIUS);
    const beyond = scoreCandidate(candidate({ distanceKm: 500 }), RADIUS);
    expect(near.proximity).toBeGreaterThan(far.proximity);
    expect(beyond.proximity).toBe(0);
    expect(beyond.total).toBeGreaterThanOrEqual(0);
  });

  it("treats an unknown distance as neutral, not free", () => {
    // Raw proximity, before the 20% weight is applied.
    expect(proximityScore(null, RADIUS)).toBe(0.4);
    expect(proximityScore(0.5, RADIUS)).toBe(1);
    expect(proximityScore(45, RADIUS)).toBeLessThan(proximityScore(null, RADIUS));

    // The breakdown reports the weighted contribution of that raw score.
    expect(scoreCandidate(candidate({ distanceKm: null }), RADIUS).proximity).toBeCloseTo(0.08, 6);
    expect(scoreCandidate(candidate({ distanceKm: 0.5 }), RADIUS).proximity).toBeCloseTo(0.2, 6);
  });
});

describe("rank — verification outranks proximity (hard rule)", () => {
  const verified = candidate({
    verified: true,
    availabilityStatus: "AVAILABLE",
    freshness: "LIVE",
    lastUpdatedAt: new Date().toISOString(),
    distanceKm: 48,
    emergency24x7: false,
  });
  const unverified = candidate({
    verified: false,
    availabilityStatus: "AVAILABLE",
    freshness: "LIVE",
    lastUpdatedAt: new Date().toISOString(),
    distanceKm: 0.2,
    emergency24x7: true,
    urgency: "emergency",
  });

  it("puts the verified candidate first even though it scores lower", () => {
    expect(scoreCandidate(verified, RADIUS).total).toBeLessThan(
      scoreCandidate(unverified, RADIUS).total,
    );
    const ordered = rank([unverified, verified], RADIUS);
    expect(ordered[0]).toBe(verified);
    expect(ordered[1]).toBe(unverified);
  });

  it("does not depend on input order", () => {
    expect(rank([unverified, verified], RADIUS)).toEqual(rank([verified, unverified], RADIUS));
  });

  it("sorts verified candidates among themselves by score", () => {
    const good = candidate({ verified: true, availabilityStatus: "AVAILABLE", distanceKm: 2 });
    const poor = candidate({ verified: true, availabilityStatus: "UNAVAILABLE", distanceKm: 40 });
    const ordered = rank([poor, good], RADIUS);
    expect(ordered[0]).toBe(good);
  });

  it("breaks score ties by distance", () => {
    const a = candidate({ verified: true, distanceKm: 3 });
    const b = candidate({ verified: true, distanceKm: 30 });
    expect(rank([b, a], RADIUS)[0]).toBe(a);
  });

  it("is a no-op on an empty list", () => {
    expect(rank([], RADIUS)).toEqual([]);
  });
});
