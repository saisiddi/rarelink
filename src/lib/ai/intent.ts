/**
 * Intent extraction + conversation memory.
 *
 * Two paths, same output shape:
 *   1. Local deterministic parser — always available, no network, used as
 *      the fallback when OpenRouter is missing, slow or wrong.
 *   2. LLM (OpenRouter) — used when configured; its JSON output is passed
 *      through `validateIntent()` exactly like the local parser.
 *
 * The LLM never decides facts: it only labels the request. Everything factual
 * (availability, distance, compatibility, verification) comes from `search.ts`.
 */

import type { AiIntent, BloodComponent, BloodGroup, StructuredIntent, Urgency } from "@/lib/types";
import { AI_INTENTS } from "@/lib/types";
import { normalizeBloodGroup } from "@/lib/blood/compatibility";
import { resolvePlace, detectCity } from "@/lib/geo/places";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export const EMPTY_INTENT: StructuredIntent = {
  intent: "help",
  blood_group: null,
  component: null,
  quantity: 1,
  location: { city: null, latitude: null, longitude: null },
  radius_km: 50,
  urgency: "routine",
  time_window_hours: null,
  rare_blood: false,
  missing: [],
};

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

const COMPONENT_PATTERNS: Array<[RegExp, BloodComponent]> = [
  [/\b(platelet|platelets|thrombocyte)s?\b/i, "PLATELETS"],
  [/\b(plt|pc)\b/i, "PLATELETS"],
  [/\b(ffp|fresh frozen plasma|plasma)\b/i, "FFP"],
  [/\b(prbc|packed red|red cell|red cells|erythrocyte)s?\b/i, "PRBC"],
  [/\b(whole blood)\b/i, "WHOLE_BLOOD"],
  [/\b(sdp|separated plasma|plasma unit)\b/i, "SDP"],
  [/\b(cryo|cryoprecipitate)\b/i, "CRYO"],
  [/\b(granulocyte|wbc pack)s?\b/i, "GRANULOCYTES"],
];

const GROUP_WORDS = [
  "a positive",
  "a negative",
  "b positive",
  "b negative",
  "ab positive",
  "ab negative",
  "o positive",
  "o negative",
  "oh",
  "bombay",
  "para bombay",
  "para-bombay",
];

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

/** e.g. "O-", "o negative", "b+", "ab -", "O Rh-", "O−" (unicode minus) */
const GROUP_WORDS_REGEX = /\b(AB|A|B|O)\s*(?:Rh\s*)?(pos(?:itive)?|neg(?:ative)?)\b/i;
const GROUP_SIGN_REGEX = /\b(AB|A|B|O)\s*(?:Rh\s*)?([+-])(?![A-Za-z])/i;

function detectBloodGroup(text: string): { group: BloodGroup; rare: boolean } | null {
  // Same digit-zero tolerance as normalizeBloodGroup: "0-" means O-.
  const fixed = text.replace(/\b0(?=\s*(?:Rh\s*)?(?:[+-]|pos(?:itive)?|neg(?:ative)?))/gi, "O");
  const lower = fixed.toLowerCase().replace(/[−–—]/g, "-");

  // Rare phenotypes first so "bombay" never collapses into O−/Mumbai.
  if (/\b(bombay|para[\s-]?bombay|oh\s+phenotype|o\(h\)|hh)\b/.test(lower) &&
      /\b(blood|group|phenotype|phenotype|donor|hh|oh)\b/.test(lower)) {
    const pb = /\bpara[\s-]?bombay\b/.test(lower);
    return { group: pb ? "P-BOMBAY" : "OH", rare: true };
  }
  if (/\b(bombay blood|bombay group|bombay phenotype)\b/.test(lower)) {
    return { group: "OH", rare: true };
  }

  const normalizedText = fixed.replace(/[−–—]/g, "-");
  const match = GROUP_WORDS_REGEX.exec(normalizedText) ?? GROUP_SIGN_REGEX.exec(normalizedText);
  if (match) {
    const normalized = normalizeBloodGroup(`${match[1]} ${match[2]}`);
    if (normalized) return { group: normalized.code, rare: normalized.isRare };
  }

  // "o negative blood", "b positive donor" written as words
  for (const word of GROUP_WORDS) {
    if (lower.includes(word)) {
      const normalized = normalizeBloodGroup(word);
      if (normalized) return { group: normalized.code, rare: normalized.isRare };
    }
  }

  // Bare "bombay" in a request context
  if (/\bbombay\b/.test(lower) && /\b(need|want|require|search|find|looking|arrange|urgent)/.test(lower)) {
    return { group: "OH", rare: true };
  }
  return null;
}

