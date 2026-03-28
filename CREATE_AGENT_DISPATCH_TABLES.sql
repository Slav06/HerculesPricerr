-- Agent & Dispatch Portal — Database Setup
-- Run this in Supabase SQL Editor

-- 1. Agent job assignments table
CREATE TABLE agent_job_assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_user_id INTEGER NOT NULL,
    agent_name TEXT NOT NULL,
    job_submission_id BIGINT NOT NULL,
    job_number TEXT NOT NULL,
    assigned_by TEXT,
    status TEXT DEFAULT 'assigned',  -- assigned, in_progress, completed
    notes TEXT,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- 2. Inventory photos table
CREATE TABLE inventory_photos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_number TEXT NOT NULL,
    item_name TEXT NOT NULL,
    photo_url TEXT NOT NULL,
    uploaded_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS with open policies (matches existing pattern)
ALTER TABLE agent_job_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON agent_job_assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON inventory_photos FOR ALL USING (true) WITH CHECK (true);

-- 4. Indexes for performance
CREATE INDEX idx_agent_assignments_agent ON agent_job_assignments(agent_user_id);
CREATE INDEX idx_agent_assignments_job ON agent_job_assignments(job_number);
CREATE INDEX idx_inventory_photos_job ON inventory_photos(job_number);

-- 5. Storage bucket (run separately or create via Supabase Dashboard > Storage)
-- Create bucket: inventory-photos (public access for reading)
-- In Supabase Dashboard: Storage > New Bucket > Name: "inventory-photos" > Public bucket: ON
