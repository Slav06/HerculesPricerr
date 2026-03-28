-- Sandy's learned knowledge from sales floor conversations
CREATE TABLE IF NOT EXISTS sandy_knowledge (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category TEXT NOT NULL, -- 'pricing', 'objection', 'script', 'tactic', 'competitor', 'process', 'team_note'
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    source_channel TEXT DEFAULT 'sales-floor',
    confidence NUMERIC DEFAULT 0.8,
    times_seen INTEGER DEFAULT 1,
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track which messages Sandy has already processed
CREATE TABLE IF NOT EXISTS sandy_processed_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    channel_id TEXT NOT NULL,
    message_ts TEXT NOT NULL UNIQUE,
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE sandy_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE sandy_processed_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon full access to sandy_knowledge"
    ON sandy_knowledge FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon full access to sandy_processed_messages"
    ON sandy_processed_messages FOR ALL USING (true) WITH CHECK (true);

-- Track what Sandy has posted (no repeats)
CREATE TABLE IF NOT EXISTS sandy_sent_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_hash TEXT NOT NULL,
    message_preview TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sandy_sent_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon full access to sandy_sent_messages"
    ON sandy_sent_messages FOR ALL USING (true) WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_sandy_knowledge_category ON sandy_knowledge(category);
CREATE INDEX IF NOT EXISTS idx_sandy_processed_ts ON sandy_processed_messages(message_ts);
CREATE INDEX IF NOT EXISTS idx_sandy_sent_hash ON sandy_sent_messages(message_hash);
