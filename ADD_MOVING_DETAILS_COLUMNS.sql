-- Add new columns for moving details to the job_submissions table
-- Run this in your Supabase SQL editor

ALTER TABLE job_submissions 
ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS moving_from VARCHAR(255),
ADD COLUMN IF NOT EXISTS moving_to VARCHAR(255),
ADD COLUMN IF NOT EXISTS cubes VARCHAR(50),
ADD COLUMN IF NOT EXISTS pickup_date VARCHAR(50),
ADD COLUMN IF NOT EXISTS distance VARCHAR(100);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_customer_name ON job_submissions(customer_name);
CREATE INDEX IF NOT EXISTS idx_moving_from ON job_submissions(moving_from);
CREATE INDEX IF NOT EXISTS idx_moving_to ON job_submissions(moving_to);
CREATE INDEX IF NOT EXISTS idx_cubes ON job_submissions(cubes);
CREATE INDEX IF NOT EXISTS idx_pickup_date ON job_submissions(pickup_date);

-- Add comments to document the new columns
COMMENT ON COLUMN job_submissions.customer_name IS 'Customer name from the moving form';
COMMENT ON COLUMN job_submissions.moving_from IS 'Origin location (city/state)';
COMMENT ON COLUMN job_submissions.moving_to IS 'Destination location (zip code or city)';
COMMENT ON COLUMN job_submissions.cubes IS 'Number of cubes for the move';
COMMENT ON COLUMN job_submissions.pickup_date IS 'Scheduled pickup date';
COMMENT ON COLUMN job_submissions.distance IS 'Distance in miles for the move';

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'job_submissions' 
AND column_name IN ('customer_name', 'moving_from', 'moving_to', 'cubes', 'pickup_date', 'distance')
ORDER BY column_name;
