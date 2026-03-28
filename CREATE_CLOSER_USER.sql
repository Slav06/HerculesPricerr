-- Create a test closer user for the closer extension
-- Run this in your Supabase SQL editor

-- Insert a test closer user
INSERT INTO dashboard_users (
    name,
    role,
    secret_key,
    is_active,
    created_at,
    updated_at
) VALUES (
    'Test Closer',
    'closer',
    'closer123',
    true,
    NOW(),
    NOW()
);

-- Verify the user was created
SELECT * FROM dashboard_users WHERE role = 'closer';

-- Alternative: Update an existing user to be a closer
-- UPDATE dashboard_users 
-- SET role = 'closer' 
-- WHERE secret_key = 'your_existing_secret_key';
