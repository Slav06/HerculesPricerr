-- Sandy self-improvement system — custom rules table
-- Run this in Supabase SQL Editor

CREATE TABLE sandy_custom_rules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    rule_type TEXT NOT NULL DEFAULT 'track_keyword',  -- track_keyword, general
    keyword TEXT NOT NULL,
    action TEXT DEFAULT 'note',  -- note, suggest
    intel_text TEXT,             -- what to add to deal notes when keyword is found
    suggestion_text TEXT,        -- optional suggestion to add
    created_by TEXT,             -- who taught Sandy this rule
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sandy_custom_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON sandy_custom_rules FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_sandy_rules_active ON sandy_custom_rules(active);
CREATE INDEX idx_sandy_rules_keyword ON sandy_custom_rules(keyword);
