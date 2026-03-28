-- Add cancellation tracking columns to job_submissions table
-- This script adds columns to track who cancelled a booking and when

-- Add cancellation tracking columns
ALTER TABLE job_submissions 
ADD COLUMN IF NOT EXISTS cancelled_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;

-- Create index for cancelled_at for better query performance
CREATE INDEX IF NOT EXISTS idx_job_submissions_cancelled_at 
ON job_submissions (cancelled_at);

-- Add comment to document the new columns
COMMENT ON COLUMN job_submissions.cancelled_by IS 'Name of the user who cancelled the booking';
COMMENT ON COLUMN job_submissions.cancelled_at IS 'Timestamp when the booking was cancelled';

-- Create a function to automatically update the updated_at timestamp when cancellation columns are modified
CREATE OR REPLACE FUNCTION update_job_submissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at when cancellation columns change
DROP TRIGGER IF EXISTS trigger_update_job_submissions_cancellation ON job_submissions;
CREATE TRIGGER trigger_update_job_submissions_cancellation
    BEFORE UPDATE OF cancelled_by, cancelled_at ON job_submissions
    FOR EACH ROW
    EXECUTE FUNCTION update_job_submissions_updated_at();

-- Example query to find recently cancelled bookings
-- SELECT job_number, customer_name, cancelled_by, cancelled_at, status 
-- FROM job_submissions 
-- WHERE cancelled_at IS NOT NULL 
-- ORDER BY cancelled_at DESC;

PRINT '✅ Cancellation tracking columns added successfully!';
PRINT '📝 New columns: cancelled_by, cancelled_at';
PRINT '🔍 Index created on cancelled_at for better performance';
PRINT '⚡ Trigger created to auto-update updated_at on cancellation changes';
