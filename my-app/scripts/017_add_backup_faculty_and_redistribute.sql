-- =============================================
-- 017: ADD BACKUP FACULTY AND REDISTRIBUTE ALL THEORY SUBJECTS
-- =============================================
-- PROBLEM: Schedule fragmentation causing failures
--   ALL theory faculty teach their subject to ALL 8 CSE / 7 IT sections!
--   - CSE-F001: DBMS to 8 sections = 32 theory + 12 lab = 44/48 (92%)
--   - CSE-F002: OS to 8 sections = 32 theory + 12 lab = 44/48 (92%) ← FAILING
--   - CSE-F003: CN to 8 sections = 32 theory + 12 lab = 44/48 (92%)
--   - CSE-F004: SE to 8 sections = 32 theory + 12 lab = 44/48 (92%)
--   - IT-F001/F002/F003/F004: Same pattern for IT
--
-- SOLUTION: 
--   1. Add MORE theory-only faculty (F009-F013 for each dept)
--   2. Split EVERY theory subject across 2 faculty (4 sections each)
--   3. This halves the conflict potential for ALL subjects
--
-- NEW FACULTY LOAD DISTRIBUTION (after redistribution):
--   Each faculty: max 4 sections × 4 periods = 16 theory periods
--   Plus optional labs = max 28 periods total (58% utilization)
-- =============================================

-- =============================================
-- 1. ADD NEW FACULTY MEMBERS (5 per department)
-- =============================================
INSERT INTO faculty (id, code, name, email, department_id, phone, is_active, created_by) VALUES
-- CSE Additional Faculty (theory-only to share load)
('30000000-0000-0000-0001-000000000009', 'CSE-F009', 'Dr. Venkat R', 'venkat@college.edu', '20000000-0000-0000-0000-000000000001', '9876543217', true, '10000000-0000-0000-0000-000000000001'),
('30000000-0000-0000-0001-000000000010', 'CSE-F010', 'Prof. Kavitha M', 'kavitha@college.edu', '20000000-0000-0000-0000-000000000001', '9876543218', true, '10000000-0000-0000-0000-000000000001'),
('30000000-0000-0000-0001-000000000011', 'CSE-F011', 'Dr. Rajesh T', 'rajesh@college.edu', '20000000-0000-0000-0000-000000000001', '9876543221', true, '10000000-0000-0000-0000-000000000001'),
('30000000-0000-0000-0001-000000000012', 'CSE-F012', 'Prof. Swathi N', 'swathi@college.edu', '20000000-0000-0000-0000-000000000001', '9876543222', true, '10000000-0000-0000-0000-000000000001'),
('30000000-0000-0000-0001-000000000013', 'CSE-F013', 'Dr. Anil K', 'anil@college.edu', '20000000-0000-0000-0000-000000000001', '9876543223', true, '10000000-0000-0000-0000-000000000001'),
-- IT Additional Faculty (theory-only to share load)
('30000000-0000-0000-0002-000000000009', 'IT-F009', 'Dr. Prakash S', 'prakash@college.edu', '20000000-0000-0000-0000-000000000002', '9876543219', true, '10000000-0000-0000-0000-000000000001'),
('30000000-0000-0000-0002-000000000010', 'IT-F010', 'Prof. Nandini K', 'nandini@college.edu', '20000000-0000-0000-0000-000000000002', '9876543220', true, '10000000-0000-0000-0000-000000000001'),
('30000000-0000-0000-0002-000000000011', 'IT-F011', 'Dr. Sanjay M', 'sanjay@college.edu', '20000000-0000-0000-0000-000000000002', '9876543224', true, '10000000-0000-0000-0000-000000000001'),
('30000000-0000-0000-0002-000000000012', 'IT-F012', 'Prof. Preethi R', 'preethi@college.edu', '20000000-0000-0000-0000-000000000002', '9876543225', true, '10000000-0000-0000-0000-000000000001'),
('30000000-0000-0000-0002-000000000013', 'IT-F013', 'Dr. Kumar V', 'kumar@college.edu', '20000000-0000-0000-0000-000000000002', '9876543226', true, '10000000-0000-0000-0000-000000000001')
ON CONFLICT (code) DO NOTHING;

