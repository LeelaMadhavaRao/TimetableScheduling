-- Diagnose CSE-F004 availability and assignments
SELECT 
    f.code as faculty_code,
    f.name as faculty_name,
    fa.day_of_week,
    fa.start_period,
    fa.end_period,
    (fa.end_period - fa.start_period + 1) as periods_per_day
FROM faculty f
JOIN faculty_availability fa ON f.id = fa.faculty_id
WHERE f.code = 'CSE-F004'
ORDER BY fa.day_of_week;

-- Check how many labs CSE-F004 is assigned to teach
SELECT 
    f.code as faculty_code,
    s.name as subject_name,
    s.code as subject_code,
    s.subject_type,
    sec.name as section_name,
    sec.student_count
FROM section_subjects ss
JOIN faculty f ON ss.faculty_id = f.id
JOIN subjects s ON ss.subject_id = s.id
JOIN sections sec ON ss.section_id = sec.id
WHERE f.code = 'CSE-F004'
ORDER BY s.subject_type DESC, sec.name;
