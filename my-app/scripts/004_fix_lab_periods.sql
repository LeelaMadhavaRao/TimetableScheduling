-- Fix lab subjects periods_per_week to 1
-- This ensures labs are scheduled once per week as a 4-period block
-- NOT twice per week as individual periods

-- Update all lab subjects to periods_per_week = 1
UPDATE subjects 
SET periods_per_week = 1 
WHERE subject_type = 'lab';

-- Verify the changes
SELECT 
  name,
  code,
  subject_type,
  periods_per_week,
  d.code as dept_code
FROM subjects s
JOIN departments d ON s.department_id = d.id
WHERE subject_type = 'lab'
ORDER BY d.code, code;

-- Expected result: All labs should show periods_per_week = 1
