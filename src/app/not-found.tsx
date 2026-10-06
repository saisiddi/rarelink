import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Home, Siren } from "lucide-react";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[55dvh] max-w-2xl flex-col justify-center px-4 py-14 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">404</p>
      <h1 className="mt-2 text-balance text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        This page could not be found.
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-ink-soft">
        The link may be out of date, or the record it pointed to may have expired. Nothing about an
        emergency is lost — start again from search, or open a new emergency request.
      </p>

      <div className="mt-7 flex flex-wrap gap-3">
        <Link
          href="/"
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-navy px-4 text-sm font-semibold text-white"
        >
          <Home className="h-4 w-4" aria-hidden="true" /> Back to home
        </Link>
        <Link
          href="/search"
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Search blood
        </Link>
        <Link
          href="/emergency"
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-danger bg-danger-soft px-4 text-sm font-semibold text-danger"
        >
          <Siren className="h-4 w-4" aria-hidden="true" /> Emergency request
        </Link>
      </div>

      <p className="mt-8 rounded-xl bg-canvas px-3 py-2.5 text-xs text-ink-mute">
        RARELINK is an information and coordination platform. It is not a medical diagnosis system
        and not a replacement for doctors, hospitals, blood banks or official transfusion services.
        Always confirm availability by phone before travelling.
      </p>
    </div>
  );
}
