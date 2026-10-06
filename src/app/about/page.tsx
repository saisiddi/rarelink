import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Database, Cpu, MapPin, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "The RARELINK architecture: AI at the front door, deterministic search behind it.",
};

export const dynamic = "force-dynamic";

const PIPELINE = [
  { step: "User message", detail: "“Need Bombay blood group urgently in Bangalore.”" },
  { step: "Intent extraction", detail: "LLM labels the request; a deterministic parser fills any gaps and always wins on facts it detected." },
  { step: "Server-side validation", detail: "Every field is clamped and checked against known groups, components and enums." },
  { step: "Backend search", detail: "Bounding-box SQL fetch, compatibility filter, provider aggregation with conflict detection." },
  { step: "Ranking engine", detail: "Availability 35% · freshness 20% · distance 20% · verification 15% · emergency 10%." },
  { step: "Result cards", detail: "WHAT / WHERE / HOW FAR / HOW FRESH / CAN I CONTACT / IS IT VERIFIED." },
  { step: "Short summary", detail: "The model narrates the verified JSON — or a template does, if the model is unavailable." },
];

const PILLARS = [
  {
    icon: Cpu,
    title: "AI at the front door, not the source of truth",
    body: "The model understands language. It never decides availability, compatibility, distance or eligibility — those come from code and data.",
  },
  {
    icon: Database,
    title: "Provider abstraction",
    body: "A BloodDataProvider interface with local, eRaktKosh and Indian Red Cross implementations. Conflicting values are surfaced, never merged silently.",
  },
  {
    icon: MapPin,
    title: "Real coordinates",
    body: "Distances are computed with haversine over a bounding-box query today and ST_DWithin on PostGIS in production. Geocoding is provider-based and cached.",
  },
  {
    icon: ShieldCheck,
    title: "Privacy by design",
    body: "Public donor projections exclude contact columns at the SQL level. No addresses, no IDs, no medical history in results or analytics.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">How RARELINK works</p>
      <h1 className="mt-1 text-balance text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        The chatbot is the front door. The intelligence is behind it.
      </h1>
      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-ink-soft">
        An emergency blood platform cannot afford a model that guesses. RARELINK separates language
        understanding from factual resolution so every number on screen is traceable to a source, a
        timestamp and a verification state.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-bold text-ink">The pipeline</h2>
        <ol className="mt-4 space-y-2">
          {PIPELINE.map((p, i) => (
            <li key={p.step} className="card flex gap-4 p-4">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-sm font-bold text-brand tabular">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold text-ink">{p.step}</p>
                <p className="text-sm text-ink-soft">{p.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12 grid gap-4 sm:grid-cols-2">
        {PILLARS.map((p) => {
          const Icon = p.icon;
          return (
            <article key={p.title} className="card p-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-navy text-white">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-3 font-semibold text-ink">{p.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{p.body}</p>
            </article>
          );
        })}
      </section>

      <section className="mt-12 card p-6">
        <h2 className="text-xl font-bold text-ink">Data sources</h2>
        <ul className="mt-3 space-y-2 text-sm text-ink-soft">
          <li>
            <strong className="text-ink">eRaktKosh</strong> — Government of India blood bank
            inventory, directory, nearby search and rare-group registry. Wired through an adapter
            that stays inert until an endpoint is configured; no unofficial scraping is part of the
            architecture.
          </li>
          <li>
            <strong className="text-ink">Indian Red Cross Society</strong> — blood centre network and
            eBloodServices emergency workflow, integrated through the same provider interface.
          </li>
          <li>
            <strong className="text-ink">RARELINK verified directory</strong> — imported and verified
            records, plus the voluntary rare-donor registry.
          </li>
        </ul>
        <p className="mt-4 rounded-xl bg-canvas px-3 py-2.5 text-xs text-ink-mute">
          RARELINK does not claim any official government affiliation. Labels such as “Data source:
          eRaktKosh” indicate provenance, not partnership.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/demo" className="inline-flex h-10 items-center gap-2 rounded-xl bg-navy px-4 text-sm font-semibold text-white">
            See the demo dataset <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link href="/privacy" className="inline-flex h-10 items-center gap-2 rounded-xl border border-line px-4 text-sm font-semibold text-ink">
            Privacy &amp; consent
          </Link>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-bold text-ink">Failure modes are part of the design</h2>
        <ul className="mt-3 grid gap-2 text-sm text-ink-soft sm:grid-cols-2">
          <li className="card p-4">Model unavailable → deterministic parser + template summary, search still works.</li>
          <li className="card p-4">Provider unavailable → notice on screen, directory results still listed.</li>
          <li className="card p-4">Stale inventory → status downgraded to STALE and labelled with age.</li>
          <li className="card p-4">Conflicting sources → “call to confirm”, never a silent merge.</li>
          <li className="card p-4">Location denied → manual city entry, every query still works.</li>
          <li className="card p-4">Empty results → widen radius, switch city, or try a compatible group.</li>
        </ul>
      </section>
    </div>
  );
}
