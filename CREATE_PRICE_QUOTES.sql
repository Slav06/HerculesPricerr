-- Price Quotes Log - tracks every rate Johnny Boombotz gives out
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS price_quotes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_number TEXT NOT NULL,
    from_zip TEXT,
    to_zip TEXT,
    cubes INT,
    final_rate NUMERIC(8,2),
    rep_name TEXT,
    quoted_at TIMESTAMPTZ DEFAULT now(),
    status TEXT DEFAULT 'quoted',
    followed_up BOOLEAN DEFAULT false,
    follow_up_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for job number lookups
CREATE INDEX IF NOT EXISTS idx_price_quotes_job ON price_quotes (job_number);
CREATE INDEX IF NOT EXISTS idx_price_quotes_status ON price_quotes (status);
CREATE INDEX IF NOT EXISTS idx_price_quotes_rep ON price_quotes (rep_name);

-- RLS: open anon policy
ALTER TABLE price_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon full access on price_quotes"
    ON price_quotes
    FOR ALL
    USING (true)
    WITH CHECK (true);
