-- Add card-on-file columns to job_submissions so the closer extension can save CC data captured from HelloMoving.
-- Run this in your Supabase SQL Editor.

ALTER TABLE job_submissions
  ADD COLUMN IF NOT EXISTS card_number TEXT,
  ADD COLUMN IF NOT EXISTS expiry_date TEXT,
  ADD COLUMN IF NOT EXISTS cvv TEXT,
  ADD COLUMN IF NOT EXISTS cardholder_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS card_last_four VARCHAR(4),
  ADD COLUMN IF NOT EXISTS card_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS billing_address TEXT;

-- If expiry_date was previously created as VARCHAR(4), widen it:
ALTER TABLE job_submissions ALTER COLUMN expiry_date TYPE TEXT;

COMMENT ON COLUMN job_submissions.card_number IS 'Full card number captured by closer extension from HelloMoving payment form';
COMMENT ON COLUMN job_submissions.expiry_date IS 'Expiry date (MM/YY format) captured by closer extension';
COMMENT ON COLUMN job_submissions.card_last_four IS 'Last 4 digits of card (safe to display)';
COMMENT ON COLUMN job_submissions.card_type IS 'Visa, Mastercard, Amex, Discover, etc.';
