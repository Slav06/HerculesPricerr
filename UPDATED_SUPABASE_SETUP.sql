-- Updated Supabase setup for Chrome profile tracking
-- Run this in your Supabase SQL Editor

-- Drop existing table if it exists (be careful with this in production!)
-- DROP TABLE IF EXISTS job_submissions;

-- Create the updated job_submissions table with Chrome profile tracking
CREATE TABLE IF NOT EXISTS job_submissions (
    id BIGSERIAL PRIMARY KEY,
    job_number VARCHAR(255) NOT NULL,
    page_url TEXT,
    source VARCHAR(255) DEFAULT 'Page Price Analyzer Extension',
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_name VARCHAR(100),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Chrome Profile Information
    chrome_profile_id VARCHAR(255),
    chrome_profile_name VARCHAR(255),
    user_identifier VARCHAR(255),
    chrome_email VARCHAR(255),
    is_managed_profile BOOLEAN DEFAULT FALSE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_job_submissions_job_number ON job_submissions(job_number);
CREATE INDEX IF NOT EXISTS idx_job_submissions_submitted_at ON job_submissions(submitted_at);
CREATE INDEX IF NOT EXISTS idx_job_submissions_user_name ON job_submissions(user_name);
CREATE INDEX IF NOT EXISTS idx_job_submissions_chrome_profile_id ON job_submissions(chrome_profile_id);
CREATE INDEX IF NOT EXISTS idx_job_submissions_user_identifier ON job_submissions(user_identifier);

-- Enable Row Level Security (RLS)
ALTER TABLE job_submissions ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all operations for authenticated users
-- This is a basic policy - you can make it more restrictive later
CREATE POLICY "Allow all operations for authenticated users" ON job_submissions
    FOR ALL USING (true);

-- Grant necessary permissions
GRANT ALL ON job_submissions TO authenticated;
GRANT USAGE ON SEQUENCE job_submissions_id_seq TO authenticated;

-- Insert sample data for testing (optional)
INSERT INTO job_submissions (job_number, page_url, source, chrome_profile_id, chrome_profile_name, user_identifier) 
VALUES 
    ('TEST001', 'https://example.com/test1', 'Page Price Analyzer Extension', 'profile_123', 'john.doe', 'john.doe@company.com'),
    ('TEST002', 'https://example.com/test2', 'Page Price Analyzer Extension', 'profile_456', 'jane.smith', 'jane.smith@company.com');

-- View the table structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'job_submissions' 
ORDER BY ordinal_position;