function detectComponent(text: string): BloodComponent | null {
  for (const [re, component] of COMPONENT_PATTERNS) {
    if (re.test(text)) return component;
  }
  return null;
}

function detectQuantity(text: string): number | null {
  const numeric = /\b(\d{1,3})\s*(units?|bags?|pints?|packs?|jars?)?\b/i.exec(text);
  if (numeric && numeric[1]) {
    const n = Number.parseInt(numeric[1], 10);
    if (n > 0 && n <= 50) return n;
  }
  const word = /\b(one|two|three|four|five|six|seven|eight|nine|ten)\s*(units?|bags?|pints?)?\b/i.exec(text);
  if (word && word[1]) return NUMBER_WORDS[word[1].toLowerCase()] ?? null;
  return null;
}

function detectUrgency(text: string): { urgency: Urgency; hours: number | null } {
  const lower = text.toLowerCase();
  const window = /\b(?:within|in|under|less than)\s+(\d{1,3})\s*(hours?|hrs?|h)\b/.exec(lower);
  const hours = window ? Number.parseInt(window[1], 10) : null;

  if (hours !== null && hours <= 6) return { urgency: "emergency", hours };
  if (/\b(emergency|emergent|urgent(ly)?|asap|right away|immediately|life.threatening|critical|now)\b/.test(lower)) {
    return { urgency: "emergency", hours };
  }
  if (/\b(today|tonight|tomorrow morning|soon)\b/.test(lower)) return { urgency: "urgent", hours };
  return { urgency: "routine", hours };
}

function detectRadius(text: string): number | null {
  const m = /\b(?:within|around|nearby|radius(?:\s+of)?)\s+(\d{1,3})\s*(km|kilomet(?:er|re)s?)\b/i.exec(text);
  if (m) return Number.parseInt(m[1], 10);
  const m2 = /\b(\d{1,3})\s*(?:km|kilomet(?:er|re)s?)\b/i.exec(text);
  return m2 ? Number.parseInt(m2[1], 10) : null;
}

function detectLocation(text: string): { city: string | null; lat: number | null; lon: number | null } {
  if (/\bnear me\b|\baround me\b|\bhere\b/i.test(text)) {
    return { city: null, lat: null, lon: null }; // client sends coordinates
  }
  const place = detectCity(text);
  if (place) return { city: place.name, lat: place.latitude, lon: place.longitude };

  // Fallback: "... in <something>"
  const m = /\b(?:in|near|at|around|from)\s+([a-zA-Z][a-zA-Z\s]{2,30})$/.exec(text.trim());
  if (m) {
    const nested = resolvePlace(m[1].trim());
    if (nested) return { city: nested.name, lat: nested.latitude, lon: nested.longitude };
    return { city: m[1].trim(), lat: null, lon: null };
  }
  return { city: null, lat: null, lon: null };
}

const INTENT_KEYWORDS: Array<[RegExp, AiIntent]> = [
  [/\b(donor|donate|donation|volunteer)\b/i, "find_donor"],
  [/\b(blood bank|bb|centre|center|bank near)\b/i, "find_blood_bank"],
  [/\b(emergency request|raise request|create request|need blood urgently)\b/i, "emergency_request"],
  [/\b(register|sign ?up|become a donor|join as)\b/i, "donor_registration"],
  [/\b(compatib|can .* receive|match with|group .* match)\b/i, "blood_compatibility"],
  [/\b(status|track|my request|request status)\b/i, "request_status"],
  [/\b(hospital near|nearest hospital)\b/i, "nearby_hospital"],
  [/\b(help|how does|what can|commands?)\b/i, "help"],
  // "want" is how real requests are phrased ("i want o- blood"). The donor
  // pattern above runs first, so "want to donate" still routes to find_donor.
  [/\b(find|search|need|want|require|looking for|arrange|available)\b/i, "find_blood"],
];

