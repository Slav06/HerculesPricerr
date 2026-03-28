-- ============================================================
-- Pricing Matrix Table
-- Each row = one distance-range × volume-range combination
-- with a per-CF rate and fuel surcharge percentage.
-- ============================================================

CREATE TABLE IF NOT EXISTS pricing_matrix (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    min_miles INT NOT NULL,
    max_miles INT NOT NULL,
    min_cubes INT NOT NULL,
    max_cubes INT NOT NULL,
    per_cf_rate NUMERIC(8,2) NOT NULL,
    fuel_surcharge_pct NUMERIC(5,2) DEFAULT 15,
    label TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for range lookups
CREATE INDEX IF NOT EXISTS idx_pricing_matrix_ranges
    ON pricing_matrix (min_miles, max_miles, min_cubes, max_cubes);

-- RLS: open anon policy (matches existing pattern)
ALTER TABLE pricing_matrix ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon full access on pricing_matrix"
    ON pricing_matrix
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================================
-- Seed data: 3 distance tiers × 3 volume tiers = 9 rows
-- Distance: Short (0-100), Medium (101-500), Long (501-9999)
-- Volume:   Small (0-300), Medium (301-800), Large (801-9999)
-- ============================================================

INSERT INTO pricing_matrix (min_miles, max_miles, min_cubes, max_cubes, per_cf_rate, fuel_surcharge_pct, label) VALUES
    (0,   100,  0,   300,  10.00, 15, 'Short / Small'),
    (0,   100,  301, 800,  9.00,  15, 'Short / Medium'),
    (0,   100,  801, 9999, 8.00,  15, 'Short / Large'),
    (101, 500,  0,   300,  14.00, 15, 'Medium / Small'),
    (101, 500,  301, 800,  12.00, 15, 'Medium / Medium'),
    (101, 500,  801, 9999, 10.00, 15, 'Medium / Large'),
    (501, 9999, 0,   300,  18.00, 15, 'Long / Small'),
    (501, 9999, 301, 800,  15.00, 15, 'Long / Medium'),
    (501, 9999, 801, 9999, 12.00, 15, 'Long / Large');
