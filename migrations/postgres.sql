-- ---------------------------------------------------------------------------
-- RARELINK — PostgreSQL + PostGIS schema
--
-- Same logical model as migrations/schema.sqlite.sql, with real geospatial
-- types. Apply with:
--   psql "$DATABASE_URL" -f migrations/postgres.sql
--
-- The application SQL layer only ever pushes a bounding-box pre-filter; with
-- PostGIS you can replace that with ST_DWithin(geog, ST_MakePoint($1,$2)::geography, $3)
-- without touching the ranking engine.
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS data_sources (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('official','partner','demo')),
  base_url    TEXT,
  attribution TEXT,
  is_live     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS blood_banks (
  id                     TEXT PRIMARY KEY,
  name                   TEXT NOT NULL,
  hospital_name          TEXT,
  address                TEXT NOT NULL,
  city                   TEXT NOT NULL,
  district               TEXT,
  state                  TEXT NOT NULL,
  pincode                TEXT,
  latitude               DOUBLE PRECISION NOT NULL,
  longitude              DOUBLE PRECISION NOT NULL,
  geog                   GEOGRAPHY(POINT, 4326)
                           GENERATED ALWAYS AS (
                             ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
                           ) STORED,
  phone                  TEXT,
  emergency_phone        TEXT,
  email                  TEXT,
  website                TEXT,
  category               TEXT NOT NULL DEFAULT 'OTHER',
  license_number         TEXT,
  components_supported   TEXT NOT NULL DEFAULT '[]',
  apheresis_available    BOOLEAN NOT NULL DEFAULT FALSE,
  opening_hours          TEXT,
  emergency_24x7         BOOLEAN NOT NULL DEFAULT FALSE,
  source                 TEXT NOT NULL DEFAULT 'demo',
  source_id              TEXT,
  verified               BOOLEAN NOT NULL DEFAULT FALSE,
  is_demo                BOOLEAN NOT NULL DEFAULT TRUE,
  last_verified_at       TIMESTAMPTZ,
  last_inventory_update  TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blood_banks_geog ON blood_banks USING GIST (geog);
CREATE INDEX IF NOT EXISTS idx_blood_banks_city  ON blood_banks (lower(city));
CREATE INDEX IF NOT EXISTS idx_blood_banks_state ON blood_banks (lower(state));

CREATE TABLE IF NOT EXISTS blood_inventory (
  id                  TEXT PRIMARY KEY,
  blood_bank_id       TEXT NOT NULL REFERENCES blood_banks(id) ON DELETE CASCADE,
  blood_group         TEXT NOT NULL,
  component           TEXT NOT NULL,
  units_available     INTEGER NOT NULL DEFAULT 0,
  availability_status TEXT NOT NULL DEFAULT 'UNKNOWN',
  last_updated_at     TIMESTAMPTZ NOT NULL,
  source              TEXT NOT NULL DEFAULT 'demo',
  source_record_id    TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (blood_bank_id, blood_group, component)
);

CREATE INDEX IF NOT EXISTS idx_inventory_group    ON blood_inventory (blood_group);
CREATE INDEX IF NOT EXISTS idx_inventory_component ON blood_inventory (component);
CREATE INDEX IF NOT EXISTS idx_inventory_status   ON blood_inventory (availability_status);
CREATE INDEX IF NOT EXISTS idx_inventory_updated  ON blood_inventory (last_updated_at);

CREATE TABLE IF NOT EXISTS rare_blood_groups (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  code                  TEXT NOT NULL UNIQUE,
  system                TEXT NOT NULL,
  description           TEXT NOT NULL,
  compatibility_notes   TEXT NOT NULL,
  verification_required BOOLEAN NOT NULL DEFAULT TRUE,
  source                TEXT NOT NULL,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS donors (
  id                       TEXT PRIMARY KEY,
  display_name             TEXT NOT NULL,
  blood_group              TEXT NOT NULL,
  rare_phenotype           TEXT,
  city                     TEXT NOT NULL,
  district                 TEXT,
  state                    TEXT NOT NULL,
  latitude                 DOUBLE PRECISION NOT NULL,
  longitude                DOUBLE PRECISION NOT NULL,
  geog                     GEOGRAPHY(POINT, 4326)
                             GENERATED ALWAYS AS (
                               ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
                             ) STORED,
  availability_status      TEXT NOT NULL DEFAULT 'AVAILABLE',
  verification_status      TEXT NOT NULL DEFAULT 'PENDING',
  verification_label       TEXT NOT NULL DEFAULT 'Self-reported',
  last_donation_date       DATE,
  eligible_from            DATE,
  consent_status           TEXT NOT NULL DEFAULT 'GRANTED',
  consent_at               TIMESTAMPTZ,
  last_verified_at         TIMESTAMPTZ,
  preferred_contact_method TEXT NOT NULL DEFAULT 'SMS',
  emergency_notifications  BOOLEAN NOT NULL DEFAULT TRUE,
  -- Private: never selected by any public query, never logged.
  contact_phone            TEXT,
  contact_email            TEXT,
  is_demo                  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_donors_geog    ON donors USING GIST (geog);
CREATE INDEX IF NOT EXISTS idx_donors_group   ON donors (blood_group);
CREATE INDEX IF NOT EXISTS idx_donors_rare    ON donors (rare_phenotype);
CREATE INDEX IF NOT EXISTS idx_donors_city    ON donors (lower(city));
CREATE INDEX IF NOT EXISTS idx_donors_verify  ON donors (verification_status);

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
  latitude          DOUBLE PRECISION,
  longitude         DOUBLE PRECISION,
  city              TEXT NOT NULL,
  urgency           TEXT NOT NULL DEFAULT 'emergency',
  needed_by         TIMESTAMPTZ,
  status            TEXT NOT NULL DEFAULT 'OPEN',
  contact_handle    TEXT,
  created_by        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS donor_matches (
  id             TEXT PRIMARY KEY,
  request_id     TEXT NOT NULL REFERENCES emergency_requests(id) ON DELETE CASCADE,
  candidate_kind TEXT NOT NULL,
  candidate_id   TEXT NOT NULL,
  distance_km    DOUBLE PRECISION,
  score          DOUBLE PRECISION NOT NULL DEFAULT 0,
  notified_at    TIMESTAMPTZ,
  response       TEXT,
  responded_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS donor_requests (
  id               TEXT PRIMARY KEY,
  donor_id         TEXT NOT NULL REFERENCES donors(id) ON DELETE CASCADE,
  request_id       TEXT REFERENCES emergency_requests(id) ON DELETE SET NULL,
  requester_note   TEXT,
  requester_city   TEXT,
  requester_handle TEXT,
  status           TEXT NOT NULL DEFAULT 'PENDING',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS verification_records (
  id             TEXT PRIMARY KEY,
  subject_kind   TEXT NOT NULL,
  subject_id     TEXT NOT NULL,
  method         TEXT NOT NULL,
  previous_state TEXT,
  new_state      TEXT NOT NULL,
  actor          TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          TEXT PRIMARY KEY,
  action      TEXT NOT NULL,
  subject_kind TEXT,
  subject_id  TEXT,
  actor       TEXT,
  metadata    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id         TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id         TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role       TEXT NOT NULL,
  content    TEXT NOT NULL,
  payload    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id         TEXT PRIMARY KEY,
  event      TEXT NOT NULL,
  metadata   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
