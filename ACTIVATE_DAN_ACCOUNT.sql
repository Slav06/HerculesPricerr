-- Activate Dan's closer account
-- Run this in your Supabase SQL editor

-- Update Dan's account to be active
UPDATE dashboard_users 
SET is_active = true 
WHERE name = 'Dan' AND secretkey = 'danc';

-- Verify the update
SELECT name, role, secretkey, is_active 
FROM dashboard_users 
WHERE name = 'Dan';

-- Alternative: Activate all closer accounts
-- UPDATE dashboard_users 
-- SET is_active = true 
-- WHERE role = 'closer';
