-- Update existing booked jobs with missing booking data
-- This fixes jobs that were marked as "booked" before the booking columns were added

-- First, let's see what booked jobs exist without proper booking data
SELECT 
    id,
    job_number,
    submitted_by,
    status,
    booked_by,
    total_deposit,
    total_collected,
    total_binder,
    booked_at
FROM job_submissions 
WHERE status = 'booked' 
AND (total_binder IS NULL OR total_binder = 0);

-- Update Jerleen's booked job (ID 756) with the binder amount from the form
-- Based on the debug output, this job was marked as booked but total_binder is undefined
UPDATE job_submissions 
SET 
    total_binder = 900.00,  -- The binder amount from the form ($900.00)
    total_deposit = 1170.00,  -- The deposit amount from the form ($1170.00)
    total_collected = 1170.00,  -- The collected amount from the form ($1170.00)
    booked_by = 'Dan',  -- The closer who closed it
    updated_at = NOW()
WHERE id = 756 
AND status = 'booked';

-- Verify the update worked
SELECT 
    id,
    job_number,
    submitted_by,
    status,
    booked_by,
    total_deposit,
    total_collected,
    total_binder,
    booked_at
FROM job_submissions 
WHERE id = 756;

-- Optional: Update any other booked jobs that might be missing data
-- (Uncomment and modify as needed for other jobs)

/*
UPDATE job_submissions 
SET 
    total_binder = 1000.00,  -- Replace with actual binder amount
    total_deposit = 1500.00,  -- Replace with actual deposit amount
    total_collected = 1500.00,  -- Replace with actual collected amount
    booked_by = 'Closer Name',  -- Replace with actual closer name
    updated_at = NOW()
WHERE status = 'booked' 
AND (total_binder IS NULL OR total_binder = 0)
AND id = [OTHER_JOB_ID];  -- Replace with actual job ID
*/
