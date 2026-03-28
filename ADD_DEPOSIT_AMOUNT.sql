-- Add deposit_amount to job_submissions for the 3-payment split (Deposit / Pick Up / Drop Off).
-- Run this in your Supabase SQL Editor.

ALTER TABLE job_submissions
  ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(10,2);

COMMENT ON COLUMN job_submissions.deposit_amount IS 'Admin-set deposit charged at signing (CC authorization step). Remaining balance split evenly into Pick Up and Drop Off.';
