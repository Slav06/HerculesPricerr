-- Add success_chance column to job_submissions table
-- Stores 0-100 integer set from the status popup slider

ALTER TABLE job_submissions
ADD COLUMN IF NOT EXISTS success_chance INTEGER DEFAULT NULL
CHECK (success_chance IS NULL OR (success_chance >= 0 AND success_chance <= 100));
