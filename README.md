# RARELINK

**Emergency rare-blood discovery and donor coordination for India.**

Type a plain-English request — *"need Bombay blood group urgently in Bangalore"* — and RARELINK turns it into verified, location-aware matches across blood-bank inventory, blood banks and a rare-donor registry, then tells you exactly what to do next.

> **RARELINK is an information and coordination platform.** It is not a medical
> diagnosis system, not a transfusion service, and not a replacement for
> doctors, hospitals, blood banks or official authorities. It does not claim
> any government affiliation. Always confirm availability by phone before
> travelling.

---

## Quick start

```bash
npm install
npm run setup     # creates data/rarelink.db and loads the demo dataset
npm run dev       # http://localhost:3000
```

That is the whole setup. **No API key is required** — the app runs entirely on
its bundled dataset, and the chat assistant falls back to a deterministic
parser when no model is configured.

```bash
# Optional: enable the LLM path
cp .env.example .env.local
# set OPENROUTER_API_KEY=...

npm test            # 115 unit tests
npm run lint        # ESLint (Next.js core-web-vitals + typescript)
npm run build       # production build
npm run check:ui    # headless mobile + desktop render/a11y pass (server must be running)
```

---

## What makes it trustworthy

### 1. The AI is the front door, never the source of truth

```
user message
   │
   ├─► LLM labels the request ────┐
   │                              ├─► reconcile() ─► StructuredIntent
   └─► deterministic parser ──────┘        (local parser always wins on
                                            facts it detected)
   │
   ▼
server-side validation (every field clamped + checked)
   │
   ▼
deterministic search / compatibility / distance / ranking
   │
   ▼
result cards  +  short summary (template if the model is down)
```

The model may only *label* a request. Availability, compatibility, distance,
verification status and donor eligibility are computed in
[`src/lib/blood/compatibility.ts`](src/lib/blood/compatibility.ts),
[`src/lib/search.ts`](src/lib/search.ts) and
[`src/lib/ranking.ts`](src/lib/ranking.ts) — code that is unit-tested and can
be read line by line. LLM output is validated by `validateIntent()` before it
is used, and unknown intents, groups, components and out-of-range numbers are
discarded rather than trusted.

### 2. Compatibility is a rules engine, not a guess

| Component | Rule |
|---|---|
| PRBC / whole blood | donor must not carry antigens the recipient lacks |
| FFP / SDP | inverse ABO selection; **Rh(D) is not a plasma criterion** |
| PLATELETS | ABO-preferred; RhD-negative recipients escalated to RhD-negative units |
| CRYO | ABO-non-specific, always `confirmation_required` |
| Bombay (Oh) / Para-Bombay | **only** same-phenotype matches, never ordinary O− |

Bombay phenotype is emphatically *not* O−. Asking for Oh returns Oh donors and
blood banks carrying Oh stock, with an explicit note that a qualified blood
bank must confirm before transfusion.

### 3. Freshness is labelled, never implied

Every external record carries `source` + `last_updated_at`, which maps to:

| Status | Default age | Effect |
|---|---|---|
| `LIVE` | < 30 min | shown as-is |
| `RECENT` | < 3 h | shown as-is |
| `STALE` | < 12 h | availability downgraded to `STALE`, "call to confirm" |
| `OUTDATED` | ≥ 12 h | downgraded + explicit outdated banner |
| `UNKNOWN` | no timestamp | never presented as current |

Thresholds are configurable via `FRESHNESS_*_MINUTES`. **There is no
"100% real-time" claim anywhere in the product.**

### 4. Ranking is published and hard-constrained

```
score = 0.35·availability + 0.20·freshness + 0.20·proximity
      + 0.15·verification  + 0.10·emergencyCapability  (+ capped rare boost)
```

Hard rule, enforced in `rank()` and covered by tests: **an unverified
candidate is never ordered above a verified candidate of the same kind**, no
matter how close or how well-scored it is. Verification is a sort tier that
runs *before* the score.

