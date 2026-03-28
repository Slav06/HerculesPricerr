-- Manual Hours system — request + log tables
-- Run this in Supabase SQL Editor

CREATE TABLE manual_hours_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_name TEXT NOT NULL,
    worksnap_id INTEGER,
    date DATE NOT NULL,
    duration_minutes INTEGER NOT NULL,
    reason TEXT,
    requested_via TEXT DEFAULT 'slack',
    status TEXT DEFAULT 'pending',  -- pending, completed, rejected
    approved_by TEXT,
    rejected_by TEXT,
    reject_reason TEXT,
    worksnap_response TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE manual_hours_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_name TEXT NOT NULL,
    worksnap_id INTEGER,
    date DATE NOT NULL,
    duration_minutes INTEGER NOT NULL,
    reason TEXT,
    approved_by TEXT,
    worksnap_response TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE manual_hours_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_hours_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON manual_hours_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON manual_hours_log FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_manual_hours_status ON manual_hours_requests(status);
CREATE INDEX idx_manual_hours_employee ON manual_hours_requests(employee_name);
