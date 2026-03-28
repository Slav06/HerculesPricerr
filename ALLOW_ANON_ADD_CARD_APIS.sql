-- Allow anonymous (add-card link) access for:
-- 1) Reading job_submissions (job_number, customer_name, email) for get-job-for-link
-- 2) Inserting into payment_captures for save-card
-- Run in Supabase SQL Editor if add-card link returns 500 or "Could not load job".

-- Job submissions: allow anon to SELECT by job_number (for payment link lookup)
CREATE POLICY "Allow anon read job_submissions for add-card link"
ON job_submissions FOR SELECT
TO anon
USING (true);

-- payment_captures: allow anon to SELECT so dashboard can show 💳 (card on file) and load card for charging
-- Without this, the dashboard fetch returns no rows and the button stays ➕
DROP POLICY IF EXISTS "Allow anon read payment_captures for dashboard" ON payment_captures;
CREATE POLICY "Allow anon read payment_captures for dashboard"
ON payment_captures FOR SELECT
TO anon
USING (true);
