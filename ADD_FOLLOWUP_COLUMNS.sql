-- Add follow-up columns to job_submissions table
-- This allows closers to add notes and schedule callbacks

-- Add follow-up related columns
ALTER TABLE job_submissions 
ADD COLUMN IF NOT EXISTS closer_notes TEXT,
ADD COLUMN IF NOT EXISTS callback_date DATE,
ADD COLUMN IF NOT EXISTS callback_time TIME,
ADD COLUMN IF NOT EXISTS callback_datetime TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS follow_up_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS follow_up_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index for callback_datetime for efficient follow-up queries
CREATE INDEX IF NOT EXISTS idx_job_submissions_callback_datetime 
ON job_submissions(callback_datetime) 
WHERE callback_datetime IS NOT NULL;

-- Create index for assigned closers
CREATE INDEX IF NOT EXISTS idx_job_submissions_transferred_to 
ON job_submissions(transferred_to) 
WHERE transferred_to IS NOT NULL;

-- Add a trigger to automatically update follow_up_updated_at
CREATE OR REPLACE FUNCTION update_follow_up_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.follow_up_updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for follow-up updates
DROP TRIGGER IF EXISTS trigger_update_follow_up_timestamp ON job_submissions;
CREATE TRIGGER trigger_update_follow_up_timestamp
    BEFORE UPDATE ON job_submissions
    FOR EACH ROW
    WHEN (OLD.closer_notes IS DISTINCT FROM NEW.closer_notes 
       OR OLD.callback_date IS DISTINCT FROM NEW.callback_date 
       OR OLD.callback_time IS DISTINCT FROM NEW.callback_time 
       OR OLD.callback_datetime IS DISTINCT FROM NEW.callback_datetime)
    EXECUTE FUNCTION update_follow_up_timestamp();

-- Add a function to automatically set callback_datetime from date and time
CREATE OR REPLACE FUNCTION set_callback_datetime()
RETURNS TRIGGER AS $$
BEGIN
    -- If callback_date and callback_time are provided, combine them
    IF NEW.callback_date IS NOT NULL AND NEW.callback_time IS NOT NULL THEN
        NEW.callback_datetime = (NEW.callback_date::text || ' ' || NEW.callback_time::text)::timestamp with time zone;
    ELSIF NEW.callback_datetime IS NOT NULL THEN
        -- If callback_datetime is provided directly, extract date and time
        NEW.callback_date = NEW.callback_datetime::date;
        NEW.callback_time = NEW.callback_datetime::time;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically set callback_datetime
DROP TRIGGER IF EXISTS trigger_set_callback_datetime ON job_submissions;
CREATE TRIGGER trigger_set_callback_datetime
    BEFORE INSERT OR UPDATE ON job_submissions
    FOR EACH ROW
    EXECUTE FUNCTION set_callback_datetime();

-- Verify the columns were added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'job_submissions' 
AND column_name IN ('closer_notes', 'callback_date', 'callback_time', 'callback_datetime', 'follow_up_created_at', 'follow_up_updated_at')
ORDER BY column_name;
