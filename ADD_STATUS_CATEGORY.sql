-- Add category column to job_status_tiers table
-- Categories: 'good' (green), 'maybe' (yellow), 'dead' (red)

ALTER TABLE job_status_tiers
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'maybe'
CHECK (category IN ('good', 'maybe', 'dead'));

-- Set default categories for existing statuses
UPDATE job_status_tiers SET category = 'good'  WHERE status_key IN ('booked', 'payment_captured', 'completed', 'inv_done');
UPDATE job_status_tiers SET category = 'maybe' WHERE status_key IN ('pending', 'cb_scheduled', 'transferred');
UPDATE job_status_tiers SET category = 'dead'  WHERE status_key IN ('dropped', 'disqualified', 'hung_up', 'cancelled');
