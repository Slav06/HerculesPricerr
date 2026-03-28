-- Create job_notes table for per-submission notes shared across dashboard and lead profile
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS job_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_submission_id UUID REFERENCES job_submissions(id) ON DELETE CASCADE,
    job_number TEXT,
    author_name TEXT NOT NULL DEFAULT 'Unknown',
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by submission
CREATE INDEX IF NOT EXISTS idx_job_notes_job_submission_id ON job_notes(job_submission_id);
CREATE INDEX IF NOT EXISTS idx_job_notes_job_number ON job_notes(job_number);
CREATE INDEX IF NOT EXISTS idx_job_notes_created_at ON job_notes(created_at DESC);

-- Enable RLS
ALTER TABLE job_notes ENABLE ROW LEVEL SECURITY;

-- Allow anon to read all notes
CREATE POLICY "anon_select_job_notes" ON job_notes
    FOR SELECT TO anon USING (true);

-- Allow anon to insert notes
CREATE POLICY "anon_insert_job_notes" ON job_notes
    FOR INSERT TO anon WITH CHECK (true);

-- Allow anon to update notes (optional, for edits)
CREATE POLICY "anon_update_job_notes" ON job_notes
    FOR UPDATE TO anon USING (true);

-- Allow anon to delete notes (optional)
CREATE POLICY "anon_delete_job_notes" ON job_notes
    FOR DELETE TO anon USING (true);
