-- Add new columns to pricing_matrix for tier_type, region, and label_extra support
-- Run this in Supabase SQL Editor

ALTER TABLE pricing_matrix ADD COLUMN IF NOT EXISTS tier_type TEXT DEFAULT 'base';
ALTER TABLE pricing_matrix ADD COLUMN IF NOT EXISTS region_applies_to TEXT DEFAULT 'either';
ALTER TABLE pricing_matrix ADD COLUMN IF NOT EXISTS region_adj_applies TEXT DEFAULT 'either';
ALTER TABLE pricing_matrix ADD COLUMN IF NOT EXISTS label_extra TEXT;
