-- 1) Create ghl_analytics table if it doesn't exist (fixes "relation does not exist")
-- 2) Allow the GHL webhook (anon key) to insert into it.
-- Run this entire script in Supabase SQL Editor once.

-- Create table (matches what the webhook sends)
CREATE TABLE IF NOT EXISTS public.ghl_analytics (
    id BIGSERIAL PRIMARY KEY,
    sync_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_contacts INTEGER DEFAULT 0,
    total_opportunities INTEGER DEFAULT 0,
    total_pipelines INTEGER DEFAULT 0,
    total_campaigns INTEGER DEFAULT 0,
    data_snapshot JSONB,
    synced_by TEXT,
    sync_status TEXT DEFAULT 'completed',
    api_response_time INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.ghl_analytics ENABLE ROW LEVEL SECURITY;

-- Allow webhook to insert (anon key, synced_by = 'webhook' or 'system')
DROP POLICY IF EXISTS "Allow webhook to insert GHL analytics" ON public.ghl_analytics;
CREATE POLICY "Allow webhook to insert GHL analytics"
ON public.ghl_analytics
FOR INSERT
TO anon
WITH CHECK (synced_by IN ('webhook', 'system'));

-- Allow anon to read so the webhook can fetch latest snapshot (getLatestAnalyticsSnapshot)
DROP POLICY IF EXISTS "Allow anon to select GHL analytics" ON public.ghl_analytics;
CREATE POLICY "Allow anon to select GHL analytics"
ON public.ghl_analytics
FOR SELECT
TO anon
USING (true);
