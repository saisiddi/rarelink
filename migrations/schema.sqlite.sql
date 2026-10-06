-- ---------------------------------------------------------------------------
-- RARELINK — SQLite schema (canonical)
--
-- Portable by design: plain types, no SQLite-only behaviour required beyond
-- `INTEGER PRIMARY KEY` and `CHECK` constraints. A PostGIS equivalent lives in
-- `migrations/postgres.sql` where lat/lon become GEOGRAPHY(Point, 4326).
-- ---------------------------------------------------------------------------

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- --- Data provenance -------------------------------------------------------
CREATE TABLE IF NOT EXISTS data_sources (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  kind          TEXT NOT NULL,          -- 'official' | 'partner' | 'demo'
  base_url      TEXT,
  attribution   TEXT,
  is_live       INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- --- Blood bank directory --------------------------------------------------
CREATE TABLE IF NOT EXISTS blood_banks (
  id                     TEXT PRIMARY KEY,
  name                   TEXT NOT NULL,
  hospital_name          TEXT,
  address                TEXT NOT NULL,
  city                   TEXT NOT NULL,
  district               TEXT,
  state                  TEXT NOT NULL,
  pincode                TEXT,
  latitude               REAL NOT NULL,
  longitude              REAL NOT NULL,
  phone                  TEXT,
  emergency_phone        TEXT,
  email                  TEXT,
  website                TEXT,
  category               TEXT NOT NULL DEFAULT 'OTHER',
  license_number         TEXT,
  components_supported   TEXT NOT NULL DEFAULT '[]',   -- JSON array
  apheresis_available    INTEGER NOT NULL DEFAULT 0,
  opening_hours          TEXT,
  emergency_24x7         INTEGER NOT NULL DEFAULT 0,
  source                 TEXT NOT NULL DEFAULT 'demo',
  source_id              TEXT,
  verified               INTEGER NOT NULL DEFAULT 0,
  is_demo                INTEGER NOT NULL DEFAULT 1,
  last_verified_at       TEXT,
  last_inventory_update  TEXT,
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_blood_banks_city        ON blood_banks(city);
CREATE INDEX IF NOT EXISTS idx_blood_banks_state       ON blood_banks(state);
CREATE INDEX IF NOT EXISTS idx_blood_banks_lat         ON blood_banks(latitude);
CREATE INDEX IF NOT EXISTS idx_blood_banks_lon         ON blood_banks(longitude);
CREATE INDEX IF NOT EXISTS idx_blood_banks_source      ON blood_banks(source);
CREATE INDEX IF NOT EXISTS idx_blood_banks_verified    ON blood_banks(verified);

-- --- Blood inventory -------------------------------------------------------
CREATE TABLE IF NOT EXISTS blood_inventory (
  id                 TEXT PRIMARY KEY,
  blood_bank_id      TEXT NOT NULL REFERENCES blood_banks(id) ON DELETE CASCADE,
  blood_group        TEXT NOT NULL,
  component          TEXT NOT NULL,
  units_available    INTEGER NOT NULL DEFAULT 0,
  availability_status TEXT NOT NULL DEFAULT 'UNKNOWN',
  last_updated_at    TEXT NOT NULL,
  source             TEXT NOT NULL DEFAULT 'demo',
  source_record_id   TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inventory_bank     ON blood_inventory(blood_bank_id);
CREATE INDEX IF NOT EXISTS idx_inventory_group    ON blood_inventory(blood_group);
CREATE INDEX IF NOT EXISTS idx_inventory_component ON blood_inventory(component);
CREATE INDEX IF NOT EXISTS idx_inventory_status   ON blood_inventory(availability_status);
CREATE INDEX IF NOT EXISTS idx_inventory_updated  ON blood_inventory(last_updated_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory
  ON blood_inventory(blood_bank_id, blood_group, component);

-- --- Rare blood group registry --------------------------------------------
CREATE TABLE IF NOT EXISTS rare_blood_groups (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  code                 TEXT NOT NULL UNIQUE,
  system               TEXT NOT NULL,
  description          TEXT NOT NULL,
  compatibility_notes  TEXT NOT NULL,
  verification_required INTEGER NOT NULL DEFAULT 1,
  source               TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);

-- --- Donors ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS donors (
  id                       TEXT PRIMARY KEY,
  display_name             TEXT NOT NULL,
  blood_group              TEXT NOT NULL,
  rare_phenotype           TEXT,
  city                     TEXT NOT NULL,
  district                 TEXT,
  state                    TEXT NOT NULL,
  -- Coarse (area-level) coordinates only. Never a home address.
  latitude                 REAL NOT NULL,
  longitude                REAL NOT NULL,
  availability_status      TEXT NOT NULL DEFAULT 'AVAILABLE',
  verification_status      TEXT NOT NULL DEFAULT 'PENDING',
  verification_label       TEXT NOT NULL DEFAULT 'Self-reported',
  last_donation_date       TEXT,
  eligible_from            TEXT,
  consent_status           TEXT NOT NULL DEFAULT 'GRANTED',
  consent_at               TEXT,
  last_verified_at         TEXT,
  preferred_contact_method TEXT NOT NULL DEFAULT 'SMS',
  emergency_notifications  INTEGER NOT NULL DEFAULT 1,
  -- Private: never selected by any public query, never logged, never returned
  -- by the API. Only the consent-gated contact workflow reads this.
  contact_phone            TEXT,
  contact_email            TEXT,
  is_demo                  INTEGER NOT NULL DEFAULT 1,
  created_at               TEXT NOT NULL,
  updated_at               TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_donors_group   ON donors(blood_group);
CREATE INDEX IF NOT EXISTS idx_donors_rare    ON donors(rare_phenotype);
CREATE INDEX IF NOT EXISTS idx_donors_city    ON donors(city);
CREATE INDEX IF NOT EXISTS idx_donors_state   ON donors(state);
CREATE INDEX IF NOT EXISTS idx_donors_lat     ON donors(latitude);
CREATE INDEX IF NOT EXISTS idx_donors_lon     ON donors(longitude);
CREATE INDEX IF NOT EXISTS idx_donors_verify  ON donors(verification_status);
CREATE INDEX IF NOT EXISTS idx_donors_consent ON donors(consent_status);

-- --- Emergency requests ----------------------------------------------------
CREATE TABLE IF NOT EXISTS emergency_requests (
  id                TEXT PRIMARY KEY,
  request_code      TEXT NOT NULL UNIQUE,
  patient_reference TEXT,
  blood_group       TEXT NOT NULL,
  component         TEXT NOT NULL,
  units_required    INTEGER NOT NULL DEFAULT 1,
  units_found       INTEGER NOT NULL DEFAULT 0,
  rare_phenotype    TEXT,
  hospital_name     TEXT,
  hospital_address  TEXT,
  latitude          REAL,
  longitude         REAL,
  city              TEXT NOT NULL,
  urgency           TEXT NOT NULL DEFAULT 'emergency',
  needed_by         TEXT,
  status            TEXT NOT NULL DEFAULT 'OPEN',
  contact_handle    TEXT,
  created_by        TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_requests_status ON emergency_requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_group  ON emergency_requests(blood_group);
CREATE INDEX IF NOT EXISTS idx_requests_city   ON emergency_requests(city);

-- --- Request ↔ candidate matches ------------------------------------------
CREATE TABLE IF NOT EXISTS donor_matches (
  id                TEXT PRIMARY KEY,
  request_id        TEXT NOT NULL REFERENCES emergency_requests(id) ON DELETE CASCADE,
  candidate_kind    TEXT NOT NULL,      -- 'blood_bank' | 'donor'
  candidate_id      TEXT NOT NULL,
  distance_km       REAL,
  score             REAL NOT NULL DEFAULT 0,
  notified_at       TEXT,
  response           TEXT,              -- 'YES' | 'NOT_AVAILABLE' | null
  responded_at       TEXT,
  created_at        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_matches_request ON donor_matches(request_id);

-- --- Contact requests (privacy-preserving donor outreach) ------------------
CREATE TABLE IF NOT EXISTS donor_requests (
  id             TEXT PRIMARY KEY,
  donor_id       TEXT NOT NULL REFERENCES donors(id) ON DELETE CASCADE,
  request_id     TEXT REFERENCES emergency_requests(id) ON DELETE SET NULL,
  requester_note TEXT,
  requester_city TEXT,
  -- Handle given by the requester; the donor decides whether to respond.
  requester_handle TEXT,
  status         TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING | ACCEPTED | DECLINED | EXPIRED
  created_at     TEXT NOT NULL,
  responded_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_donor_requests_donor ON donor_requests(donor_id);

-- --- Donor verification history -------------------------------------------
CREATE TABLE IF NOT EXISTS verification_records (
  id             TEXT PRIMARY KEY,
  subject_kind   TEXT NOT NULL,         -- 'donor' | 'blood_bank'
  subject_id     TEXT NOT NULL,
  method         TEXT NOT NULL,         -- 'phone_otp' | 'blood_bank' | 'admin' | 'donation_history'
  previous_state TEXT,
  new_state      TEXT NOT NULL,
  actor          TEXT,
  notes          TEXT,
  created_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_verification_subject
  ON verification_records(subject_kind, subject_id);

-- --- Audit log -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id          TEXT PRIMARY KEY,
  action      TEXT NOT NULL,
  subject_kind TEXT,
  subject_id  TEXT,
  actor       TEXT,
  -- Never store OTPs, API keys, government IDs or donor private data.
  metadata    TEXT,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

-- --- AI conversation memory ----------------------------------------------
CREATE TABLE IF NOT EXISTS chat_sessions (
  id          TEXT PRIMARY KEY,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id         TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role       TEXT NOT NULL,             -- 'user' | 'assistant'
  content    TEXT NOT NULL,
  payload    TEXT,                      -- JSON: cards / structured intent
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);

-- --- Privacy-safe analytics ------------------------------------------------
CREATE TABLE IF NOT EXISTS analytics_events (
  id         TEXT PRIMARY KEY,
  event      TEXT NOT NULL,
  metadata   TEXT,                      -- no patient / medical identifiers
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analytics_event ON analytics_events(event);
