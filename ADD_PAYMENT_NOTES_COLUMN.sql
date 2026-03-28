-- Add payment_notes column to job_submissions table
-- This column stores payment history as a JSON array
-- Run this SQL in your Supabase SQL editor

-- Add payment_notes column to store payment history
ALTER TABLE job_submissions 
ADD COLUMN IF NOT EXISTS payment_notes TEXT;

-- Add comment for documentation
COMMENT ON COLUMN job_submissions.payment_notes IS 'Payment history stored as JSON array with payment records including amount, transaction ID, timestamp, etc.';

-- Create index for payment queries (optional, but useful for filtering)
CREATE INDEX IF NOT EXISTS idx_job_submissions_payment_notes ON job_submissions(payment_notes) WHERE payment_notes IS NOT NULL;


