-- ============================================================
-- Migrate job_submissions statuses to Dialerr-matching dispositions
-- Run this ONCE against your Supabase database
-- ============================================================

-- 1. Convert pending / NULL to new_lead
UPDATE job_submissions SET status = 'new_lead' WHERE status = 'pending' OR status IS NULL;

-- 2. Map old statuses to new equivalents
UPDATE job_submissions SET status = 'won' WHERE status = 'booked';
UPDATE job_submissions SET status = 'won' WHERE status = 'Booked';
UPDATE job_submissions SET status = 'won' WHERE status = 'payment_captured';
UPDATE job_submissions SET status = 'won' WHERE status = 'completed';
UPDATE job_submissions SET status = 'no_answer' WHERE status = 'cb_scheduled';
UPDATE job_submissions SET status = 'quoted' WHERE status = 'inv_done';
UPDATE job_submissions SET status = 'dropped' WHERE status = 'hung_up';
UPDATE job_submissions SET status = 'dropped' WHERE status = 'disqualified';
UPDATE job_submissions SET status = 'dropped' WHERE status = 'cancelled';

-- 3. Replace job_status_tiers with the new 8 statuses
DELETE FROM job_status_tiers;

INSERT INTO job_status_tiers (status_key, display_name, tier, priority_score, category, max_attempts, wait_times_json) VALUES
  ('new_lead',             'New Lead',              1, 100, 'maybe', 5, '[30, 60, 120, 240, 480]'),
  ('no_answer',            'No Answer',             2,  90, 'maybe', 6, '[30, 60, 120, 240, 480, 1440]'),
  ('voicemail',            'Voicemail',             2,  85, 'maybe', 4, '[60, 120, 240, 480]'),
  ('quoted',               'Quoted',                3,  70, 'good',  4, '[60, 240, 1440, 2880]'),
  ('transferred',          'Transferred to Closer', 3,  60, 'maybe', 3, '[120, 480, 1440]'),
  ('won',                  'Won',                   6,  10, 'good',  0, '[]'),
  ('dropped',              'Dropped',               5,  20, 'dead',  0, '[]'),
  ('booked_to_competitor', 'Booked to Competitor',  5,  15, 'dead',  0, '[]');
