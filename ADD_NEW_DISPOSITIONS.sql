-- Add new disposition statuses to the job_submissions table
-- This script adds support for 'disqualified' and 'hung_up' statuses

-- Update the status column to allow the new values
-- Note: This assumes the status column already exists and has a CHECK constraint or enum
-- If using a CHECK constraint, you'll need to drop and recreate it

-- For PostgreSQL with CHECK constraint:
-- Drop existing constraint if it exists (ignore error if it doesn't exist)
DO $$ 
BEGIN
    ALTER TABLE job_submissions DROP CONSTRAINT IF EXISTS job_submissions_status_check;
EXCEPTION
    WHEN undefined_object THEN
        -- Constraint doesn't exist, that's fine
        NULL;
END $$;

-- Add new constraint with additional statuses
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
    'completed', 
    'cancelled'
));

-- Alternative approach if using ENUM type:
-- CREATE TYPE job_status_enum AS ENUM (
--     'pending', 
--     'inv_done', 
--     'transferred', 
--     'dropped', 
--     'cb_scheduled', 
--     'disqualified', 
--     'hung_up', 
--     'completed', 
--     'cancelled'
-- );
-- 
-- ALTER TABLE job_submissions 
-- ALTER COLUMN status TYPE job_status_enum 
-- USING status::job_status_enum;

-- Add comments for documentation
COMMENT ON COLUMN job_submissions.status IS 'Job status: pending, inv_done, transferred, dropped, cb_scheduled, disqualified, hung_up, completed, cancelled';

-- Create index for better performance on status queries
CREATE INDEX IF NOT EXISTS idx_job_submissions_status ON job_submissions(status);

-- Update any existing records that might have invalid status values (optional)
-- UPDATE job_submissions 
-- SET status = 'pending' 
-- WHERE status NOT IN (
--     'pending', 
--     'inv_done', 
--     'transferred', 
--     'dropped', 
--     'cb_scheduled', 
--     'disqualified', 
--     'hung_up', 
--     'completed', 
--     'cancelled'
-- );

-- Verify the update
SELECT 
    status,
    COUNT(*) as count
FROM job_submissions 
GROUP BY status 
ORDER BY status;