function detectIntent(text: string, bloodGroup: BloodGroup | null): AiIntent {
  for (const [re, intent] of INTENT_KEYWORDS) {
    if (re.test(text)) {
      // "find blood donors" must not collapse to find_blood
      if (intent === "find_blood" && /\bdonor/.test(text)) return "find_donor";
      if (intent === "find_blood_bank" && /\bdonor/.test(text)) return "find_donor";
      if (intent === "find_donor" && bloodGroup && /\bblood bank\b/.test(text)) return "find_blood_bank";
      return intent;
    }
  }
  return bloodGroup ? "find_blood" : "help";
}

// ---------------------------------------------------------------------------
// Local extractor
// ---------------------------------------------------------------------------

export function extractIntentLocal(message: string, history: ChatTurn[] = []): StructuredIntent {
  const text = message.trim();

  const blood = detectBloodGroup(text);
  const component = detectComponent(text);
  const quantity = detectQuantity(text);
  const { urgency, hours } = detectUrgency(text);
  const radius = detectRadius(text);
  const location = detectLocation(text);

  const detectedIntent = detectIntent(text, blood?.group ?? null);

  const next: StructuredIntent = {
    intent: detectedIntent,
    blood_group: blood?.group ?? null,
    component,
    quantity: quantity ?? 1,
    location: { city: location.city, latitude: location.lat, longitude: location.lon },
    radius_km: radius ?? (urgency === "emergency" ? 25 : 50),
    urgency,
    time_window_hours: hours,
    rare_blood: blood?.rare ?? false,
    missing: [],
  };

  // Conversation memory: only fill what this message did not say.
  if (history.length > 0) {
    const prior = replayHistory(history);
    next.blood_group = next.blood_group ?? prior.blood_group;
    next.rare_blood = next.rare_blood || (next.blood_group ? prior.rare_blood : false);
    next.component = next.component ?? prior.component;
    next.location.city = next.location.city ?? prior.location.city;
    if (next.location.latitude === null) {
      next.location.latitude = prior.location.latitude;
      next.location.longitude = prior.location.longitude;
    }
    next.quantity = quantity ?? prior.quantity;
    if (urgency === "routine") next.urgency = prior.urgency;
    if (radius === null && prior.radius_km !== 50) next.radius_km = prior.radius_km;
    // Intent: keep the strongest actionable intent from earlier turns.
    if (detectedIntent === "help" && prior.intent !== "help") next.intent = prior.intent;
    else if (
      (detectedIntent === "find_blood" || detectedIntent === "find_blood_bank") &&
      prior.intent === "emergency_request"
    ) {
      next.intent = prior.intent;
    }
  }

  next.missing = missingFields(next);
  return next;
}

/** Fold earlier user turns into a single accumulated intent. */
export function replayHistory(history: ChatTurn[]): StructuredIntent {
  let acc: StructuredIntent = { ...EMPTY_INTENT, location: { ...EMPTY_INTENT.location } };
  for (const turn of history) {
    if (turn.role !== "user") continue;
    const parsed = extractIntentLocal(turn.content, []);
    acc = {
      intent: parsed.intent !== "help" ? parsed.intent : acc.intent,
      blood_group: parsed.blood_group ?? acc.blood_group,
      component: parsed.component ?? acc.component,
      quantity: parsed.quantity ?? acc.quantity,
      location: {
        city: parsed.location.city ?? acc.location.city,
        latitude: parsed.location.latitude ?? acc.location.latitude,
        longitude: parsed.location.longitude ?? acc.location.longitude,
      },
      radius_km: parsed.radius_km !== 50 ? parsed.radius_km : acc.radius_km,
      urgency:
        parsed.urgency !== "routine" ? parsed.urgency : acc.urgency,
      time_window_hours: parsed.time_window_hours ?? acc.time_window_hours,
      rare_blood: parsed.rare_blood || acc.rare_blood,
      missing: [],
    };
  }
  acc.missing = missingFields(acc);
  return acc;
}