### 5. Every result answers six questions

`WHAT` · `WHERE` · `HOW FAR` · `HOW FRESH` · `CAN I CONTACT` · `IS IT VERIFIED`

---

## Architecture

Next.js full-stack monorepo — UI and API route handlers in one deployable,
no separate backend service.

```
src/
├── app/                    # App Router: pages + API route handlers
│   ├── api/                #   /ai/chat /blood/search /donors/* /emergency/*
│   │                       #   /admin/* /analytics /health /blood-groups /rare-groups
│   └── (search|map|donors|rare|emergency|demo|admin|about|privacy)
├── components/             # Assistant, SearchExplorer, MapView, ResultCard, …
└── lib/
    ├── ai/                 # intent extraction, OpenRouter client, respond.ts
    ├── blood/              # compatibility.ts (the rules), freshness.ts
    ├── db/                 # node:sqlite access layer + seed
    ├── geo/                # haversine, bounding box, gazetteer
    ├── geocoding/          # local | nominatim provider switch
    ├── providers/          # BloodDataProvider: local, eraktkosh, ircs
    ├── api.ts              # json/badRequest/guard (never leaks stack traces)
    ├── search.ts           # search orchestration
    ├── searchParams.ts     # validated query parsing
    └── ranking.ts          # scoring + the verification tier
```

### Storage today: SQLite, tomorrow: Postgres/PostGIS

SQLite via the built-in `node:sqlite` module — **zero native dependencies**, so
`npm install` never compiles anything. Every table and column in
[`migrations/schema.sqlite.sql`](migrations/schema.sqlite.sql) mirrors
[`migrations/postgres.sql`](migrations/postgres.sql).

The geo layer already speaks the PostGIS dialect in spirit: SQL does a
bounding-box pre-filter, then `haversineKm()` refines the distance. To move to
Postgres:

1. Point `DATABASE_PATH` at your connection layer and swap `node:sqlite` for a
   Postgres driver in `src/lib/db/index.ts` — nothing else imports SQL
   directly except feature-local queries.
2. Change the distance step to `ST_DWithin` / `ST_Distance` on
   `GEOGRAPHY(Point, 4326)` columns. `boundingBox()` and `haversineKm()` become
   the fallback path rather than the primary one.
3. Run `migrations/postgres.sql` instead of `schema.sqlite.sql`.

### Data providers

A `BloodDataProvider` interface with three implementations:

| id | Source | Default |
|---|---|---|
| `local` | bundled verified directory + demo inventory | ✅ always on |
| `eraktkosh` | eRaktKosh API | inert until `ERAKTKOSH_BASE_URL` set |
| `ircs` | Indian Red Cross eBloodServices | inert until `IRCS_BASE_URL` set |

```bash
BLOOD_DATA_PROVIDERS=local,eraktkosh,ircs
```

`local` can never be removed — it is what keeps the app useful offline and
when upstreams are down.

**Conflicting inventory is never merged silently.** When two sources disagree
on units/status for the same bank+group+component, the record is flagged
`conflicting`, its status is downgraded to `UNKNOWN`, the competing values are
listed, and the card says *call to confirm*. Provider failures become a
visible data notice, not an empty page.

Labels such as *"Data source: eRaktKosh"* indicate **provenance, not
partnership**. RARELINK claims no official government affiliation.

### Geocoding

The default geocoder is a bundled gazetteer of Indian cities, areas and
landmarks — no third-party call, no usage-policy problem, no network
dependency. Set `GEOCODING_PROVIDER=nominatim` **only** with a self-hosted
`NOMINATIM_BASE_URL`; the public Nominatim instance must not be used for
search traffic. Results are cached either way.

---

## Environment

Everything is optional — see [`.env.example`](.env.example) for the annotated
list.

