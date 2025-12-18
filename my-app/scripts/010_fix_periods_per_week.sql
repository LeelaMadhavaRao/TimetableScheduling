-- Fix periods_per_week for subjects to match common scheduling patterns
-- Theory subjects: 3 periods per week (can be scheduled as 2+1 or in 2-period blocks)
-- Lab subjects: 4 periods per week (scheduled as continuous 4-period block)

-- Engineering College Subjects - Fix theory subjects to have 3 periods
UPDATE subjects 
SET periods_per_week = 3 
WHERE code IN ('CS201', 'CS301', 'CS302', 'CS303', 'IT201')
  AND subject_type = 'theory';

-- Keep lab subjects at 4 periods (already correct)
UPDATE subjects 
SET periods_per_week = 4 
WHERE code IN ('CS201L', 'CS301L', 'IT201L')
  AND subject_type = 'lab';

-- Science College Subjects - Fix theory subjects to have 3 periods
UPDATE subjects 
SET periods_per_week = 3 
WHERE code IN ('PHY101', 'PHY102', 'CHEM101', 'CHEM102')
  AND subject_type = 'theory';

-- Keep lab subjects at 4 periods (already correct)
UPDATE subjects 
SET periods_per_week = 4 
WHERE code IN ('PHY101L', 'CHEM101L')
  AND subject_type = 'lab';

-- Verify the changes
SELECT 
  s.code,
  s.name,
  s.subject_type,
  s.periods_per_week,
  d.name as department
FROM subjects s
JOIN departments d ON s.department_id = d.id
ORDER BY d.name, s.subject_type, s.code;
