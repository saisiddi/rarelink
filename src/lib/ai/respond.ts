/**
 * The AI orchestrator: the front door to the product.
 *
 *   user message → intent extraction (LLM + deterministic fallback)
 *   → server-side validation → backend search → ranking
 *   → short natural-language summary + rich result cards
 *
 * The model never decides a fact. If OpenRouter fails at any point the local
 * parser and the template summary take over and the feature still works.
 */

import type { SearchResult, StructuredIntent } from "@/lib/types";
import { getDb, newId, nowIso } from "@/lib/db";
import { runSearch, publicResult, formatDistance } from "@/lib/search";
import { bloodGroupLabel, checkCompatibility } from "@/lib/blood/compatibility";
import { freshnessLabel } from "@/lib/blood/freshness";
import {
  extractIntentLocal,
  isActionable,
  nextQuestion,
  type ChatTurn,
} from "@/lib/ai/intent";
import {
  chatCompletion,
  isAiConfigured,
  parseJsonLoose,
  AiUnavailableError,
} from "@/lib/ai/openrouter";
import {
  EXTRACTION_PROMPT,
  SUMMARY_PROMPT,
  SYSTEM_PROMPT,
} from "@/lib/ai/systemPrompt";

export interface ChatRequest {
  sessionId?: string | null;
  message: string;
  /** Coordinates from browser geolocation for "near me" queries. */
  coordinates?: { latitude: number; longitude: number } | null;
}

export interface ChatResponse {
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

// ---------------------------------------------------------------------------
// Session memory
// ---------------------------------------------------------------------------

function ensureSession(sessionId?: string | null): string {
  const db = getDb();
  if (sessionId) {
    const row = db.prepare("SELECT id FROM chat_sessions WHERE id = ?").get(sessionId);
    if (row) return String(row.id);
  }
  const id = newId("chat");
  db.prepare("INSERT INTO chat_sessions (id, created_at, updated_at) VALUES (?, ?, ?)").run(
    id,
    nowIso(),
    nowIso(),
  );
  return id;
}

function readHistory(sessionId: string): ChatTurn[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT role, content FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC, rowid ASC LIMIT 40",
    )
    .all(sessionId) as Array<{ role: string; content: string }>;
  return rows.map((r) => ({ role: r.role as ChatTurn["role"], content: r.content }));
}

