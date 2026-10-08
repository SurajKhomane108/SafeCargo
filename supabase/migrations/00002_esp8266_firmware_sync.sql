-- ================================================================
-- SafeCargo 00002_esp8266_firmware_sync
-- ---------------------------------------------------------------
-- Enhancements for exact ESP8266 firmware alignment:
--   1. Adds event_id column to public.events
--   2. Adds UNIQUE constraint on (device_id, event_id) for idempotent
--      upload retries and deduplication
--   3. Adds explicit sensor columns: acceleration_g, tilt_deg,
--      gyro_dps, ldr_value, time_valid
--   4. Adds pending_events counter column to public.devices
-- ================================================================

-- 1. Add firmware-specific columns to public.events if they don't exist
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_id        INTEGER,
  ADD COLUMN IF NOT EXISTS time_valid      BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS acceleration_g  NUMERIC,
  ADD COLUMN IF NOT EXISTS tilt_deg        NUMERIC,
  ADD COLUMN IF NOT EXISTS gyro_dps        NUMERIC,
  ADD COLUMN IF NOT EXISTS ldr_value       INTEGER;

-- 2. Unique constraint for event deduplication on (device_id, event_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_events_device_event_id'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT uq_events_device_event_id UNIQUE (device_id, event_id);
  END IF;
END $$;

-- 3. Index for fast event_id lookup
CREATE INDEX IF NOT EXISTS idx_events_device_event_id
  ON public.events (device_id, event_id);

-- 4. Add pending_events counter to public.devices
ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS pending_events INTEGER DEFAULT 0;
