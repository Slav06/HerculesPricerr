-- Add job linkage columns to transactions table
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS job_submission_id BIGINT REFERENCES job_submissions(id) ON DELETE SET NULL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS job_number TEXT;
