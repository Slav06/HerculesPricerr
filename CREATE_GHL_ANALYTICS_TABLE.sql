-- Create GoHighLevel Analytics table for admin dashboard
-- This table stores synced data from GoHighLevel API

CREATE TABLE IF NOT EXISTS public.ghl_analytics (
    id BIGSERIAL PRIMARY KEY,
    sync_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Summary metrics
    total_contacts INTEGER DEFAULT 0,
    total_opportunities INTEGER DEFAULT 0,
    total_pipelines INTEGER DEFAULT 0,
    total_campaigns INTEGER DEFAULT 0,
    
    -- Raw data snapshot (flexible JSONB for any GHL data structure)
    data_snapshot JSONB,
    
    -- Metadata
    synced_by TEXT,
    sync_status TEXT DEFAULT 'completed',
    api_response_time INTEGER, -- milliseconds
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add Row Level Security for admin-only access
ALTER TABLE public.ghl_analytics ENABLE ROW LEVEL SECURITY;

-- Policy: Only admin users can view analytics data
CREATE POLICY "Admin users can view GHL analytics"
ON public.ghl_analytics
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.dashboard_users
        WHERE dashboard_users.id = auth.uid() 
        AND dashboard_users.role = 'admin'
        AND dashboard_users.is_active = true
    )
);

-- Policy: Only admin users can insert analytics data
CREATE POLICY "Admin users can insert GHL analytics"
ON public.ghl_analytics
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.dashboard_users
        WHERE dashboard_users.id = auth.uid() 
        AND dashboard_users.role = 'admin'
        AND dashboard_users.is_active = true
    )
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_ghl_analytics_sync_timestamp 
ON public.ghl_analytics(sync_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_ghl_analytics_synced_by 
ON public.ghl_analytics(synced_by);

-- Create a view for admin dashboard summary
CREATE OR REPLACE VIEW public.ghl_analytics_summary AS
SELECT 
    DATE(sync_timestamp) as sync_date,
    COUNT(*) as sync_count,
    AVG(total_contacts) as avg_contacts,
    AVG(total_opportunities) as avg_opportunities,
    MAX(sync_timestamp) as latest_sync
FROM public.ghl_analytics 
GROUP BY DATE(sync_timestamp)
ORDER BY sync_date DESC;

-- Grant access to the view for admins only
ALTER VIEW public.ghl_analytics_summary OWNER TO postgres;

-- Example of potential additional columns based on common GHL data:
-- Uncomment and modify based on actual API response structure

/*
-- Contact-related metrics
ALTER TABLE public.ghl_analytics ADD COLUMN contacts_new_today INTEGER DEFAULT 0;
ALTER TABLE public.ghl_analytics ADD COLUMN contacts_by_source JSONB;
ALTER TABLE public.ghl_analytics ADD COLUMN contacts_by_tag JSONB;

-- Opportunity-related metrics  
ALTER TABLE public.ghl_analytics ADD COLUMN opportunities_by_stage JSONB;
ALTER TABLE public.ghl_analytics ADD COLUMN opportunities_total_value DECIMAL(12,2);
ALTER TABLE public.ghl_analytics ADD COLUMN opportunities_won_today INTEGER DEFAULT 0;
ALTER TABLE public.ghl_analytics ADD COLUMN opportunities_lost_today INTEGER DEFAULT 0;

-- Campaign metrics
ALTER TABLE public.ghl_analytics ADD COLUMN campaigns_active INTEGER DEFAULT 0;
ALTER TABLE public.ghl_analytics ADD COLUMN campaigns_performance JSONB;

-- Calendar/Appointment metrics
ALTER TABLE public.ghl_analytics ADD COLUMN appointments_today INTEGER DEFAULT 0;
ALTER TABLE public.ghl_analytics ADD COLUMN appointments_upcoming INTEGER DEFAULT 0;
*/

-- Insert sample data for testing (remove in production)
INSERT INTO public.ghl_analytics (
    total_contacts, 
    total_opportunities, 
    data_snapshot, 
    synced_by
) VALUES (
    150, 
    25, 
    '{"sample": "This is test data for dashboard development"}', 
    'System Test'
);

COMMENT ON TABLE public.ghl_analytics IS 'Stores analytics data synced from GoHighLevel API for admin dashboard';
COMMENT ON COLUMN public.ghl_analytics.data_snapshot IS 'Raw JSON data from GoHighLevel API - flexible structure';
COMMENT ON COLUMN public.ghl_analytics.sync_timestamp IS 'When this data was synced from GoHighLevel';
COMMENT ON COLUMN public.ghl_analytics.synced_by IS 'Which admin user triggered the sync';
