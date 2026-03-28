-- Complete Database Update for Job Submissions Table
-- Run this in your Supabase SQL Editor to add all missing columns

-- Add all missing columns for moving details and user management
ALTER TABLE job_submissions 
ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS moving_from VARCHAR(255),
ADD COLUMN IF NOT EXISTS moving_to VARCHAR(255),
ADD COLUMN IF NOT EXISTS cubes VARCHAR(50),
ADD COLUMN IF NOT EXISTS pickup_date VARCHAR(50),
ADD COLUMN IF NOT EXISTS distance VARCHAR(100),
ADD COLUMN IF NOT EXISTS user_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS chrome_profile_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS chrome_profile_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS user_identifier VARCHAR(255),
ADD COLUMN IF NOT EXISTS chrome_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS is_managed_profile BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_customer_name ON job_submissions(customer_name);
CREATE INDEX IF NOT EXISTS idx_moving_from ON job_submissions(moving_from);
CREATE INDEX IF NOT EXISTS idx_moving_to ON job_submissions(moving_to);
CREATE INDEX IF NOT EXISTS idx_cubes ON job_submissions(cubes);
CREATE INDEX IF NOT EXISTS idx_pickup_date ON job_submissions(pickup_date);
CREATE INDEX IF NOT EXISTS idx_user_name ON job_submissions(user_name);
CREATE INDEX IF NOT EXISTS idx_chrome_profile_id ON job_submissions(chrome_profile_id);
CREATE INDEX IF NOT EXISTS idx_user_identifier ON job_submissions(user_identifier);

-- Add comments to document the new columns
COMMENT ON COLUMN job_submissions.customer_name IS 'Customer name from the moving form';
COMMENT ON COLUMN job_submissions.moving_from IS 'Origin location (city/state)';
COMMENT ON COLUMN job_submissions.moving_to IS 'Destination location (zip code or city)';
COMMENT ON COLUMN job_submissions.cubes IS 'Number of cubes for the move';
COMMENT ON COLUMN job_submissions.pickup_date IS 'Scheduled pickup date';
COMMENT ON COLUMN job_submissions.distance IS 'Distance in miles for the move';
COMMENT ON COLUMN job_submissions.user_name IS 'Assigned user for the job';
COMMENT ON COLUMN job_submissions.chrome_profile_id IS 'Chrome profile identifier';
COMMENT ON COLUMN job_submissions.chrome_profile_name IS 'Chrome profile display name';
COMMENT ON COLUMN job_submissions.user_identifier IS 'User identifier from extension';

-- Verify the table structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'job_submissions' 
ORDER BY ordinal_position;
