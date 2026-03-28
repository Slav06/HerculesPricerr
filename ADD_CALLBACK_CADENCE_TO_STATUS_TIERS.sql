-- Add callback behavior per status: predetermined cadence or user picks date/time.
-- Run in Supabase SQL Editor once.

ALTER TABLE public.job_status_tiers
  ADD COLUMN IF NOT EXISTS callback_mode text DEFAULT 'user_select',
  ADD COLUMN IF NOT EXISTS callback_cadence_days integer DEFAULT NULL;

COMMENT ON COLUMN public.job_status_tiers.callback_mode IS 'user_select = user picks date/time; cadence = use predetermined cadence';
COMMENT ON COLUMN public.job_status_tiers.callback_cadence_days IS 'When callback_mode = cadence: default hours until callback (e.g. 1, 3, 24)';
