-- Create the ghl_analytics table for storing GoHighLevel analytics data
CREATE TABLE IF NOT EXISTS ghl_analytics (
    id BIGSERIAL PRIMARY KEY,
    sync_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_contacts INTEGER NOT NULL,
    total_opportunities INTEGER NOT NULL,
    synced_by VARCHAR(255),
    location_id VARCHAR(255),
    sync_status VARCHAR(50) DEFAULT 'success',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient querying by sync timestamp
CREATE INDEX IF NOT EXISTS idx_ghl_analytics_sync_timestamp ON ghl_analytics(sync_timestamp DESC);

-- Create index for location filtering
CREATE INDEX IF NOT EXISTS idx_ghl_analytics_location_id ON ghl_analytics(location_id);

-- Create index for synced_by user
CREATE INDEX IF NOT EXISTS idx_ghl_analytics_synced_by ON ghl_analytics(synced_by);

-- Optional: Add some sample data for testing
INSERT INTO ghl_analytics (total_contacts, total_opportunities, synced_by, location_id) 
VALUES (100, 25, 'admin', 'smihYndzGBgpiI04p14R')
ON CONFLICT DO NOTHING;



