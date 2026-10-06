"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Siren } from "lucide-react";

/**
 * Route-level error boundary. Deliberately does NOT mention the AI: a failure
 * here is a rendering or data failure, and the deterministic search paths are
 * the thing we point people back to.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaced to the developer console only — never sends PII anywhere.
    console.error("RARELINK page error", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[55dvh] max-w-2xl flex-col justify-center px-4 py-14 sm:px-6">
      <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-danger">
        <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Something went wrong
      </p>
      <h1 className="mt-2 text-balance text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        This page failed to load.
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-ink-soft">
        Try again — if it keeps failing, use the search page directly, which does not depend on this
        view. In an emergency, call your blood bank rather than waiting on a website.
      </p>

      <div className="mt-7 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-navy px-4 text-sm font-semibold text-white"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
        </button>
        <Link
          href="/search"
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink"
        >
          Go to search
        </Link>
        <Link
          href="/emergency"
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-danger bg-danger-soft px-4 text-sm font-semibold text-danger"
        >
          <Siren className="h-4 w-4" aria-hidden="true" /> Emergency request
        </Link>
      </div>

      {error.digest ? (
        <p className="mt-8 rounded-xl bg-canvas px-3 py-2.5 font-mono text-xs text-ink-mute">
          Reference: {error.digest}
        </p>
      ) : null}
    </div>
  );
}
