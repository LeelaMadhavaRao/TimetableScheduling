-- Check for ROOM conflicts (same room, same day, overlapping periods)
-- This query finds all instances where the same room is assigned to different sections/labs at the same time

SELECT 
  c.name as room_name,
  tb1.day_of_week,
  tb1.start_period as slot1_start,
  tb1.end_period as slot1_end,
  s1.name as section1,
  sub1.code as subject1,
  f1.code as faculty1,
  tb2.start_period as slot2_start,
  tb2.end_period as slot2_end,
  s2.name as section2,
  sub2.code as subject2,
  f2.code as faculty2,
  '❌ ROOM CONFLICT!' as status
FROM timetable_base tb1
JOIN timetable_base tb2 ON tb1.classroom_id = tb2.classroom_id 
  AND tb1.day_of_week = tb2.day_of_week 
  AND tb1.id != tb2.id
  AND (
    -- Check for any period overlap between the two slots
    (tb1.start_period BETWEEN tb2.start_period AND tb2.end_period)
    OR (tb1.end_period BETWEEN tb2.start_period AND tb2.end_period)
    OR (tb2.start_period BETWEEN tb1.start_period AND tb1.end_period)
    OR (tb2.end_period BETWEEN tb1.start_period AND tb1.end_period)
  )
JOIN classrooms c ON tb1.classroom_id = c.id
JOIN sections s1 ON tb1.section_id = s1.id
JOIN subjects sub1 ON tb1.subject_id = sub1.id
JOIN faculty f1 ON tb1.faculty_id = f1.id
JOIN sections s2 ON tb2.section_id = s2.id
JOIN subjects sub2 ON tb2.subject_id = sub2.id
JOIN faculty f2 ON tb2.faculty_id = f2.id
WHERE tb1.id < tb2.id  -- Avoid duplicate pairs
ORDER BY c.name, tb1.day_of_week, tb1.start_period;

-- Simplified count query
SELECT COUNT(*) as total_room_conflicts
FROM timetable_base tb1
JOIN timetable_base tb2 ON tb1.classroom_id = tb2.classroom_id 
  AND tb1.day_of_week = tb2.day_of_week 
  AND tb1.id != tb2.id
  AND (
    (tb1.start_period BETWEEN tb2.start_period AND tb2.end_period)
    OR (tb1.end_period BETWEEN tb2.start_period AND tb2.end_period)
    OR (tb2.start_period BETWEEN tb1.start_period AND tb1.end_period)
    OR (tb2.end_period BETWEEN tb1.start_period AND tb1.end_period)
  )
WHERE tb1.id < tb2.id;
