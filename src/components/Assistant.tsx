"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  Loader2,
  Map as MapIcon,
  Siren,
  Droplet,
  UserRound,
  Building2,
  HeartHandshake,
} from "lucide-react";

import type { SearchResult, StructuredIntent } from "@/lib/types";
import { cn } from "@/lib/cn";
import { ResultCard, EmptyState } from "@/components/ResultCard";
import { NoticeList, SafetyBanner } from "@/components/Banners";
import { ButtonLink } from "@/components/ui";

interface ChatResponse {
  reply: string;
  sessionId: string;
  intent: StructuredIntent;
  cards: SearchResult[];
  summary: {
    bloodBankCount: number;
    donorCount: number;
    resolvedCity: string | null;
    notices: string[];
    safety: string[];
    searchedAt: string | null;
    tookMs: number | null;
  } | null;
  aiUsed: boolean;
  aiAvailable: boolean;
  needsClarification: boolean;
  suggestions: string[];
}

const EXAMPLES = [
  "O− urgently near me",
  "Bombay blood group in Bengaluru",
  "Find nearest blood bank",
  "Need AB− platelets",
  "2 units of O negative in Pune",
];

const SESSION_KEY = "rarelink.session";

function searchUrlFor(intent: StructuredIntent): string {
  const params = new URLSearchParams();
  params.set("intent", intent.intent);
  if (intent.blood_group) params.set("bloodGroup", intent.blood_group);
  if (intent.component) params.set("component", intent.component);
  if (intent.location.city) params.set("city", intent.location.city);
  if (intent.location.latitude !== null && intent.location.longitude !== null) {
    params.set("lat", String(intent.location.latitude));
    params.set("lon", String(intent.location.longitude));
  }
  params.set("radius", String(intent.radius_km));
  params.set("urgency", intent.urgency);
  return `/search?${params.toString()}`;
}

