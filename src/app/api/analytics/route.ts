import { badRequest, guard, json } from "@/lib/api";
import { track } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = guard(async (req: Request) => {
  let body: { event?: unknown; metadata?: Record<string, unknown> };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return badRequest("Invalid JSON body");
  }
  if (typeof body.event !== "string" || !body.event) return badRequest("event is required");

  await track(body.event, body.metadata);
  return json({ ok: true });
});
