-- Test script to verify new disposition statuses work correctly
-- Run this after applying ADD_NEW_DISPOSITIONS.sql

-- Test 1: Insert a record with 'disqualified' status
INSERT INTO job_submissions (
    job_number,
    customer_name,
    from_location,
    to_location,
    status,
    submitted_by,
    submitted_at,
    created_at,
    updated_at
) VALUES (
    'TEST-DQ-001',
    'Test Customer (Disqualified)',
    'Test From Location',
    'Test To Location',
    'disqualified',
    'Test User',
    NOW(),
    NOW(),
    NOW()
);

-- Test 2: Insert a record with 'hung_up' status
INSERT INTO job_submissions (
    job_number,
    customer_name,
    from_location,
    to_location,
    status,
    submitted_by,
    submitted_at,
    created_at,
    updated_at
) VALUES (
    'TEST-HU-001',
    'Test Customer (Hung Up)',
    'Test From Location',
    'Test To Location',
    'hung_up',
    'Test User',
    NOW(),
    NOW(),
    NOW()
);

-- Test 3: Verify both records were inserted successfully
SELECT 
    job_number,
    customer_name,
    status,
    submitted_by,
    submitted_at
FROM job_submissions 
WHERE job_number IN ('TEST-DQ-001', 'TEST-HU-001')
ORDER BY job_number;

-- Test 4: Update an existing record to use new status
UPDATE job_submissions 
SET status = 'disqualified', 
    updated_at = NOW()
WHERE job_number = 'TEST-DQ-001';

-- Test 5: Verify the update worked
SELECT 
    job_number,
    status,
    updated_at
FROM job_submissions 
WHERE job_number = 'TEST-DQ-001';

-- Test 6: Clean up test records (optional)
-- DELETE FROM job_submissions WHERE job_number IN ('TEST-DQ-001', 'TEST-HU-001');

-- Test 7: Show all possible status values in the database
SELECT DISTINCT status 
FROM job_submissions 
ORDER BY status;
