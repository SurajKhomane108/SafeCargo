-- ================================================================
-- SafeCargo 00001_init_safecargo
-- ---------------------------------------------------------------
-- Reproducible initial schema for SafeCargo IoT cargo monitoring.
-- Run against a fresh Supabase PostgreSQL database.
--
-- Covers:
--   * Enums for status, event_type, severity, source
--   * `devices`  table  (PK id text, auth_token, state snapshot)
--   * `events`   table  (FK device_id, typed event rows)
--   * Indexes, constraints, RLS, policies, grants
--   * Seed device SC-0001 with demo token
--
-- Security notes:
--   * Supabase ANON role gets ONLY SELECT on devices / events
--     (RLS protected). It can NEVER insert/update/delete.
--   * Device writes go through Next.js server routes using the
--     SUPABASE_SERVICE_ROLE_KEY (which bypasses RLS by design).
--   * auth_token_hash is the token the ESP8266 sends as
--       Authorization: Bearer <token>
--     For simplicity in this initial release we store the raw
--     shared-secret token here. In a production upgrade you
--     SHOULD replace this with a hash (bcrypt/argon2/SHA-256)
--     verified server-side.
-- ================================================================

-- ---- Enums -----------------------------------------------------
DO $$ BEGIN
  CREATE TYPE status_level      AS ENUM ('NORMAL','LOW','MEDIUM','WARNING','HIGH','CRITICAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE cargo_event_type  AS ENUM ('SHOCK','TILT','MOTION','LIGHT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE cargo_severity    AS ENUM ('LOW','MEDIUM','HIGH','CRITICAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE cargo_source      AS ENUM ('WIFI','NFC_MANUAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ---- Table: devices --------------------------------------------
CREATE TABLE IF NOT EXISTS public.devices (
  id                   TEXT PRIMARY KEY,                       -- e.g. SC-0001
  name                 TEXT NOT NULL DEFAULT '',
  auth_token_hash      TEXT NOT NULL,                          -- ESP8266 Bearer token. Prod: hash this!
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at         TIMESTAMPTZ,

  -- Current aggregated report snapshot (what the UI shows):
  current_status       status_level NOT NULL DEFAULT 'NORMAL',
  current_max_g        NUMERIC,                                -- peak G-force
  current_max_tilt     NUMERIC,                                -- peak tilt °
  current_max_gyro     NUMERIC,                                -- peak gyro °/s
  current_report_jsonb JSONB                                   -- latest parsed snapshot from firmware
);

-- ---- Table: events ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id    TEXT NOT NULL REFERENCES public.devices(id)
                          ON DELETE CASCADE ON UPDATE CASCADE,
  event_type   cargo_event_type NOT NULL,
  severity     cargo_severity   NOT NULL,
  measurement  NUMERIC,                                        -- e.g. G-force / tilt° / gyro°
  duration_ms  INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  details      JSONB,                                          -- arbitrary per-event extra fields
  source       cargo_source    NOT NULL DEFAULT 'WIFI',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ---- Indexes ---------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_events_device_created
  ON public.events (device_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_created
  ON public.events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_devices_last_seen
  ON public.devices (last_seen_at DESC NULLS LAST);


-- ---- RLS + Policies -------------------------------------------
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events  ENABLE ROW LEVEL SECURITY;

-- Browser (anon / authenticated) can read everything — this is a
-- public cargo-verification UI. Device write is done exclusively
-- via the Next.js server routes with service_role key.

-- Devices — public read
DROP POLICY IF EXISTS devices_select_public ON public.devices;
CREATE POLICY devices_select_public
  ON public.devices FOR SELECT
  USING (true);

-- Events — public read
DROP POLICY IF EXISTS events_select_public ON public.events;
CREATE POLICY events_select_public
  ON public.events FOR SELECT
  USING (true);

-- Note: we intentionally do NOT create anon INSERT/UPDATE/DELETE
-- policies. If you need them later, add them explicitly and
-- think hard about the RLS expression.

-- ---- Grants ----------------------------------------------------
GRANT SELECT ON public.devices TO anon, authenticated;
GRANT SELECT ON public.events  TO anon, authenticated;

-- Service role already has ALL via bypass; give explicit grants
-- so dump / restore keeps them explicit.
GRANT ALL ON public.devices TO service_role;
GRANT ALL ON public.events  TO service_role;


-- ---- Seed device: SC-0001 -------------------------------------
-- Demo / initial device. Change the token BEFORE production use!
--   ESP8266 header: Authorization: Bearer sc_demo_SC0001_token_change_me
INSERT INTO public.devices (id, name, auth_token_hash, current_status)
VALUES (
  'SC-0001',
  'SafeCargo Demo Shipment #1',
  'sc_demo_SC0001_token_change_me',
  'NORMAL'
)
ON CONFLICT (id) DO NOTHING;
