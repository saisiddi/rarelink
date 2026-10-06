/**
 * Server-side OpenRouter client.
 *
 * The API key NEVER reaches the browser. Every call has a timeout, a retry
 * and a hard fallback to the local parser — the app must keep working when
 * the model is unavailable.
 */

const DEFAULT_TIMEOUT_MS = 12_000;
const RETRIES = 1;

export function isAiConfigured(): boolean {
  if (process.env.AI_DISABLED === "true") return false;
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

export function modelId(): string {
  return process.env.OPENROUTER_MODEL?.trim() || "google/gemma-3-27b-it";
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export class AiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiUnavailableError";
  }
}

export async function chatCompletion(
  messages: ChatMessage[],
  opts: { json?: boolean; timeoutMs?: number } = {},
): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) throw new AiUnavailableError("OPENROUTER_API_KEY is not set");

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/json",
          "HTTP-Referer": process.env.OPENROUTER_APP_URL || "http://localhost:3000",
          "X-Title": process.env.OPENROUTER_APP_NAME || "RARELINK",
        },
        body: JSON.stringify({
          model: modelId(),
          messages,
          temperature: 0.1,
          max_tokens: 700,
          ...(opts.json ? { response_format: { type: "json_object" } } : {}),
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 200)}`);
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("OpenRouter returned an empty response");
      return content;
    } catch (err) {
      lastError = err;
      if (attempt < RETRIES) await new Promise((r) => setTimeout(r, 350));
    }
  }

  throw new AiUnavailableError(
    lastError instanceof Error ? lastError.message : "AI request failed",
  );
}

/** Pull the first parseable JSON object out of a model response. */
export function parseJsonLoose(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    /* fall through */
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

// --- simple in-memory rate limiter ----------------------------------------

const buckets = new Map<string, number[]>();

export function rateLimit(key: string, limitPerMinute: number): boolean {
  const now = Date.now();
  const windowStart = now - 60_000;
  const hits = (buckets.get(key) ?? []).filter((t) => t > windowStart);
  if (hits.length >= limitPerMinute) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);

  // Opportunistic cleanup so the map cannot grow without bound.
  if (buckets.size > 5_000) {
    for (const [k, v] of buckets) {
      if (v.every((t) => t <= windowStart)) buckets.delete(k);
    }
  }
  return true;
}
