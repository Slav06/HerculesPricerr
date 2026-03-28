-- Add priority score to job_status_tiers (0-100, higher = shows first in table)
ALTER TABLE public.job_status_tiers
  ADD COLUMN IF NOT EXISTS priority_score INTEGER DEFAULT 50;

COMMENT ON COLUMN public.job_status_tiers.priority_score IS '0-100 priority score. Higher = appears first in jobs table. e.g. New Lead=100, Callback=90, Booked=10';

-- Set sensible defaults based on current tiers
UPDATE public.job_status_tiers SET priority_score = 100 WHERE status_key = 'pending';
UPDATE public.job_status_tiers SET priority_score = 95 WHERE status_key = 'inv_done';
UPDATE public.job_status_tiers SET priority_score = 90 WHERE status_key = 'cb_scheduled';
UPDATE public.job_status_tiers SET priority_score = 85 WHERE status_key = 'transferred';
UPDATE public.job_status_tiers SET priority_score = 70 WHERE status_key = 'quoted';
UPDATE public.job_status_tiers SET priority_score = 20 WHERE status_key = 'dropped';
UPDATE public.job_status_tiers SET priority_score = 15 WHERE status_key = 'disqualified';
UPDATE public.job_status_tiers SET priority_score = 15 WHERE status_key = 'hung_up';
UPDATE public.job_status_tiers SET priority_score = 15 WHERE status_key = 'cancelled';
UPDATE public.job_status_tiers SET priority_score = 10 WHERE status_key = 'completed';
UPDATE public.job_status_tiers SET priority_score = 5 WHERE status_key IN ('booked', 'Booked');
UPDATE public.job_status_tiers SET priority_score = 5 WHERE status_key = 'payment_captured';