| Variable | Purpose |
|---|---|
| `OPENROUTER_API_KEY` | server-side only; enables the LLM intent path |
| `OPENROUTER_MODEL` | configurable model, default `google/gemma-3-27b-it` |
| `AI_DISABLED` | force the deterministic path even with a key set |
| `AI_RATE_LIMIT_PER_MINUTE` | per-IP chat limit (default 20) |
| `DATABASE_PATH` | SQLite file (default `./data/rarelink.db`) |
| `SEED_ON_EMPTY` | `false` to start from an empty database |
| `BLOOD_DATA_PROVIDERS` | `local` (default), `local,eraktkosh,ircs` |
| `ERAKTKOSH_BASE_URL`, `IRCS_BASE_URL` | enable live providers |
| `GEOCODING_PROVIDER`, `NOMINATIM_BASE_URL` | local vs self-hosted geocoder |
| `FRESHNESS_LIVE/RECENT/STALE_MINUTES` | freshness thresholds |

The key is read only in `src/lib/ai/openrouter.ts` on the server. There is no
`NEXT_PUBLIC_` variable anywhere in the project.

---

## API

| Method | Route | Notes |
|---|---|---|
| `POST` | `/api/ai/chat` | intent extraction + search + summary; rate-limited; works without a key |
| `GET` | `/api/ai/chat` | `{"available": bool, "model": string \| null}` |
| `GET` | `/api/blood/search` | `?bloodGroup=&component=&city=&radius=&urgency=` — 400 on unknown group/component |
| `GET` | `/api/donors/search` | consent-safe donor projection — **no contact fields** |
| `GET` | `/api/blood-banks/nearby` | `?lat=&lon=` or `?city=` |
| `GET` | `/api/blood-groups`, `/api/rare-groups` | reference data |
| `POST` | `/api/emergency` | requires `bloodGroup`, `city`, `contact` → `201` |
| `GET` | `/api/emergency/[id]` | public status, `404` for unknown ids |
| `POST` | `/api/donors/register` | requires `consent: true` + phone/email |
| `POST` | `/api/donors/[id]/request` | requires `handle` |
| `POST` | `/api/analytics` | allowlisted events only, metadata sanitised |
| `GET` | `/api/admin/stats` | dashboard counters |
| `POST` | `/api/admin/verify-donor`, `/verify-blood-bank` | `action: verify\|suspend\|expire\|pending` |
| `GET` | `/api/health` | liveness + demo mode + provider attribution + row counts |

Errors are JSON with a human-readable `error` field; handlers are wrapped in
`guard()` so a thrown exception returns `500` and never an HTML stack trace.

---

## Pages

| Route | What it does |
|---|---|
| `/` | chat front door + how-it-works |
| `/search` | filters, ranked results, map |
| `/map` | live Leaflet map of inventory and donors |
| `/donors` | consent-gated donor registry (no phone, no address, no ID) |
| `/rare` | rare groups: Bombay, Para-Bombay, Kel, Vel, Jr, … |
| `/emergency` | raise a request; `/emergency/[id]` tracks public status |
| `/demo` | explicitly labelled **fictional** demo dataset |
| `/admin` | verification queue and stats |
| `/about`, `/privacy` | architecture, data sources, consent model |

---

## Privacy

- **Donor contact is never public.** Phone, email, address and government IDs
  are excluded from donor search results at the SQL projection level — not
  hidden with CSS. Contact only happens through the consent-gated request flow.
- **Analytics carry no identifiers.** `sanitise()` drops any key that resolves
  to an identifier (`phone`, `donorId`, `idNumber`, `panNumber`, `apiKey`, …)
  and redacts any *value* that looks like an email, phone number or long digit
  run — so `"note": "call 9876543210"` is stored as `"[redacted]"`. Objects and
  arrays are dropped rather than serialised. Events outside the allowlist are
  ignored.
- **Nothing sensitive is logged.** No OTPs, no API keys, no government IDs, no
  request bodies in application logs.
- **Demo data is fictional.** Seeded records are marked `is_demo = 1`, use
  invented names and carry non-routable all-zero phone numbers.
- Read [`/privacy`](src/app/privacy) for the user-facing statement.

