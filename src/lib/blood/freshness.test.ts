import { afterEach, describe, expect, it } from "vitest";

import {
  computeFreshness,
  effectiveAvailability,
  freshnessLabel,
  freshnessScore,
  minutesSince,
  thresholdsFromEnv,
  type FreshnessThresholds,
} from "@/lib/blood/freshness";

const T: FreshnessThresholds = { liveMinutes: 30, recentMinutes: 180, staleMinutes: 720 };
const NOW = Date.parse("2026-01-01T12:00:00.000Z");
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

describe("minutesSince", () => {
  it("returns null when there is no usable timestamp", () => {
    expect(minutesSince(null)).toBeNull();
    expect(minutesSince(undefined)).toBeNull();
    expect(minutesSince("not a date")).toBeNull();
    expect(minutesSince("")).toBeNull();
  });

  it("clamps future timestamps to 0 instead of going negative", () => {
    expect(minutesSince(ago(-5), NOW)).toBe(0);
  });
});

describe("computeFreshness", () => {
  it("buckets by age", () => {
    expect(computeFreshness(ago(1), T, NOW)).toBe("LIVE");
    expect(computeFreshness(ago(29), T, NOW)).toBe("LIVE");
    expect(computeFreshness(ago(30), T, NOW)).toBe("RECENT");
    expect(computeFreshness(ago(179), T, NOW)).toBe("RECENT");
    expect(computeFreshness(ago(180), T, NOW)).toBe("STALE");
    expect(computeFreshness(ago(719), T, NOW)).toBe("STALE");
    expect(computeFreshness(ago(720), T, NOW)).toBe("OUTDATED");
    expect(computeFreshness(ago(100_000), T, NOW)).toBe("OUTDATED");
  });

  it("reports UNKNOWN rather than guessing when the timestamp is missing", () => {
    expect(computeFreshness(null, T, NOW)).toBe("UNKNOWN");
    expect(computeFreshness("garbage", T, NOW)).toBe("UNKNOWN");
  });
});

describe("thresholdsFromEnv", () => {
  const keys = ["FRESHNESS_LIVE_MINUTES", "FRESHNESS_RECENT_MINUTES", "FRESHNESS_STALE_MINUTES"] as const;
  const saved: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("defaults when unset", () => {
    for (const k of keys) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    expect(thresholdsFromEnv()).toEqual({ liveMinutes: 30, recentMinutes: 180, staleMinutes: 720 });
  });

  it("honours valid overrides", () => {
    for (const k of keys) saved[k] = process.env[k];
    process.env.FRESHNESS_LIVE_MINUTES = "15";
    expect(thresholdsFromEnv().liveMinutes).toBe(15);
  });

  it("ignores nonsense overrides instead of breaking the clock", () => {
    for (const k of keys) saved[k] = process.env[k];
    process.env.FRESHNESS_LIVE_MINUTES = "soon";
    process.env.FRESHNESS_RECENT_MINUTES = "-4";
    expect(thresholdsFromEnv().liveMinutes).toBe(30);
    expect(thresholdsFromEnv().recentMinutes).toBe(180);
  });
});

describe("freshnessScore", () => {
  it("decays with age", () => {
    expect(freshnessScore("LIVE", ago(1))).toBe(1);
    expect(freshnessScore("RECENT", ago(60))).toBe(0.75);
    expect(freshnessScore("STALE", ago(400))).toBe(0.35);
    expect(freshnessScore("OUTDATED", ago(5000))).toBe(0.1);
  });

  it("scores missing data lowest — absence of a timestamp is not freshness", () => {
    expect(freshnessScore("UNKNOWN", null)).toBe(0.05);
  });
});

describe("effectiveAvailability", () => {
  it("never lets stale data present as live inventory", () => {
    expect(effectiveAvailability("AVAILABLE", "STALE")).toBe("STALE");
    expect(effectiveAvailability("AVAILABLE", "OUTDATED")).toBe("STALE");
    expect(effectiveAvailability("LOW", "STALE")).toBe("STALE");
  });

  it("leaves fresh statuses alone", () => {
    expect(effectiveAvailability("AVAILABLE", "LIVE")).toBe("AVAILABLE");
    expect(effectiveAvailability("LOW", "RECENT")).toBe("LOW");
    expect(effectiveAvailability("UNAVAILABLE", "UNKNOWN")).toBe("UNAVAILABLE");
  });
});

describe("freshnessLabel", () => {
  it("adds a call-to-confirm warning once data is stale", () => {
    expect(freshnessLabel("STALE", ago(400))).toMatch(/call to confirm/);
    expect(freshnessLabel("OUTDATED", ago(5000))).toMatch(/call to confirm/);
    expect(freshnessLabel("LIVE", ago(1))).not.toMatch(/call to confirm/);
  });

  it("says so plainly when the update time is unknown", () => {
    expect(freshnessLabel("UNKNOWN", null)).toBe("Update time unknown");
  });
});
