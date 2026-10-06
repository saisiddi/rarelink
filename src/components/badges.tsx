import type { AvailabilityStatus, Freshness } from "@/lib/types";
import { freshnessLabel } from "@/lib/blood/freshness";
import { cn } from "@/lib/cn";

/**
 * Availability is never communicated by colour alone — every badge carries a
 * glyph and a word (WCAG-friendly).
 */

const AVAILABILITY: Record<
  AvailabilityStatus,
  { glyph: string; label: string; className: string }
> = {
  AVAILABLE: { glyph: "✓", label: "Available", className: "bg-ok-soft text-ok border-ok/25" },
  LOW: { glyph: "⚠", label: "Low stock", className: "bg-warn-soft text-warn border-warn/25" },
  UNAVAILABLE: { glyph: "×", label: "Unavailable", className: "bg-danger-soft text-danger border-danger/25" },
  UNKNOWN: { glyph: "?", label: "Call to confirm", className: "bg-line text-ink-soft border-line" },
  STALE: { glyph: "◷", label: "Old data", className: "bg-warn-soft text-warn border-warn/25" },
};

export function AvailabilityBadge({
  status,
  className,
}: {
  status: AvailabilityStatus | null;
  className?: string;
}) {
  if (!status) return null;
  const cfg = AVAILABILITY[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        cfg.className,
        className,
      )}
    >
      <span aria-hidden="true" className="text-sm leading-none">
        {cfg.glyph}
      </span>
      {cfg.label}
    </span>
  );
}

const FRESHNESS_STYLE: Record<Freshness, { label: string; className: string }> = {
  LIVE: { label: "Live", className: "text-ok" },
  RECENT: { label: "Recent", className: "text-ink-soft" },
  STALE: { label: "Stale", className: "text-warn" },
  OUTDATED: { label: "Outdated", className: "text-danger" },
  UNKNOWN: { label: "Unknown age", className: "text-ink-mute" },
};

export function FreshnessBadge({
  freshness,
  lastUpdatedAt,
  className,
}: {
  freshness: Freshness;
  lastUpdatedAt: string | null;
  className?: string;
}) {
  const cfg = FRESHNESS_STYLE[freshness];
  return (
    <span
      title={freshnessLabel(freshness, lastUpdatedAt)}
      className={cn("inline-flex items-center gap-1.5 text-xs font-medium tabular", cfg.className, className)}
    >
      <span aria-hidden="true">◷</span>
      {freshnessLabel(freshness, lastUpdatedAt)}
    </span>
  );
}

export function VerificationBadge({
  verified,
  label,
  className,
}: {
  verified: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        verified
          ? "border-info/25 bg-info-soft text-info"
          : "border-line bg-line text-ink-soft",
        className,
      )}
    >
      <span aria-hidden="true">{verified ? "✓" : "○"}</span>
      {label ?? (verified ? "Verified" : "Not verified")}
    </span>
  );
}

export function DistanceBadge({ km }: { km: number | null }) {
  const text =
    km === null
      ? "Distance unknown"
      : km < 1
        ? `${Math.round(km * 1000)} m`
        : km < 10
          ? `${km.toFixed(1)} km`
          : `${Math.round(km)} km`;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold text-ink tabular">
      <span aria-hidden="true">📍</span>
      {text}
    </span>
  );
}

export function SourceTag({ source, isDemo }: { source: string; isDemo?: boolean }) {
  const label = isDemo ? "Demo data" : source === "demo" ? "Demo data" : `Data source: ${source}`;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        isDemo || source === "demo" ? "bg-warn-soft text-warn" : "bg-line text-ink-soft",
      )}
    >
      {label}
    </span>
  );
}