export function Assistant({
  compact = false,
  autoFocus = false,
}: {
  compact?: boolean;
  autoFocus?: boolean;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversation, setConversation] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const [response, setResponse] = useState<ChatResponse | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const sessionRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    try {
      sessionRef.current = window.localStorage.getItem(SESSION_KEY);
    } catch {
      sessionRef.current = null;
    }
  }, []);

  const track = useCallback((event: string) => {
    void fetch("/api/analytics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event }),
    }).catch(() => undefined);
  }, []);

  async function requestLocation(): Promise<void> {
    if (coords || typeof navigator === "undefined" || !navigator.geolocation) return;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 6000,
          maximumAge: 300_000,
        });
      });
      setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    } catch {
      // Denied or unavailable — the assistant simply asks for a city instead.
    }
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    setBusy(true);
    setError(null);
    setConversation((prev) => [...prev, { role: "user", text: trimmed }]);
    setMessage("");
    track("search_started");

    const wantsLocation = /\bnear me\b|\baround me\b|\bhere\b/i.test(trimmed);
    if (wantsLocation) await requestLocation();

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          sessionId: sessionRef.current,
          coordinates: wantsLocation || coords ? coords : null,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Request failed");
      }

      const data = (await res.json()) as ChatResponse;

      sessionRef.current = data.sessionId;
      try {
        window.localStorage.setItem(SESSION_KEY, data.sessionId);
      } catch {
        /* storage disabled */
      }

      setResponse(data);
      setConversation((prev) => [...prev, { role: "assistant", text: data.reply }]);
      if (data.summary?.bloodBankCount) track("blood_search");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. You can still search manually.",
      );
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  const intent = response?.intent;

  return (
    <div className={cn("w-full", compact ? "" : "mx-auto max-w-3xl")}>
      {/* --- input ---------------------------------------------------------- */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(message);
        }}
        className={cn(
          "card overflow-hidden p-2 transition",
          busy && "opacity-90",
        )}
      >
        <label htmlFor="rarelink-input" className="sr-only">
          Tell me what blood you need
        </label>
        <div className="flex items-end gap-2">
          <textarea
            id="rarelink-input"
            ref={inputRef}
            rows={compact ? 1 : 2}
            autoFocus={autoFocus}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(message);
              }
            }}
            placeholder="Tell me what blood you need…"
            className="max-h-40 min-h-12 flex-1 resize-none bg-transparent px-3 py-3 text-base text-ink outline-none placeholder:text-ink-mute"
          />
          <button
            type="submit"
            disabled={busy || !message.trim()}
            aria-label="Send request"
            className={cn(
              "mb-1 grid h-11 w-11 shrink-0 place-items-center rounded-xl transition",
              busy || !message.trim()
                ? "bg-line text-ink-mute"
                : "bg-brand text-white hover:bg-brand-strong",
            )}
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowUp className="h-5 w-5" />}
          </button>
        </div>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-ink-mute">Try:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => void send(ex)}
            disabled={busy}
            className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-brand hover:text-brand disabled:opacity-50"
          >
            {ex}
          </button>
        ))}
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-4 rounded-2xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger"
        >
          <strong className="font-semibold">The AI assistant is temporarily unavailable.</strong>{" "}
          {error} You can still search blood banks manually.
          <div className="mt-2">
            <ButtonLink href="/search" size="sm" variant="outline">
              Open manual search
            </ButtonLink>
          </div>
        </div>
      ) : null}

      {/* --- conversation --------------------------------------------------- */}
      {conversation.length > 0 ? (
        <div className="mt-5 space-y-3">
          {conversation.map((turn, i) => (
            <div
              key={`${turn.role}-${i}`}
              className={cn(
                "flex",
                turn.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[92%] whitespace-pre-line rounded-2xl px-4 py-3 text-sm leading-relaxed animate-rise",
                  turn.role === "user"
                    ? "bg-navy text-white"
                    : "border border-line bg-white text-ink",
                )}
              >
                {turn.text}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* --- structured intent chips ---------------------------------------- */}
      {intent && !response?.needsClarification ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <IntentChip label="Intent" value={intent.intent.replace(/_/g, " ")} />
          {intent.blood_group ? <IntentChip label="Blood group" value={intent.blood_group} accent /> : null}
          {intent.component ? <IntentChip label="Component" value={intent.component.replace("_", " ")} /> : null}
          <IntentChip label="Quantity" value={String(intent.quantity)} />
          <IntentChip
            label="Location"
            value={intent.location.city ?? (intent.location.latitude !== null ? "Current location" : "—")}
          />
          <IntentChip label="Priority" value={intent.urgency} accent={intent.urgency === "emergency"} />
        </div>
      ) : null}

      {/* --- results -------------------------------------------------------- */}
      {response && intent && !response.needsClarification ? (
        <div className="mt-5 space-y-4">
          {response.summary ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-mute">
              <span className="rounded-full bg-line px-2.5 py-1 font-semibold text-ink-soft">
                {response.summary.bloodBankCount} blood banks
              </span>
              <span className="rounded-full bg-line px-2.5 py-1 font-semibold text-ink-soft">
                {response.summary.donorCount} donors
              </span>
              {response.summary.tookMs !== null ? (
                <span className="tabular">in {response.summary.tookMs} ms</span>
              ) : null}
              <span className="rounded-full bg-brand-soft px-2.5 py-1 font-semibold text-brand">
                {response.aiUsed ? "AI-assisted summary" : "Rules-based assistant"}
              </span>
            </div>
          ) : null}

          {response.summary && response.summary.safety.length > 0 ? (
            <SafetyBanner lines={response.summary.safety.slice(0, 2)} />
          ) : null}
          {response.summary && response.summary.notices.length > 0 ? (
            <NoticeList notices={response.summary.notices} />
          ) : null}

          {response.cards.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {response.cards.map((card) => (
                <ResultCard
                  key={card.key ?? card.id}
                  result={card}
                  emergency={intent.urgency === "emergency"}
                  onTrack={track}
                />
              ))}
            </ul>
          ) : (
            <ul className="grid gap-3">
              <EmptyState
                title="No matching results in this search"
                body="Try widening the radius, switching city, or searching for a compatible group instead — the compatibility engine can suggest alternatives."
              />
            </ul>
          )}

          <div className="flex flex-wrap gap-2">
            <ButtonLink href={searchUrlFor(intent)} size="sm" variant="secondary">
              <MapIcon className="h-4 w-4" aria-hidden="true" /> Open map view
            </ButtonLink>
            <ButtonLink href="/emergency" size="sm" variant="primary">
              <Siren className="h-4 w-4" aria-hidden="true" /> Raise emergency request
            </ButtonLink>
            {response.suggestions.slice(0, 2).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void send(s)}
                className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-brand hover:text-brand"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function IntentChip({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold capitalize",
        accent ? "border-brand/30 bg-brand-soft text-brand" : "border-line bg-white text-ink-soft",
      )}
    >
      <span className="text-[10px] font-medium uppercase tracking-wider opacity-70">{label}</span>
      {value}
    </span>
  );
}

export function QuickActions() {
  const router = useRouter();
  const items = [
    { href: "/emergency", label: "Emergency Blood Request", icon: Siren, primary: true },
    { href: "/search?intent=find_blood", label: "Find Blood", icon: Droplet },
    { href: "/donors", label: "Find Donor", icon: UserRound },
    { href: "/map", label: "Find Blood Bank", icon: Building2 },
    { href: "/donors#register", label: "Become a Donor", icon: HeartHandshake },
  ];

  return (
    <div className="mt-5 flex flex-wrap justify-center gap-2.5">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.href}
            type="button"
            onClick={() => router.push(item.href)}
            className={cn(
              "inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition active:scale-[0.98]",
              item.primary
                ? "bg-brand text-white shadow-[0_10px_24px_-14px_rgb(200_16_46_/_1)] hover:bg-brand-strong"
                : "border border-line bg-white text-ink hover:border-ink-mute",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
