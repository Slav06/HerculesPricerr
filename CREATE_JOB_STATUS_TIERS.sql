-- Job Status Tiers: configurable sort order for dashboard (call-first at top, closed at bottom)
-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS public.job_status_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  tier int NOT NULL DEFAULT 4,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_status_tiers_tier ON public.job_status_tiers(tier);
CREATE INDEX IF NOT EXISTS idx_job_status_tiers_status_key ON public.job_status_tiers(status_key);

COMMENT ON TABLE public.job_status_tiers IS 'Dashboard sort: tier 1 = call first, higher = lower priority, 5–6 = bottom (not good/booked)';

-- Seed default statuses (tiers from JOB_SUBMISSIONS_SORTING_PLAN.md)
INSERT INTO public.job_status_tiers (status_key, display_name, tier) VALUES
  ('inv_done', 'Inv Done', 1),
  ('cb_scheduled', 'CB Scheduled', 1),
  ('transferred', 'Transferred', 2),
  ('pending', 'Pending', 2),
  ('dropped', 'Dropped', 5),
  ('disqualified', 'Disqualified', 5),
  ('hung_up', 'Hung Up', 5),
  ('cancelled', 'Cancelled', 5),
  ('completed', 'Completed', 5),
  ('booked', 'Booked', 6),
  ('Booked', 'Booked', 6),
  ('payment_captured', 'Payment Captured', 6)
ON CONFLICT (status_key) DO NOTHING;
