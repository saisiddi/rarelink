import { NextResponse } from "next/server";

export function json(data: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, {
    ...init,
    headers: {
      "cache-control": "no-store",
      ...(init?.headers ?? {}),
    },
  });
}

export function badRequest(message: string, details?: unknown): NextResponse {
  return json({ error: message, details }, { status: 400 });
}

export function serverError(message = "Something went wrong"): NextResponse {
  return json({ error: message }, { status: 500 });
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "local";
}

/** Wraps a handler so a thrown error never returns an HTML stack trace. */
export function guard<T extends unknown[]>(
  handler: (...args: T) => Promise<Response> | Response,
) {
  return async (...args: T): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      console.error("[rarelink]", err instanceof Error ? err.message : err);
      return serverError();
    }
  };
}
