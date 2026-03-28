-- Add booking-related columns to the job_submissions table
-- This script adds support for tracking booked jobs with financial details

-- Add new columns for booking data
ALTER TABLE job_submissions 
ADD COLUMN IF NOT EXISTS booked_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS total_deposit DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS total_collected DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS total_binder DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS booked_at TIMESTAMP WITH TIME ZONE;

-- Add 'booked' to the status constraint
DO $$ 
BEGIN
    ALTER TABLE job_submissions DROP CONSTRAINT IF EXISTS job_submissions_status_check;
EXCEPTION
    WHEN undefined_object THEN
        -- Constraint doesn't exist, that's fine
        NULL;
END $$;

-- Add updated constraint with 'booked' status
ALTER TABLE job_submissions 
ADD CONSTRAINT job_submissions_status_check 
CHECK (status IN (
    
    'pending', 
    'inv_done', 
    'transferred', 
    'dropped', 
    'cb_scheduled', 
    'disqualified', 
    'hung_up', 
    'booked',
    'completed', 
    'cancelled'
));

-- Add comments for documentation
COMMENT ON COLUMN job_submissions.booked_by IS 'Name of the closer who booked this job';
COMMENT ON COLUMN job_submissions.total_deposit IS 'Total deposit amount collected for this job';
COMMENT ON COLUMN job_submissions.total_collected IS 'Total amount collected for this job';
COMMENT ON COLUMN job_submissions.total_binder IS 'Total binder amount for this job';
COMMENT ON COLUMN job_submissions.booked_at IS 'Timestamp when this job was marked as booked';

-- Create indexes for better performance on booking queries
CREATE INDEX IF NOT EXISTS idx_job_submissions_booked_by ON job_submissions(booked_by);
CREATE INDEX IF NOT EXISTS idx_job_submissions_booked_at ON job_submissions(booked_at);
CREATE INDEX IF NOT EXISTS idx_job_submissions_booked_status ON job_submissions(status) WHERE status = 'booked';

-- Verify the update
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'job_submissions' 
AND column_name IN ('booked_by', 'total_deposit', 'total_collected', 'total_binder', 'booked_at')
ORDER BY column_name;
