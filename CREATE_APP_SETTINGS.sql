-- Key-value settings table for admin-configurable options
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon full access to app_settings"
    ON app_settings FOR ALL USING (true) WITH CHECK (true);

-- Seed default sort settings
INSERT INTO app_settings (key, value) VALUES
    ('sort_settings', '{"overdueBoost":30,"overdueMaxDays":7,"staleDemote":15}')
ON CONFLICT (key) DO NOTHING;
