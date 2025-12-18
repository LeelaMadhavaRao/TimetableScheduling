-- Fix periods_per_week for subjects to match common scheduling patterns
-- Theory subjects: 3 periods per week (can be scheduled as 2+1 or in 2-period blocks)
-- Lab subjects: 4 periods per week (scheduled as continuous 4-period block)

-- =============================================
-- FIX 1: Update theory subjects to have 3 periods
-- =============================================
UPDATE subjects 
SET periods_per_week = 3 
WHERE subject_type = 'theory';

-- =============================================
-- FIX 2: Update lab room capacities to accommodate sections
-- Engineering labs: need 65 capacity for 55-student sections
-- Science labs: need 55 capacity for 45-student sections
-- =============================================
UPDATE classrooms 
SET capacity = 65 
WHERE name IN ('ENG-LAB1', 'ENG-LAB2') 
  AND room_type = 'lab';

UPDATE classrooms 
SET capacity = 55 
WHERE name IN ('SCI-LAB1', 'SCI-LAB2') 
  AND room_type = 'lab';

-- =============================================
-- Verify the changes
-- =============================================
SELECT 
  'SUBJECTS' as type,
  s.code,
  s.name,
  s.subject_type,
  s.periods_per_week,
  NULL as capacity
FROM subjects s
ORDER BY s.subject_type, s.code;

SELECT 
  'CLASSROOMS' as type,
  c.name as code,
  c.room_type as name,
  c.room_type as subject_type,
  NULL as periods_per_week,
  c.capacity
FROM classrooms c
WHERE c.room_type = 'lab'
ORDER BY c.name;
