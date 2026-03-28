-- Sandy reminders table
-- Run this in Supabase SQL Editor

CREATE TABLE sandy_reminders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    targets TEXT NOT NULL,
    reminder_text TEXT NOT NULL,
    reminder_date DATE NOT NULL,
    reminder_time TEXT DEFAULT '09:00',
    job_number TEXT,
    customer_name TEXT,
    status TEXT DEFAULT 'pending',  -- pending, delivered, expired
    created_by TEXT,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sandy_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON sandy_reminders FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_sandy_reminders_status ON sandy_reminders(status);
CREATE INDEX idx_sandy_reminders_date ON sandy_reminders(reminder_date);
