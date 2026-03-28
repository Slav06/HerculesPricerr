-- Add outcome/disposition tracking columns to job_submissions table
-- This script adds columns to track lead outcomes and dispositions

-- Add outcome tracking columns
ALTER TABLE job_submissions 
ADD COLUMN IF NOT EXISTS lead_outcome VARCHAR(50),
ADD COLUMN IF NOT EXISTS outcome_notes TEXT,
ADD COLUMN IF NOT EXISTS outcome_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS outcome_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS next_followup_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS priority_level INTEGER DEFAULT 0;

-- Create index for priority_level for better sorting performance
CREATE INDEX IF NOT EXISTS idx_job_submissions_priority_level 
ON job_submissions (priority_level DESC);

-- Create index for outcome_date for tracking outcomes
CREATE INDEX IF NOT EXISTS idx_job_submissions_outcome_date 
ON job_submissions (outcome_date);

-- Add comment to document the new columns
COMMENT ON COLUMN job_submissions.lead_outcome IS 'Lead outcome: not_interested, another_followup, booked, or null';
COMMENT ON COLUMN job_submissions.outcome_notes IS 'Additional notes about the lead outcome';
COMMENT ON COLUMN job_submissions.outcome_date IS 'When the outcome was recorded';
COMMENT ON COLUMN job_submissions.outcome_by IS 'Who recorded the outcome';
COMMENT ON COLUMN job_submissions.next_followup_date IS 'When to follow up again (if another_followup)';
COMMENT ON COLUMN job_submissions.priority_level IS 'Priority level: 3=urgent, 2=high, 1=normal, 0=low';

-- Create a function to automatically update the updated_at timestamp when outcome columns are modified
CREATE OR REPLACE FUNCTION update_job_submissions_outcome_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at when outcome columns change
DROP TRIGGER IF EXISTS trigger_update_job_submissions_outcome ON job_submissions;
CREATE TRIGGER trigger_update_job_submissions_outcome
    BEFORE UPDATE OF lead_outcome, outcome_notes, outcome_date, outcome_by, next_followup_date, priority_level ON job_submissions
    FOR EACH ROW
    EXECUTE FUNCTION update_job_submissions_outcome_updated_at();

-- Example query to find high priority follow-up leads for fronters
-- SELECT job_number, customer_name, priority_level, callback_datetime, closer_notes, next_followup_date
-- FROM job_submissions 
-- WHERE lead_outcome IS NULL 
-- AND (callback_datetime IS NOT NULL OR next_followup_date IS NOT NULL)
-- ORDER BY priority_level DESC, callback_datetime ASC, next_followup_date ASC;

PRINT '✅ Outcome tracking columns added successfully!';
PRINT '📝 New columns: lead_outcome, outcome_notes, outcome_date, outcome_by, next_followup_date, priority_level';
PRINT '🔍 Indexes created on priority_level and outcome_date for better performance';
PRINT '⚡ Trigger created to auto-update updated_at on outcome changes';
