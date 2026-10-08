-- ================================================================
-- SafeCargo 00003_remote_reset
-- ---------------------------------------------------------------
-- Adds reset_pending flag to public.devices for remote reset command queue.
-- ================================================================

ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS reset_pending BOOLEAN NOT NULL DEFAULT FALSE;