function persist(sessionId: string, role: "user" | "assistant", content: string, payload?: unknown): void {
  const db = getDb();
  db.prepare(
    "INSERT INTO chat_messages (id, session_id, role, content, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(newId("msg"), sessionId, role, content, payload ? JSON.stringify(payload) : null, nowIso());
  db.prepare("UPDATE chat_sessions SET updated_at = ? WHERE id = ?").run(nowIso(), sessionId);
}

// ---------------------------------------------------------------------------
// Intent
// ---------------------------------------------------------------------------

async function extractWithModel(message: string, history: ChatTurn[]): Promise<StructuredIntent | null> {
  if (!isAiConfigured()) return null;
  try {
    const content = await chatCompletion(
      [
        { role: "system", content: `${SYSTEM_PROMPT}\n\n${EXTRACTION_PROMPT}` },
        ...history.slice(-6).map((t) => ({ role: t.role, content: t.content })),
        { role: "user", content: message },
      ],
      { json: true, timeoutMs: 9_000 },
    );
    const parsed = parseJsonLoose(content);
    if (!parsed) return null;
    const { validateIntent } = await import("@/lib/ai/intent");
    return validateIntent(parsed);
  } catch (err) {
    if (err instanceof AiUnavailableError) return null;
    return null;
  }
}

/**
 * Deterministic parser wins on facts it detected; the model only adds what
 * the rules missed. This keeps behaviour predictable and testable.
 */
function reconcile(local: StructuredIntent, model: StructuredIntent | null): StructuredIntent {
  if (!model) return local;
  return {
    intent: model.intent !== "help" ? model.intent : local.intent,
    blood_group: local.blood_group ?? model.blood_group,
    component: local.component ?? model.component,
    quantity: Math.max(local.quantity || 1, model.quantity || 1),
    location: {
      city: local.location.city ?? model.location.city,
      latitude: local.location.latitude ?? model.location.latitude,
      longitude: local.location.longitude ?? model.location.longitude,
    },
    radius_km: local.radius_km !== 50 ? local.radius_km : model.radius_km,
    urgency:
      local.urgency === "emergency" || model.urgency === "emergency"
        ? "emergency"
        : local.urgency !== "routine"
          ? local.urgency
          : model.urgency,
    time_window_hours: local.time_window_hours ?? model.time_window_hours,
    rare_blood:
      local.rare_blood ||
      model.rare_blood ||
      Boolean(
        (local.blood_group ?? model.blood_group) === "OH" ||
          (local.blood_group ?? model.blood_group) === "P-BOMBAY",
      ),
    missing: [],
  };
}

// ---------------------------------------------------------------------------
// Summaries
// ---------------------------------------------------------------------------

function localSummary(intent: StructuredIntent, outcome: Awaited<ReturnType<typeof runSearch>>): string {
  const lines: string[] = [];
  const where = outcome.resolvedCity ? ` in ${outcome.resolvedCity}` : "";
  const what = intent.blood_group
    ? `${bloodGroupLabel(intent.blood_group)}${intent.component ? ` ${intent.component.replace("_", " ")}` : ""}`
    : "blood";

  if (intent.intent === "help") {
    return "Tell me what blood you need — for example \"O− urgently near me\", \"Bombay blood group in Bengaluru\", or \"nearest blood bank\".";
  }

  lines.push(
    `Found ${outcome.bloodBanks.length} blood-bank option${outcome.bloodBanks.length === 1 ? "" : "s"} and ${outcome.donors.length} registered donor${outcome.donors.length === 1 ? "" : "s"}${where}${intent.blood_group ? ` for ${what}` : ""}.`,
  );

  const top = outcome.bloodBanks.filter((r) => r.availabilityStatus === "AVAILABLE").slice(0, 2);
  for (const r of top) {
    const units = r.unitsAvailable !== null ? `${r.unitsAvailable} units` : "availability unknown";
    const dist = r.distanceKm !== null ? `, ${formatDistance(r.distanceKm)} away` : "";
    const fresh = freshnessLabel(r.freshness, r.lastUpdatedAt);
    lines.push(`• ${r.title} — ${units}${dist}. ${fresh}.`);
  }
  if (outcome.donors[0]) {
    const d = outcome.donors[0];
    lines.push(
      `• ${d.verified ? "Verified" : "Self-reported"} donor — ${formatDistance(d.distanceKm)} away, ${d.verificationLabel.toLowerCase()}.`,
    );
  }
  if (outcome.safety[0]) lines.push(outcome.safety[0]);
  return lines.join("\n");
}

async function modelSummary(
  intent: StructuredIntent,
  outcome: Awaited<ReturnType<typeof runSearch>>,
): Promise<string | null> {
  if (!isAiConfigured()) return null;
  try {
    const compact = {
      query: {
        blood_group: intent.blood_group,
        component: intent.component,
        quantity: intent.quantity,
        urgency: intent.urgency,
        city: outcome.resolvedCity,
      },
      blood_banks: outcome.bloodBanks.slice(0, 6).map((r) => ({
        name: r.title,
        blood_group: r.bloodGroup,
        component: r.component,
        units: r.unitsAvailable,
        status: r.availabilityStatus,
        distance: r.distanceKm === null ? null : formatDistance(r.distanceKm),
        updated: freshnessLabel(r.freshness, r.lastUpdatedAt),
        verified: r.verified,
        source: r.source,
        notes: r.notes,
      })),
      donors: outcome.donors.slice(0, 4).map((r) => ({
        group: r.bloodGroup,
        verified: r.verified,
        verification: r.verificationLabel,
        distance: r.distanceKm === null ? null : formatDistance(r.distanceKm),
        availability: r.availabilityStatus,
        notes: r.notes,
      })),
      notices: outcome.notices,
      safety: outcome.safety,
    };

    const content = await chatCompletion(
      [
        { role: "system", content: `${SYSTEM_PROMPT}\n\n${SUMMARY_PROMPT}` },
        { role: "user", content: JSON.stringify(compact) },
      ],
      { timeoutMs: 9_000 },
    );
    return content.trim().slice(0, 900);
  } catch {
    return null;
  }
}

function suggestionsFor(intent: StructuredIntent, city: string | null): string[] {
  const out: string[] = [];
  if (!intent.blood_group) out.push("Which blood group do you need?");
  else if (city) out.push(`Show blood banks in ${city}`);
  else out.push("Which city should I search?");
  if (intent.blood_group && intent.urgency !== "emergency") out.push("This is urgent");
  if (intent.blood_group) out.push("Find donors too");
  out.push("How does RARELINK work?");
  return out.slice(0, 3);
}

const CLARIFICATION_TEXT: Record<string, string> = {
  blood_group: "Which blood group do you need?",
  location: "Which city or area should I search around?",
  city: "Which city are you in?",
  intent: "Tell me what you need — blood, a donor, or a blood bank.",
  intent_needed: "Tell me what you need — blood, a donor, or a blood bank.",
};

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function handleChat(req: ChatRequest): Promise<ChatResponse> {
  const sessionId = ensureSession(req.sessionId);
  const history = readHistory(sessionId);
  const message = req.message.trim();

  const localIntent = extractIntentLocal(message, history);
  const modelIntent = await extractWithModel(message, history);
  const intent = reconcile(localIntent, modelIntent);

  // Browser geolocation only fills "near me" — never required.
  if (
    req.coordinates &&
    intent.location.latitude === null &&
    intent.location.city === null
  ) {
    intent.location.latitude = req.coordinates.latitude;
    intent.location.longitude = req.coordinates.longitude;
    intent.missing = intent.missing.filter((m) => m !== "location");
  }

  const aiUsed = modelIntent !== null;

  if (!isActionable(intent)) {
    const key = intent.missing[0] ?? "intent";
    const reply =
      CLARIFICATION_TEXT[key] ??
      nextQuestion(intent) ??
      "Tell me what blood you need.";
    persist(sessionId, "user", message);
    persist(sessionId, "assistant", reply);
    return {
      reply,
      sessionId,
      intent,
      cards: [],
      summary: null,
      aiUsed,
      aiAvailable: isAiConfigured(),
      needsClarification: true,
      suggestions: suggestionsFor(intent, intent.location.city),
    };
  }

  const outcome = await runSearch({
    bloodGroup: intent.blood_group,
    component: intent.component,
    quantity: intent.quantity,
    city: intent.location.city,
    location:
      intent.location.latitude !== null && intent.location.longitude !== null
        ? { latitude: intent.location.latitude, longitude: intent.location.longitude }
        : null,
    radiusKm: intent.radius_km,
    urgency: intent.urgency,
    rareBlood: intent.rare_blood,
    intent: intent.intent,
  });

  const reply = (await modelSummary(intent, outcome)) ?? localSummary(intent, outcome);

  const cards = [
    ...outcome.bloodBanks.slice(0, 8),
    ...outcome.donors.slice(0, 6),
  ].map(publicResult);

  const payload = {
    intent,
    city: outcome.resolvedCity,
    counts: { bloodBanks: outcome.bloodBanks.length, donors: outcome.donors.length },
  };
  persist(sessionId, "user", message);
  persist(sessionId, "assistant", reply, payload);

  return {
    reply,
    sessionId,
    intent,
    cards,
    summary: {
      bloodBankCount: outcome.bloodBanks.length,
      donorCount: outcome.donors.length,
      resolvedCity: outcome.resolvedCity,
      notices: outcome.notices,
      safety: outcome.safety,
      searchedAt: outcome.searchedAt,
      tookMs: outcome.tookMs,
    },
    aiUsed,
    aiAvailable: isAiConfigured(),
    needsClarification: false,
    suggestions: suggestionsFor(intent, outcome.resolvedCity),
  };
}

/** Exposed for the compatibility explainer card. */
export function explainCompatibility(group: StructuredIntent["blood_group"]) {
  if (!group) return [];
  return checkCompatibility(group, "PRBC");
}