---

## Testing

```bash
npm test
```

115 tests across six files, all pure unit tests against the modules that
actually make safety claims:

| File | Covers |
|---|---|
| `compatibility.test.ts` | ABO/Rh RBC + plasma + platelet rules, **Bombay never collapses to O−** |
| `freshness.test.ts` | LIVE/RECENT/STALE/OUTDATED bucketing, env overrides, stale → `STALE` downgrade |
| `ranking.test.ts` | weights sum to 1, score ≤ 1, **unverified never outranks verified** |
| `intent.test.ts` | parser, clarification loop, conversation memory, untrusted LLM output validation |
| `searchParams.test.ts` | clamping, unknown group → `null`, gazetteer canonicalisation |
| `analytics.test.ts` | identifier keys dropped, PII values redacted, event allowlist (against a real DB) |

Tests run against a throwaway `data/test.db` (see `scripts/test-setup.ts`) and
delete it afterwards. `fileParallelism` is off because the suite shares one
SQLite handle.

### Render / accessibility check

```bash
npm run dev            # or: npm run build && npm start
npm run check:ui       # BASE_URL / CHROMIUM_PATH are overridable
```

`scripts/browser-check.ts` drives headless Chromium over **13 routes × 2
viewports (390px mobile, 1280px desktop)** and fails on:

- any console error, uncaught page error or failed request;
- a missing/`<1` `<h1>`, missing `lang`, missing viewport meta;
- images without `alt`, form controls without a label, links/buttons without an
  accessible name, duplicate `id`s, `_blank` without `noopener`;
- horizontal overflow (reported with the exact elements that cause it);
- tap targets under 24px on mobile — with WCAG 2.5.8's *inline* and *skip-link*
  exceptions applied, and Leaflet's attribution strip excluded.

Screenshots are written to `screenshots/` (gitignored) for eyeballing. The
check currently reports **26/26 renders clean, 0 errors**.

One error is allow-listed as `KNOWN_DEV_ONLY`: React 19's dev-mode profiler
measures a component that `notFound()` tears down mid-render. It is absent from
a production build — run `check:ui` against `npm start` to confirm.

---

## Scripts

| Command | Effect |
|---|---|
| `npm run dev` | dev server (auto-creates and seeds the DB on first use) |
| `npm run build` / `start` | production build / serve |
| `npm run setup` | `db:init` + `db:seed` |
| `npm run db:init` | apply `migrations/schema.sqlite.sql` |
| `npm run db:seed` | load the demo dataset |
| `npm run db:reset` | drop, recreate, reseed |
| `npm test` / `test:watch` | vitest unit suite |
| `npm run lint` | ESLint (flat config, `eslint.config.mjs`) |
| `npm run check:ui` | headless mobile/desktop render + a11y pass |

---

## Known limitations

Being honest about them is part of the design:

- **Demo dataset by default.** Seeded inventory, banks and donors are
  fictional and labelled as such. Live numbers only appear when a real
  provider is configured.
- **No live provider is wired to a real endpoint out of the box.** The
  `eraktkosh` and `ircs` adapters stay inert until you supply base URLs you
  are entitled to use. No unofficial scraping.
- **Haversine over a bounding box, not PostGIS.** Correct for city-scale
  radii; swap in `ST_DWithin` for nationwide scale (see above).
- **Rate limiting is in-process.** Fine for one instance; use a shared store
  before running multiple replicas.
- **Admin has no real auth.** `/admin` demonstrates the workflow; put it
  behind your identity layer before exposing it.
- **SQLite, not a managed database.** Single-writer; the schema is
  Postgres-ready but the driver swap is still a code change.
- **Compatibility is ABO/RhD-level.** Full antigen phenotyping (Kell, Duffy,
  Kidd, Rh subtypes) is modelled for the *rare registry* but not for routine
  cross-matching — that remains a blood bank's job, which is exactly why every
  platelet/cryo/rare result carries `confirmation_required`.
