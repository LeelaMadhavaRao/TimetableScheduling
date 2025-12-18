-- Diagnostic query to check lab scheduling in database
-- Run this in Supabase SQL Editor after generating a timetable

-- Query 1: Check all lab slots and their period spans
SELECT 
  tb.id,
  s.name as section_name,
  sub.code as subject_code,
  sub.subject_type,
  f.code as faculty_code,
  c.name as room_name,
  tb.day_of_week,
  tb.start_period,
  tb.end_period,
  (tb.end_period - tb.start_period + 1) as period_span
FROM timetable_base tb
JOIN sections s ON tb.section_id = s.id
JOIN subjects sub ON tb.subject_id = sub.id
JOIN faculty f ON tb.faculty_id = f.id
JOIN classrooms c ON tb.classroom_id = c.id
WHERE sub.subject_type = 'lab'
ORDER BY s.name, tb.day_of_week, tb.start_period;

-- Query 2: Check for labs NOT scheduled as 4-period blocks
SELECT 
  tb.id,
  s.name as section_name,
  sub.code as subject_code,
  tb.day_of_week,
  tb.start_period,
  tb.end_period,
  (tb.end_period - tb.start_period + 1) as period_span,
  CASE 
    WHEN (tb.end_period - tb.start_period + 1) != 4 THEN '❌ VIOLATION: Not 4 periods!'
    WHEN tb.start_period NOT IN (1, 5) THEN '❌ VIOLATION: Wrong start period!'
    ELSE '✅ OK'
  END as status
FROM timetable_base tb
JOIN sections s ON tb.section_id = s.id
JOIN subjects sub ON tb.subject_id = sub.id
WHERE sub.subject_type = 'lab';

-- Query 3: Count labs by period span
SELECT 
  (tb.end_period - tb.start_period + 1) as period_span,
  COUNT(*) as count
FROM timetable_base tb
JOIN subjects sub ON tb.subject_id = sub.id
WHERE sub.subject_type = 'lab'
GROUP BY period_span
ORDER BY period_span;

-- Query 4: Check for section conflicts (same section, same day, overlapping periods)
SELECT 
  s.name as section_name,
  tb1.day_of_week,
  tb1.start_period as slot1_start,
  tb1.end_period as slot1_end,
  sub1.code as subject1,
  tb2.start_period as slot2_start,
  tb2.end_period as slot2_end,
  sub2.code as subject2,
  'CONFLICT!' as status
FROM timetable_base tb1
JOIN timetable_base tb2 ON tb1.section_id = tb2.section_id 
  AND tb1.day_of_week = tb2.day_of_week 
  AND tb1.id != tb2.id
  AND (
    (tb1.start_period BETWEEN tb2.start_period AND tb2.end_period)
    OR (tb1.end_period BETWEEN tb2.start_period AND tb2.end_period)
    OR (tb2.start_period BETWEEN tb1.start_period AND tb1.end_period)
  )
JOIN sections s ON tb1.section_id = s.id
JOIN subjects sub1 ON tb1.subject_id = sub1.id
JOIN subjects sub2 ON tb2.subject_id = sub2.id
WHERE tb1.id < tb2.id;  -- Avoid duplicate pairs

-- Query 5: Verify expected number of labs
-- Should be 16 labs total based on seed data
SELECT 
  'Expected labs' as metric,
  (SELECT COUNT(*) FROM section_subjects ss 
   JOIN subjects sub ON ss.subject_id = sub.id 
   WHERE sub.subject_type = 'lab') as count
UNION ALL
SELECT 
  'Scheduled labs' as metric,
  (SELECT COUNT(*) FROM timetable_base tb 
   JOIN subjects sub ON tb.subject_id = sub.id 
   WHERE sub.subject_type = 'lab') as count;
