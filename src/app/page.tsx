import Link from "next/link";
import {
  Zap,
  MapPin,
  Droplet,
  BadgeCheck,
  Lock,
  ArrowRight,
  Siren,
} from "lucide-react";

import { Assistant, QuickActions } from "@/components/Assistant";
import { SectionHeading, Eyebrow } from "@/components/ui";
import { dashboardStats } from "@/lib/analytics";
import { isAiConfigured } from "@/lib/ai/openrouter";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    n: "01",
    title: "Tell us what you need",
    body: "Type it the way you'd say it out loud: “O− urgently near me”, “Bombay blood group in Bengaluru”.",
  },
  {
    n: "02",
    title: "We find verified matches",
    body: "The backend filters by compatibility, distance, freshness and verification — the model never invents a result.",
  },
  {
    n: "03",
    title: "Contact the nearest option",
    body: "Call, get directions, or raise an emergency request. Every card answers what, where, how far, how fresh.",
  },
];

const FEATURES = [
  { icon: Zap, title: "Fast matching", body: "Deterministic search returns ranked options in milliseconds." },
  { icon: MapPin, title: "Location-aware", body: "Real coordinates and distances — never guessed by a model." },
  { icon: Droplet, title: "Rare blood support", body: "Bombay phenotype and other rare groups handled separately from O−." },
  { icon: BadgeCheck, title: "Verified sources", body: "Verification state and data age are shown on every result." },
  { icon: Lock, title: "Privacy-first", body: "No donor phone numbers, addresses or identity data in public results." },
];

export default function HomePage() {
  let stats: ReturnType<typeof dashboardStats> | null = null;
  try {
    stats = dashboardStats();
  } catch {
    stats = null;
  }
  const aiConfigured = isAiConfigured();

  return (
    <>
      {/* ---------------------------------------------------------------- HERO */}
      <section className="relative overflow-hidden bg-navy text-white">
        <div className="hero-grid absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-20">
          <div className="mx-auto max-w-3xl text-center">
            <Eyebrow className="border-white/20 bg-white/10 text-white/85">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />
              Emergency blood intelligence for India
            </Eyebrow>

            <h1 className="mt-6 text-balance text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
              Find the right blood.
              <span className="block text-brand">When every minute matters.</span>
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg">
              Connect with verified blood banks and registered donors based on blood group,
              availability and location — including rare phenotypes like Bombay blood group.
            </p>
          </div>

          <div className="mx-auto mt-9 max-w-3xl">
            <div className="rounded-3xl bg-white/95 p-3 shadow-lift sm:p-4">
              <Assistant autoFocus />
              <QuickActions />
            </div>
            <p className="mt-4 text-center text-xs text-white/55">
              {aiConfigured
                ? "Natural-language answers are summarised by a configured model; all facts come from the backend."
                : "Running in rules-based mode — set OPENROUTER_API_KEY to enable the LLM summary path."}
            </p>
          </div>

          {stats ? (
            <dl className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Blood banks", value: stats.bloodBanks },
                { label: "Registered donors", value: stats.donors },
                { label: "Rare donors", value: stats.rareDonors },
                { label: "Units tracked", value: stats.availableUnits },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center"
                >
                  <dt className="text-[11px] uppercase tracking-wider text-white/55">{s.label}</dt>
                  <dd className="mt-1 text-2xl font-bold tabular">{s.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </section>

      {/* ------------------------------------------------------------- SAFETY */}
      <section className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
        <div className="flex items-start gap-3 rounded-2xl border border-warn/30 bg-warn-soft px-4 py-3">
          <Siren className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-warn">
            Blood availability can change rapidly — please call the blood bank or hospital before
            travelling. This platform is an information and coordination aid, not a medical
            diagnosis system or a replacement for clinicians and official transfusion services.
          </p>
        </div>
      </section>

      {/* --------------------------------------------------------------- STEPS */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <SectionHeading
          eyebrow="How RARELINK works"
          title="Three steps between an emergency and an answer"
          description="The assistant is the front door. Behind it: a compatibility engine, a geospatial ranking engine and a verified directory."
        />

        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step.n} className="card relative p-6">
              <span className="text-sm font-black text-brand">{step.n}</span>
              <h3 className="mt-3 text-lg font-semibold text-ink">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ------------------------------------------------------------ FEATURES */}
      <section className="border-y border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionHeading
            eyebrow="Built for emergencies"
            title="Everything a stressed user needs, nothing they don't"
          />
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <li key={f.title} className="card p-5">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-3 font-semibold text-ink">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{f.body}</p>
                </li>
              );
            })}
            <li className="card flex flex-col justify-between bg-navy p-5 text-white">
              <div>
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-white">
                  <Siren className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-3 font-semibold">Emergency mode</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/70">
                  A minimal, one-glance view: required group, nearest verified options, call and
                  directions — with freshness and verification on every row.
                </p>
              </div>
              <Link
                href="/emergency"
                className="mt-4 inline-flex items-center gap-1.5 py-1.5 text-sm font-semibold text-brand"
              >
                Open emergency mode <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </li>
          </ul>
        </div>
      </section>

      {/* -------------------------------------------------------------- RARE CTA */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="card overflow-hidden">
          <div className="grid gap-6 p-6 sm:p-10 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
                Rare blood workflow
              </p>
              <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-ink">
                Bombay phenotype is not O−.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                People with the Bombay phenotype (Oh) lack A, B and H antigens and require
                Bombay-phenotype blood. RARELINK keeps rare phenotypes in their own registry,
                ranks verified rare donors separately, and always routes confirmation through a
                qualified blood bank.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  href="/rare"
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-navy px-5 text-sm font-semibold text-white hover:bg-navy-soft"
                >
                  Explore rare groups <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/search?bloodGroup=OH&intent=find_donor&city=Bengaluru"
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-line px-5 text-sm font-semibold text-ink hover:border-ink-mute"
                >
                  Find Bombay blood in Bengaluru
                </Link>
              </div>
            </div>
            <div className="rounded-2xl bg-navy p-6 text-white">
              <p className="text-xs uppercase tracking-widest text-white/50">Demo query</p>
              <p className="mt-3 rounded-xl bg-white/10 px-4 py-3 text-sm">
                “Need Bombay blood group urgently in Bangalore.”
              </p>
              <ul className="mt-4 space-y-2 text-sm text-white/75">
                <li>✓ Intent extracted → rare phenotype (not O−)</li>
                <li>✓ Rare-donor registry + verified blood centres searched</li>
                <li>✓ Distance, freshness and verification scored</li>
                <li>✓ Compatibility escalated for blood-bank confirmation</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