/** Minimum viable fields before we can run a search. */
export function missingFields(intent: StructuredIntent): string[] {
  const missing: string[] = [];
  const needsRequirements =
    intent.intent === "find_blood" ||
    intent.intent === "find_donor" ||
    intent.intent === "emergency_request";

  if (needsRequirements && !intent.blood_group) missing.push("blood_group");
  if (
    needsRequirements &&
    !intent.location.city &&
    intent.location.latitude === null
  ) {
    missing.push("location");
  }
  if (intent.intent === "donor_registration" && !intent.blood_group) missing.push("blood_group");
  if (intent.intent === "donor_registration") missing.push("city");
  if (intent.intent === "help") missing.push("intent");
  return missing;
}

const QUESTION_FOR: Record<string, string> = {
  blood_group: "Which blood group do you need?",
  location: "Which city or area should I search around?",
  intent: "Tell me what you need — blood, a donor, or a blood bank.",
};

/** Ask exactly one question at a time — never a form. */
export function nextQuestion(intent: StructuredIntent): string | null {
  const first = intent.missing[0];
  if (!first) return null;
  if (first === "city") return "Which city are you in?";
  return QUESTION_FOR[first] ?? null;
}

export function isActionable(intent: StructuredIntent): boolean {
  return intent.missing.length === 0 && intent.intent !== "help";
}

// ---------------------------------------------------------------------------
// Validation (server-side, applied to LLM output too)
// ---------------------------------------------------------------------------

export function validateIntent(raw: unknown): StructuredIntent {
  const base: StructuredIntent = {
    ...EMPTY_INTENT,
    location: { ...EMPTY_INTENT.location },
    missing: [],
  };
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;

  const intent = AI_INTENTS.includes(r.intent as AiIntent)
    ? (r.intent as AiIntent)
    : base.intent;

  let bloodGroup: BloodGroup | null = null;
  if (typeof r.blood_group === "string" && r.blood_group.trim()) {
    bloodGroup = normalizeBloodGroup(r.blood_group)?.code ?? null;
  }

  const component =
    typeof r.component === "string" && r.component
      ? (r.component.toUpperCase() as BloodComponent)
      : null;
  const validComponents = [
    "WHOLE_BLOOD",
    "PRBC",
    "PLATELETS",
    "SDP",
    "FFP",
    "CRYO",
    "GRANULOCYTES",
  ];

  const quantityRaw = Number(r.quantity);
  const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? Math.min(50, Math.floor(quantityRaw)) : 1;

  const loc = (r.location ?? {}) as Record<string, unknown>;
  const lat = typeof loc.latitude === "number" ? loc.latitude : null;
  const lon = typeof loc.longitude === "number" ? loc.longitude : null;

  const radiusRaw = Number(r.radius_km);
  const urgencyRaw = String(r.urgency ?? "routine");
  const hoursRaw = Number(r.time_window_hours);

  const validated: StructuredIntent = {
    intent,
    blood_group: bloodGroup,
    component: component && validComponents.includes(component) ? component : null,
    quantity,
    location: {
      city: typeof loc.city === "string" && loc.city.trim() ? loc.city.trim().slice(0, 80) : null,
      latitude: lat !== null && Number.isFinite(lat) ? lat : null,
      longitude: lon !== null && Number.isFinite(lon) ? lon : null,
    },
    radius_km:
      Number.isFinite(radiusRaw) && radiusRaw > 0
        ? Math.min(300, Math.max(1, Math.round(radiusRaw)))
        : 50,
    urgency:
      urgencyRaw === "emergency" || urgencyRaw === "urgent" || urgencyRaw === "routine"
        ? (urgencyRaw as Urgency)
        : "routine",
    time_window_hours:
      Number.isFinite(hoursRaw) && hoursRaw > 0 ? Math.min(168, Math.round(hoursRaw)) : null,
    rare_blood:
      typeof r.rare_blood === "boolean"
        ? r.rare_blood
        : Boolean(bloodGroup && (bloodGroup === "OH" || bloodGroup === "P-BOMBAY")),
    missing: [],
  };

  // Never let a model mark an ordinary group as rare, or vice versa.
  if (validated.blood_group && (validated.blood_group === "OH" || validated.blood_group === "P-BOMBAY")) {
    validated.rare_blood = true;
  }
  if (validated.blood_group && validated.blood_group !== "OH" && validated.blood_group !== "P-BOMBAY") {
    if (validated.rare_blood && !/\b(bombay|para)\b/i.test(JSON.stringify(raw))) {
      validated.rare_blood = false;
    }
  }

  validated.missing = missingFields(validated);
  return validated;
}
