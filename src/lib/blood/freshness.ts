/**
 * Data freshness policy.
 *
 * Every external record carries `source` + `last_updated_at`. We never show
 * outdated information as if it were live inventory.
 */

import type { AvailabilityStatus, Freshness } from "@/lib/types";

export interface FreshnessThresholds {
  /** < n minutes → LIVE */
  liveMinutes: number;
  /** < n minutes → RECENT (else STALE) */
  recentMinutes: number;
  /** < n minutes → STALE (else OUTDATED) */
  staleMinutes: number;
}

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function thresholdsFromEnv(): FreshnessThresholds {
  return {
    liveMinutes: intFromEnv("FRESHNESS_LIVE_MINUTES", 30),
    recentMinutes: intFromEnv("FRESHNESS_RECENT_MINUTES", 180),
    staleMinutes: intFromEnv("FRESHNESS_STALE_MINUTES", 720),
  };
}

export function minutesSince(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, (now - t) / 60_000);
}

export function computeFreshness(
  lastUpdatedAt: string | null | undefined,
  thresholds: FreshnessThresholds = thresholdsFromEnv(),
  now = Date.now(),
): Freshness {
  const mins = minutesSince(lastUpdatedAt, now);
  if (mins === null) return "UNKNOWN";
  if (mins < thresholds.liveMinutes) return "LIVE";
  if (mins < thresholds.recentMinutes) return "RECENT";
  if (mins < thresholds.staleMinutes) return "STALE";
  return "OUTDATED";
}

/** Score 0..1 for the ranking engine. Freshness decays with age. */
export function freshnessScore(freshness: Freshness, lastUpdatedAt: string | null): number {
  switch (freshness) {
    case "LIVE":
      return 1;
    case "RECENT":
      return 0.75;
    case "STALE":
      return 0.35;
    case "OUTDATED":
      return 0.1;
    case "UNKNOWN":
    default:
      return lastUpdatedAt ? 0.2 : 0.05;
  }
}

/** Never show stale data as live — downgrade the availability status too. */
export function effectiveAvailability(
  status: AvailabilityStatus,
  freshness: Freshness,
): AvailabilityStatus {
  if (freshness === "OUTDATED" || freshness === "STALE") return "STALE";
  return status;
}

export function freshnessLabel(freshness: Freshness, lastUpdatedAt: string | null): string {
  const mins = minutesSince(lastUpdatedAt);
  const ago =
    mins === null
      ? null
      : mins < 1
        ? "just now"
        : mins < 60
          ? `${Math.round(mins)} min ago`
          : mins < 60 * 24
            ? `${Math.round(mins / 60)} h ago`
            : `${Math.round(mins / (60 * 24))} d ago`;

  if (freshness === "UNKNOWN" || !ago) return "Update time unknown";
  if (freshness === "LIVE") return `Updated ${ago}`;
  if (freshness === "RECENT") return `Updated ${ago}`;
  if (freshness === "STALE") return `Last updated ${ago} — call to confirm`;
  return `Outdated (${ago}) — call to confirm`;
}
