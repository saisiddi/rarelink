import { handleChat } from "@/lib/ai/respond";
import { isAiConfigured, rateLimit } from "@/lib/ai/openrouter";
import { badRequest, clientIp, guard, json } from "@/lib/api";

const MAX_MESSAGE_LENGTH = 1_500;
const LIMIT = Number(process.env.AI_RATE_LIMIT_PER_MINUTE || 20);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = guard(async (req: Request) => {
  const ip = clientIp(req);
  if (!rateLimit(`ai:${ip}`, LIMIT)) {
    return json({ error: "Too many messages. Please wait a moment." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const payload = (body ?? {}) as {
    message?: unknown;
    sessionId?: unknown;
    coordinates?: { latitude?: number; longitude?: number } | null;
  };

  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  if (!message) return badRequest("message is required");
  if (message.length > MAX_MESSAGE_LENGTH) {
    return badRequest(`message must be under ${MAX_MESSAGE_LENGTH} characters`);
  }

  const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : null;
  const coordinates =
    payload.coordinates &&
    typeof payload.coordinates.latitude === "number" &&
    typeof payload.coordinates.longitude === "number"
      ? {
          latitude: clamp(payload.coordinates.latitude, -90, 90),
          longitude: clamp(payload.coordinates.longitude, -180, 180),
        }
      : null;

  const response = await handleChat({ sessionId, message, coordinates });
  return json(response);
});

export const GET = guard(async () => {
  return json({ available: isAiConfigured(), model: process.env.OPENROUTER_MODEL || null });
});

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
