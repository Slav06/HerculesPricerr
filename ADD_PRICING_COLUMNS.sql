-- Add pricing columns to job_submissions for lead profile charges
ALTER TABLE public.job_submissions
  ADD COLUMN IF NOT EXISTS per_cf NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fuel_surcharge_pct NUMERIC DEFAULT 15,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_estimate NUMERIC DEFAULT NULL;
