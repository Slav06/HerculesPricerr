-- ============================================================
-- WORK SCHEDULE SYSTEM - Database Tables
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Employees table
CREATE TABLE IF NOT EXISTS employees (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    role TEXT DEFAULT 'staff', -- admin, fronter, closer, staff
    slack_user_id TEXT, -- Slack member ID for DMs
    default_shift_start TIME,
    default_shift_end TIME,
    default_days INTEGER[] DEFAULT '{1,2,3,4,5}', -- 0=Sun, 1=Mon...6=Sat
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Schedule entries (one row per person per day)
CREATE TABLE IF NOT EXISTS schedule_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_name TEXT NOT NULL,
    schedule_date DATE NOT NULL,
    shift_start TIME NOT NULL,
    shift_end TIME NOT NULL,
    status TEXT DEFAULT 'scheduled', -- scheduled, confirmed, callout, swapped
    confirmed_at TIMESTAMPTZ,
    callout_reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(employee_name, schedule_date)
);

-- 3. Swap requests
CREATE TABLE IF NOT EXISTS schedule_swaps (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    requester_name TEXT NOT NULL,
    target_name TEXT NOT NULL,
    swap_date DATE NOT NULL,
    requester_shift_start TIME,
    requester_shift_end TIME,
    target_shift_start TIME,
    target_shift_end TIME,
    status TEXT DEFAULT 'pending', -- pending, accepted, declined
    requester_message TEXT,
    responded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Insert default employees
INSERT INTO employees (name, role, default_shift_start, default_shift_end, default_days) VALUES
    ('Andrew', 'staff', '08:00', '16:00', '{1,2,3,4,5}'),
    ('Aubrey', 'staff', '08:00', '16:00', '{1,2,3,4,5}'),
    ('Michael', 'staff', '15:00', '00:00', '{1,2,3,4,5}'),
    ('Adrian', 'staff', '15:00', '00:00', '{1,2,3,4,5}')
ON CONFLICT (name) DO NOTHING;

-- 5. Enable RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_swaps ENABLE ROW LEVEL SECURITY;

-- Allow anon read/write for all (matches existing project pattern)
CREATE POLICY "anon_employees_select" ON employees FOR SELECT USING (true);
CREATE POLICY "anon_employees_insert" ON employees FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_employees_update" ON employees FOR UPDATE USING (true);

CREATE POLICY "anon_schedule_select" ON schedule_entries FOR SELECT USING (true);
CREATE POLICY "anon_schedule_insert" ON schedule_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_schedule_update" ON schedule_entries FOR UPDATE USING (true);
CREATE POLICY "anon_schedule_delete" ON schedule_entries FOR DELETE USING (true);

CREATE POLICY "anon_swaps_select" ON schedule_swaps FOR SELECT USING (true);
CREATE POLICY "anon_swaps_insert" ON schedule_swaps FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_swaps_update" ON schedule_swaps FOR UPDATE USING (true);

-- 6. Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_schedule_date ON schedule_entries(schedule_date);
CREATE INDEX IF NOT EXISTS idx_schedule_employee ON schedule_entries(employee_name);
CREATE INDEX IF NOT EXISTS idx_swaps_status ON schedule_swaps(status);
