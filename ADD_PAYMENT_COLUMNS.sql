-- Add payment columns to job_submissions table
-- Run this SQL in your Supabase SQL editor

-- Add payment-related columns to job_submissions table
ALTER TABLE job_submissions 
ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50);

-- Add comments for documentation
COMMENT ON COLUMN job_submissions.payment_amount IS 'Payment amount captured (in dollars)';
COMMENT ON COLUMN job_submissions.payment_method IS 'Payment method used (Credit Card, Check, etc.)';
COMMENT ON COLUMN job_submissions.payment_status IS 'Payment status (payment_captured, pending, etc.)';

-- Create index for payment queries
CREATE INDEX IF NOT EXISTS idx_job_submissions_payment_amount ON job_submissions(payment_amount);
CREATE INDEX IF NOT EXISTS idx_job_submissions_payment_status ON job_submissions(payment_status);

-- Update existing records that have payment information
-- This is optional - only run if you want to backfill data
-- UPDATE job_submissions 
-- SET payment_status = 'payment_captured'
-- WHERE status = 'completed' AND user_name = 'Closer Extension';

