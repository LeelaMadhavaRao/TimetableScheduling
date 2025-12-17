-- Fix CSE-F004 availability to allow 3 lab sections
-- Delete old restricted availability
DELETE FROM faculty_availability 
WHERE faculty_id = (SELECT id FROM faculty WHERE code = 'CSE-F004');

-- Insert expanded availability (5 full days = 40 period-slots = ~25 possible 4-period blocks)
INSERT INTO faculty_availability (faculty_id, day_of_week, start_period, end_period) VALUES
  ((SELECT id FROM faculty WHERE code = 'CSE-F004'), 0, 1, 8),  -- Monday
  ((SELECT id FROM faculty WHERE code = 'CSE-F004'), 1, 1, 8),  -- Tuesday
  ((SELECT id FROM faculty WHERE code = 'CSE-F004'), 2, 1, 8),  -- Wednesday
  ((SELECT id FROM faculty WHERE code = 'CSE-F004'), 3, 1, 8),  -- Thursday
  ((SELECT id FROM faculty WHERE code = 'CSE-F004'), 4, 1, 8);  -- Friday

-- Verify the update
SELECT 
    f.code as faculty_code,
    COUNT(*) as total_days,
    SUM(fa.end_period - fa.start_period + 1) as total_period_slots
FROM faculty f
JOIN faculty_availability fa ON f.id = fa.faculty_id
WHERE f.code = 'CSE-F004'
GROUP BY f.code;