-- =============================================
-- 2. ADD AVAILABILITY FOR NEW FACULTY
-- All available Monday-Saturday (days 0-5), periods 1-8
-- =============================================
INSERT INTO faculty_availability (faculty_id, day_of_week, start_period, end_period)
SELECT f.id, d.day, 1, 8
FROM faculty f
CROSS JOIN (SELECT generate_series(0, 5) AS day) d
WHERE f.code IN ('CSE-F009', 'CSE-F010', 'CSE-F011', 'CSE-F012', 'CSE-F013', 
                 'IT-F009', 'IT-F010', 'IT-F011', 'IT-F012', 'IT-F013')
ON CONFLICT DO NOTHING;

-- =============================================
-- 3. ADD SUBJECT-FACULTY MAPPINGS FOR NEW FACULTY
-- Link new faculty to the theory subjects they can teach
-- =============================================
INSERT INTO subject_faculty (subject_id, faculty_id) VALUES
-- CSE new faculty subject assignments
('40000000-0000-0000-0001-000000000002', '30000000-0000-0000-0001-000000000009'), -- DBMS - CSE-F009
('40000000-0000-0000-0001-000000000001', '30000000-0000-0000-0001-000000000010'), -- DS - CSE-F010
('40000000-0000-0000-0001-000000000003', '30000000-0000-0000-0001-000000000011'), -- OS - CSE-F011
('40000000-0000-0000-0001-000000000004', '30000000-0000-0000-0001-000000000012'), -- CN - CSE-F012
('40000000-0000-0000-0001-000000000005', '30000000-0000-0000-0001-000000000013'), -- SE - CSE-F013
-- IT new faculty subject assignments
('40000000-0000-0000-0002-000000000001', '30000000-0000-0000-0002-000000000009'), -- Web Tech - IT-F009
('40000000-0000-0000-0002-000000000002', '30000000-0000-0000-0002-000000000010'), -- Cloud - IT-F010
('40000000-0000-0000-0002-000000000003', '30000000-0000-0000-0002-000000000011'), -- Cyber Sec - IT-F011
('40000000-0000-0000-0002-000000000004', '30000000-0000-0000-0002-000000000012'), -- ML - IT-F012
('40000000-0000-0000-0002-000000000005', '30000000-0000-0000-0002-000000000013')  -- Big Data - IT-F013
ON CONFLICT DO NOTHING;

-- =============================================
-- 4. REDISTRIBUTE SECTION-SUBJECT MAPPINGS
-- Split ALL high-load faculty across fewer sections
-- Strategy: Sections 1-4 keep original faculty, Sections 5-8 get new faculty
-- =============================================

-- ========== CSE REDISTRIBUTION ==========

-- CSE-F001 → CSE-F009: DBMS for sections 5-8 (CSE-3B, CSE-3C, CSE-4A, CSE-4B)
UPDATE section_subjects 
SET faculty_id = '30000000-0000-0000-0001-000000000009'  -- CSE-F009
WHERE section_id IN (
    '60000000-0000-0000-0001-000000000005',  -- CSE-3B
    '60000000-0000-0000-0001-000000000006',  -- CSE-3C
    '60000000-0000-0000-0001-000000000007',  -- CSE-4A
    '60000000-0000-0000-0001-000000000008'   -- CSE-4B
)
AND subject_id = '40000000-0000-0000-0001-000000000002'; -- DBMS (CS301)

-- CSE-F007 → CSE-F010: DS for sections 5-8 (CSE-3B, CSE-3C, CSE-4A, CSE-4B)
UPDATE section_subjects 
SET faculty_id = '30000000-0000-0000-0001-000000000010'  -- CSE-F010
WHERE section_id IN (
    '60000000-0000-0000-0001-000000000005',  -- CSE-3B
    '60000000-0000-0000-0001-000000000006',  -- CSE-3C
    '60000000-0000-0000-0001-000000000007',  -- CSE-4A
    '60000000-0000-0000-0001-000000000008'   -- CSE-4B
)
AND subject_id = '40000000-0000-0000-0001-000000000001'; -- DS (CS201)

