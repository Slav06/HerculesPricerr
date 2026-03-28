-- Add callback attempt tracking to job_submissions
ALTER TABLE public.job_submissions
  ADD COLUMN IF NOT EXISTS callback_attempt INTEGER DEFAULT 0;

-- Add callback rules to job_status_tiers
-- max_attempts: how many times to callback (0 = unlimited, null = use default)
-- wait_times_json: JSON array of minutes between each attempt, e.g. [5, 15, 60, 1440]
ALTER TABLE public.job_status_tiers
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wait_times_json TEXT DEFAULT '[]';

COMMENT ON COLUMN public.job_status_tiers.max_attempts IS '0 = unlimited callbacks, N = stop after N attempts';
COMMENT ON COLUMN public.job_status_tiers.wait_times_json IS 'JSON array of wait minutes per attempt, e.g. [5,15,60]. Last value repeats for extra attempts.';
COMMENT ON COLUMN public.job_submissions.callback_attempt IS 'Current callback attempt number for this lead (resets when status changes)';

-- Seed some default wait times for common statuses
UPDATE public.job_status_tiers SET max_attempts = 5, wait_times_json = '[5, 15, 30, 60, 1440]' WHERE status_key = 'no_answer';
UPDATE public.job_status_tiers SET max_attempts = 3, wait_times_json = '[15, 60, 1440]' WHERE status_key = 'voicemail';
UPDATE public.job_status_tiers SET max_attempts = 0, wait_times_json = '[1440]' WHERE status_key = 'cb_scheduled';
UPDATE public.job_status_tiers SET max_attempts = 0, wait_times_json = '[60]' WHERE status_key = 'quoted';
