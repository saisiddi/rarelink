import { TriangleAlert, FlaskConical, Info } from "lucide-react";
import { cn } from "@/lib/cn";

/** Always visible on search/emergency surfaces — noticeable, not obstructive. */
export function SafetyBanner({ lines, className }: { lines: string[]; className?: string }) {
  if (lines.length === 0) return null;
  return (
    <div
      role="note"
      className={cn(
        "flex gap-3 rounded-2xl border border-warn/30 bg-warn-soft px-4 py-3",
        className,
      )}
    >
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
      <ul className="space-y-1 text-xs leading-relaxed text-warn sm:text-sm">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

export function DemoBanner({ className }: { className?: string }) {
  return (
    <div
      role="note"
      className={cn(
        "flex items-center gap-2.5 border-b border-warn/30 bg-navy px-4 py-2 text-center text-xs font-semibold text-warn-soft",
        className,
      )}
    >
      <FlaskConical className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        DEMO DATASET — fictional blood banks, donors and phone numbers. Not for real medical use.
      </span>
      <a href="/demo" className="ml-1 hidden underline hover:text-white sm:inline">
        What am I looking at?
      </a>
    </div>
  );
}

export function NoticeList({ notices }: { notices: string[] }) {
  if (notices.length === 0) return null;
  return (
    <ul className="space-y-1.5">
      {notices.map((n) => (
        <li
          key={n}
          className="flex items-start gap-2 rounded-xl bg-info-soft px-3 py-2 text-xs leading-relaxed text-info"
        >
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {n}
        </li>
      ))}
    </ul>
  );
}
