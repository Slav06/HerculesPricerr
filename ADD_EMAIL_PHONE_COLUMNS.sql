-- Add email and phone columns to job_submissions table
-- Run this in your Supabase SQL Editor

ALTER TABLE job_submissions 
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS phone VARCHAR(50);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_job_submissions_email ON job_submissions(email);
CREATE INDEX IF NOT EXISTS idx_job_submissions_phone ON job_submissions(phone);

-- Add comments for documentation
COMMENT ON COLUMN job_submissions.email IS 'Customer email address';
COMMENT ON COLUMN job_submissions.phone IS 'Customer phone number';

-- Verify the columns were added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'job_submissions' 
AND column_name IN ('email', 'phone')
ORDER BY column_name;
