-- Check faculty availability to verify database update
SELECT 
    f.code as faculty_code,
    f.name as faculty_name,
    fa.day_of_week,
    fa.start_period,
    fa.end_period,
    (fa.end_period - fa.start_period + 1) as periods_per_day
FROM faculty f
JOIN faculty_availability fa ON f.id = fa.faculty_id
WHERE f.code IN ('MECH-F003', 'CSE-F005')
ORDER BY f.code, fa.day_of_week;

-- Count total availability slots per faculty
SELECT 
    f.code as faculty_code,
    COUNT(*) as total_days,
    SUM(fa.end_period - fa.start_period + 1) as total_period_slots
FROM faculty f
JOIN faculty_availability fa ON f.id = fa.faculty_id
WHERE f.code IN ('MECH-F003', 'CSE-F005')
GROUP BY f.code;
