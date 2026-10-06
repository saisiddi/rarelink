"use client";

import { useState } from "react";
import Link from "next/link";
import { Phone, Navigation, HeartHandshake, ShieldCheck, Siren } from "lucide-react";

import type { SearchResult } from "@/lib/types";
import { cn } from "@/lib/cn";
import { AvailabilityBadge, DistanceBadge, FreshnessBadge, SourceTag, VerificationBadge } from "@/components/badges";

function directionsHref(result: SearchResult): string {
  const q = result.coordinates
    ? `${encodeURIComponent(result.title)}@${result.coordinates.latitude},${result.coordinates.longitude}`
    : encodeURIComponent(`${result.title}, ${result.city}`);
  return `https://www.openstreetmap.org/directions?to=${q}`;
}

function ComponentLabel({ result }: { result: SearchResult }) {
  if (!result.component && !result.bloodGroup) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {result.bloodGroup ? (
        <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-lg bg-brand-soft px-2.5 text-base font-bold text-brand">
          {result.bloodGroup === "OH" ? "Oh" : result.bloodGroup}
        </span>
      ) : null}
      {result.component ? (
        <span className="rounded-lg bg-line px-2.5 py-1.5 text-xs font-semibold text-ink-soft">
          {result.component.replace("_", " ")}
        </span>
      ) : null}
      {result.unitsAvailable !== null ? (
        <span className="rounded-lg bg-navy px-2.5 py-1.5 text-xs font-semibold text-white tabular">
          {result.unitsAvailable} {result.unitsAvailable === 1 ? "unit" : "units"}
        </span>
      ) : null}
    </div>
  );
}

export function ResultCard({
  result,
  index,
  emergency = false,
  onTrack,
}: {
  result: SearchResult;
  index?: number;
  emergency?: boolean;
  onTrack?: (event: string) => void;
}) {
  const isDonor = result.kind === "donor";
  const [showRequest, setShowRequest] = useState(false);
  const [handle, setHandle] = useState("");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submitRequest() {
    if (!handle.trim()) {
      setState("error");
      setMessage("Add a phone number or email the donor can reply to.");
      return;
    }
    setState("sending");
    try {
      const res = await fetch(`/api/donors/${result.id}/request`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handle, note, city: result.city }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        setState("error");
        setMessage(data.error ?? "Could not send the request");
        return;
      }
      setState("sent");
      setMessage(data.message ?? "Request sent");
      onTrack?.("donor_request_sent");
    } catch {
      setState("error");
      setMessage("Network error — please try again.");
    }
  }

  return (
    <li
      data-id={result.key ?? result.id}
      className={cn(
        // min-w-0 is load-bearing: as a grid item, the card's default
        // min-width:auto would stretch the track to the title's full width.
        "card animate-rise relative flex min-w-0 flex-col gap-3 p-4 sm:p-5",
        emergency && "border-brand/40 shadow-lift",
      )}
      style={{ animationDelay: index !== undefined ? `${Math.min(index, 8) * 40}ms` : undefined }}
    >
      {/* Wraps on narrow screens so the distance/verification badges drop below
          the title instead of pushing the card past the viewport. */}
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {isDonor ? (
              <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-soft text-sm text-brand" aria-hidden="true">
                ❤
              </span>
            ) : (
              <span className="grid h-7 w-7 place-items-center rounded-full bg-navy text-sm text-white" aria-hidden="true">
                🏥
              </span>
            )}
            <h3 className="truncate text-base font-semibold text-ink">{result.title}</h3>
            {index === 0 && emergency ? (
              <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                Nearest
              </span>
            ) : null}
          </div>
          {result.subtitle ? (
            <p className="mt-1 truncate text-sm text-ink-soft">{result.subtitle}</p>
          ) : null}
          <p className="mt-0.5 text-sm text-ink-mute">{result.address}</p>
        </div>
        <div className="ml-auto flex shrink-0 flex-col items-end gap-1.5">
          <DistanceBadge km={result.distanceKm} />
          <VerificationBadge verified={result.verified} label={result.verificationLabel} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ComponentLabel result={result} />
        {result.availabilityStatus ? <AvailabilityBadge status={result.availabilityStatus} /> : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <FreshnessBadge freshness={result.freshness} lastUpdatedAt={result.lastUpdatedAt} />
        <SourceTag source={result.source} isDemo={result.isDemo} />
      </div>

      {result.notes.length > 0 ? (
        <ul className="space-y-1 rounded-xl bg-warn-soft/60 px-3 py-2">
          {result.notes.map((n) => (
            <li key={n} className="flex gap-2 text-xs leading-relaxed text-warn">
              <span aria-hidden="true">•</span>
              <span>{n}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-auto flex flex-wrap gap-2">
        {isDonor ? (
          showRequest ? (
            <div className="w-full space-y-2 rounded-xl border border-line bg-canvas p-3">
              <label className="block text-xs font-semibold text-ink-soft" htmlFor={`handle-${result.id}`}>
                How can the donor reach you?
              </label>
              <input
                id={`handle-${result.id}`}
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="Phone number or email"
                className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-brand"
              />
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Short note (optional) — e.g. hospital, units needed"
                className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-brand"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={submitRequest}
                  disabled={state === "sending"}
                  className="h-10 flex-1 rounded-lg bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {state === "sending" ? "Sending…" : "Send request"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRequest(false)}
                  className="h-10 rounded-lg border border-line bg-white px-4 text-sm font-semibold text-ink-soft"
                >
                  Cancel
                </button>
              </div>
              {message ? (
                <p className={cn("text-xs", state === "error" ? "text-danger" : "text-ok")}>{message}</p>
              ) : (
                <p className="text-xs text-ink-mute">
                  The donor decides whether to respond. Contact details are never shown automatically.
                </p>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowRequest(true)}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong"
            >
              <HeartHandshake className="h-4 w-4" aria-hidden="true" />
              Request contact
            </button>
          )
        ) : (
          <>
            <a
              href={`tel:${(result.emergencyPhone ?? result.phone ?? "").replace(/\s/g, "")}`}
              onClick={() => onTrack?.("call_clicked")}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-navy px-4 text-sm font-semibold text-white transition hover:bg-navy-soft"
            >
              <Phone className="h-4 w-4" aria-hidden="true" />
              Call
            </a>
            <a
              href={directionsHref(result)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onTrack?.("directions_clicked")}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink transition hover:border-ink-mute"
            >
              <Navigation className="h-4 w-4" aria-hidden="true" />
              Directions
            </a>
            <Link
              href={`/emergency?bank=${encodeURIComponent(result.id.split(":")[0] ?? result.id)}&group=${encodeURIComponent(result.bloodGroup ?? "")}`}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-brand/40 bg-brand-soft px-4 text-sm font-semibold text-brand transition hover:bg-brand hover:text-white"
            >
              <Siren className="h-4 w-4" aria-hidden="true" />
              Request
            </Link>
          </>
        )}
      </div>

      {isDonor && result.verified ? (
        <p className="flex items-center gap-1.5 text-[11px] text-ink-mute">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          {result.verificationLabel} · no address or phone number is ever shown publicly
        </p>
      ) : null}
    </li>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <li className="card grid place-items-center gap-2 p-10 text-center">
      <span className="text-3xl" aria-hidden="true">🩸</span>
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      <p className="max-w-md text-sm text-ink-soft">{body}</p>
      {action}
    </li>
  );
}
