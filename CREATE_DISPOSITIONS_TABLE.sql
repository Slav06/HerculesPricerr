-- Drop and recreate to ensure clean state
DROP TABLE IF EXISTS disposition_wait_times;
DROP TABLE IF EXISTS dispositions;

-- Create dispositions table
CREATE TABLE dispositions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    category TEXT DEFAULT 'system' CHECK (category IN ('positive', 'negative', 'system')),
    color TEXT DEFAULT '#94a3b8',
    is_final BOOLEAN DEFAULT false,
    dialerr_id INTEGER,
    active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create disposition wait times table
CREATE TABLE disposition_wait_times (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    disposition_id UUID REFERENCES dispositions(id) ON DELETE CASCADE,
    wait_minutes INTEGER NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE dispositions ENABLE ROW LEVEL SECURITY;
ALTER TABLE disposition_wait_times ENABLE ROW LEVEL SECURITY;

-- Allow anon read/write (matches project pattern)
CREATE POLICY "Allow anon full access to dispositions"
    ON dispositions FOR ALL
    USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon full access to disposition_wait_times"
    ON disposition_wait_times FOR ALL
    USING (true) WITH CHECK (true);

-- Seed with current Dialerr dispositions
INSERT INTO dispositions (name, category, color, is_final, sort_order) VALUES
    ('Booked to Competitor', 'negative', '#ef4444', true, 1),
    ('Dropped', 'negative', '#dc2626', true, 2),
    ('No Answer', 'system', '#94a3b8', false, 3),
    ('Voicemail', 'system', '#64748b', false, 4),
    ('Quoted', 'positive', '#3b82f6', false, 5),
    ('Transferred to closer', 'system', '#8b5cf6', false, 6),
    ('Won', 'positive', '#16a34a', true, 7);

-- Default wait times for non-final dispositions
INSERT INTO disposition_wait_times (disposition_id, wait_minutes, sort_order)
SELECT d.id, wt.minutes, wt.ord
FROM dispositions d
CROSS JOIN (VALUES (5, 1), (15, 2), (30, 3), (60, 4), (1440, 5)) AS wt(minutes, ord)
WHERE d.is_final = false AND d.name IN ('No Answer', 'Voicemail', 'Quoted', 'Transferred to closer');