-- CSE-F002 → CSE-F011: OS for sections 5-8 (CSE-3B, CSE-3C, CSE-4A, CSE-4B)
UPDATE section_subjects 
SET faculty_id = '30000000-0000-0000-0001-000000000011'  -- CSE-F011
WHERE section_id IN (
    '60000000-0000-0000-0001-000000000005',  -- CSE-3B
    '60000000-0000-0000-0001-000000000006',  -- CSE-3C
    '60000000-0000-0000-0001-000000000007',  -- CSE-4A
    '60000000-0000-0000-0001-000000000008'   -- CSE-4B
)
AND subject_id = '40000000-0000-0000-0001-000000000003'; -- OS (CS302)

-- CSE-F003 → CSE-F012: CN for sections 5-8 (CSE-3B, CSE-3C, CSE-4A, CSE-4B)
UPDATE section_subjects 
SET faculty_id = '30000000-0000-0000-0001-000000000012'  -- CSE-F012
WHERE section_id IN (
    '60000000-0000-0000-0001-000000000005',  -- CSE-3B
    '60000000-0000-0000-0001-000000000006',  -- CSE-3C
    '60000000-0000-0000-0001-000000000007',  -- CSE-4A
    '60000000-0000-0000-0001-000000000008'   -- CSE-4B
)
AND subject_id = '40000000-0000-0000-0001-000000000004'; -- CN (CS303)

-- CSE-F004 → CSE-F013: SE for sections 5-8 (CSE-3B, CSE-3C, CSE-4A, CSE-4B)
UPDATE section_subjects 
SET faculty_id = '30000000-0000-0000-0001-000000000013'  -- CSE-F013
WHERE section_id IN (
    '60000000-0000-0000-0001-000000000005',  -- CSE-3B
    '60000000-0000-0000-0001-000000000006',  -- CSE-3C
    '60000000-0000-0000-0001-000000000007',  -- CSE-4A
    '60000000-0000-0000-0001-000000000008'   -- CSE-4B
)
AND subject_id = '40000000-0000-0000-0001-000000000005'; -- SE (CS401)

-- ========== IT REDISTRIBUTION ==========
-- IT has 7 sections: split 4 + 3

-- IT-F007 → IT-F009: Web Tech for sections 5-7 (IT-3C, IT-4A, IT-4B)
UPDATE section_subjects 
SET faculty_id = '30000000-0000-0000-0002-000000000009'  -- IT-F009
WHERE section_id IN (
    '60000000-0000-0000-0002-000000000005',  -- IT-3C
    '60000000-0000-0000-0002-000000000006',  -- IT-4A
    '60000000-0000-0000-0002-000000000007'   -- IT-4B
)
AND subject_id = '40000000-0000-0000-0002-000000000001'; -- Web Tech (IT201)

-- IT-F001 → IT-F010: Cloud for sections 5-7 (IT-3C, IT-4A, IT-4B)
UPDATE section_subjects 
SET faculty_id = '30000000-0000-0000-0002-000000000010'  -- IT-F010
WHERE section_id IN (
    '60000000-0000-0000-0002-000000000005',  -- IT-3C
    '60000000-0000-0000-0002-000000000006',  -- IT-4A
    '60000000-0000-0000-0002-000000000007'   -- IT-4B
)
AND subject_id = '40000000-0000-0000-0002-000000000002'; -- Cloud (IT301)

-- IT-F002 → IT-F011: Cyber Sec for sections 5-7 (IT-3C, IT-4A, IT-4B)
UPDATE section_subjects 
SET faculty_id = '30000000-0000-0000-0002-000000000011'  -- IT-F011
WHERE section_id IN (
    '60000000-0000-0000-0002-000000000005',  -- IT-3C
    '60000000-0000-0000-0002-000000000006',  -- IT-4A
    '60000000-0000-0000-0002-000000000007'   -- IT-4B
)
AND subject_id = '40000000-0000-0000-0002-000000000003'; -- Cyber Sec (IT302)

-- IT-F003 → IT-F012: ML for sections 5-7 (IT-3C, IT-4A, IT-4B)
UPDATE section_subjects 
SET faculty_id = '30000000-0000-0000-0002-000000000012'  -- IT-F012
WHERE section_id IN (
    '60000000-0000-0000-0002-000000000005',  -- IT-3C
    '60000000-0000-0000-0002-000000000006',  -- IT-4A
    '60000000-0000-0000-0002-000000000007'   -- IT-4B
)
AND subject_id = '40000000-0000-0000-0002-000000000004'; -- ML (IT303)

