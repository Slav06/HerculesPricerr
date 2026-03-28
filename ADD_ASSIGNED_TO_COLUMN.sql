-- Add assigned_to column to job_submissions table
-- Run this SQL in your Supabase SQL editor

-- Add assigned_to column to job_submissions table
ALTER TABLE job_submissions 
ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(100);

-- Add comment for documentation
COMMENT ON COLUMN job_submissions.assigned_to IS 'User assigned to handle this job (closer, admin, etc.)';

-- Create index for assigned_to queries
CREATE INDEX IF NOT EXISTS idx_job_submissions_assigned_to ON job_submissions(assigned_to);

-- Update existing records to set assigned_to based on user_name
UPDATE job_submissions 
SET assigned_to = user_name 
WHERE assigned_to IS NULL;

-- Verify the changes
SELECT job_number, customer_name, user_name, assigned_to, status, submitted_at 
FROM job_submissions 
ORDER BY submitted_at DESC 
LIMIT 10;