-- IT-F004 → IT-F013: Big Data for sections 5-7 (IT-3C, IT-4A, IT-4B)
UPDATE section_subjects 
SET faculty_id = '30000000-0000-0000-0002-000000000013'  -- IT-F013
WHERE section_id IN (
    '60000000-0000-0000-0002-000000000005',  -- IT-3C
    '60000000-0000-0000-0002-000000000006',  -- IT-4A
    '60000000-0000-0000-0002-000000000007'   -- IT-4B
)
AND subject_id = '40000000-0000-0000-0002-000000000005'; -- Big Data (IT401)

-- =============================================
-- 5. VERIFICATION QUERIES
-- =============================================

-- Check faculty count
SELECT 'Total Faculty' as metric, COUNT(*) as count FROM faculty;

-- Check new faculty workload distribution
SELECT 
    f.code as faculty_code,
    f.name as faculty_name,
    COUNT(DISTINCT ss.section_id) as sections,
    COUNT(DISTINCT CASE WHEN s.subject_type = 'theory' THEN ss.section_id END) as theory_sections,
    COUNT(DISTINCT CASE WHEN s.subject_type = 'lab' THEN ss.section_id END) as lab_sections,
    SUM(CASE WHEN s.subject_type = 'theory' THEN s.periods_per_week ELSE 0 END) as theory_periods,
    SUM(CASE WHEN s.subject_type = 'lab' THEN s.periods_per_week ELSE 0 END) as lab_periods
FROM faculty f
LEFT JOIN section_subjects ss ON f.id = ss.faculty_id
LEFT JOIN subjects s ON ss.subject_id = s.id
WHERE f.code LIKE 'CSE-F%' OR f.code LIKE 'IT-F%'
GROUP BY f.code, f.name
ORDER BY f.code;

-- Check OS (CS302) distribution specifically - the failing subject
SELECT 
    sec.name as section_name,
    sub.code as subject_code,
    sub.name as subject_name,
    f.code as faculty_code
FROM section_subjects ss
JOIN sections sec ON ss.section_id = sec.id
JOIN subjects sub ON ss.subject_id = sub.id
JOIN faculty f ON ss.faculty_id = f.id
WHERE sub.code = 'CS302'  -- OS - the failing subject
ORDER BY sec.name;

-- =============================================
-- SUMMARY OF CHANGES
-- =============================================
-- New Faculty Added (10 total):
--   CSE: F009 (DBMS), F010 (DS), F011 (OS), F012 (CN), F013 (SE)
--   IT:  F009 (Web Tech), F010 (Cloud), F011 (Cyber Sec), F012 (ML), F013 (Big Data)
--
-- Load Distribution After Changes:
--   CSE Faculty (sections 1-4 = CSE-2A, 2B, 2C, 3A):
--     F001: DBMS 4 sections (16 theory + 12 lab = 28 periods, 58%)
--     F002: OS 4 sections (16 theory + 12 lab = 28 periods, 58%)
--     F003: CN 4 sections (16 theory + 12 lab = 28 periods, 58%)
--     F004: SE 4 sections (16 theory + 12 lab = 28 periods, 58%)
--     F007: DS 4 sections (16 theory = 16 periods, 33%)
--
--   CSE Faculty (sections 5-8 = CSE-3B, 3C, 4A, 4B):
--     F009: DBMS 4 sections (16 theory = 16 periods, 33%)
--     F010: DS 4 sections (16 theory = 16 periods, 33%)
--     F011: OS 4 sections (16 theory = 16 periods, 33%)  ← Fixes CSE-4B CS302!
--     F012: CN 4 sections (16 theory = 16 periods, 33%)
--     F013: SE 4 sections (16 theory = 16 periods, 33%)
--
--   IT Faculty (sections 1-4 = IT-2A, 2B, 3A, 3B):
--     F001-F004: 4 sections each + labs
--     F007: Web Tech 4 sections
--
--   IT Faculty (sections 5-7 = IT-3C, 4A, 4B):
--     F009-F013: 3 sections each (theory only)
-- =============================================
