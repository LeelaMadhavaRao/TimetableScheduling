-- Sample Data Script for Timetable Scheduling System
-- 15 Sections, 10 Classrooms (5 Theory + 5 Labs), 12 Faculty, 16 Subjects
-- Theory: 4 periods/week (or 2 for 1 subject/section after fallback), Labs: 3 continuous periods once/week
-- Each section: 5 theory subjects + 3 lab subjects = 8 subjects
-- 
-- ✅ BALANCED CONFIGURATION:
-- With 45 labs requiring 3 consecutive periods and 5 lab rooms:
--   - Lab availability: 5 rooms × 12 blocks/week = 60 blocks for 45 needed (33% slack) ✓✓
--   - Theory availability: 5 rooms × 48 periods/week = 240 periods
--   - Theory demand: 15 sections × 18 = 270 periods (after fallback)
--   - Extra periods from 3-period labs: 15 sections × 3 labs × (4-3) = 45 extra periods available!
-- 
-- 🔄 AUTOMATIC FALLBACK (triggers if ILP theory scheduling fails):
-- Strategy: 1 subject per section gets reduced from 4 to 2 periods/week
-- After fallback: (4 subjects × 4 periods) + (1 subject × 2 periods) = 18 periods/section
-- Total after fallback: 15 sections × 18 = 270 periods
-- 
-- 👥 FACULTY LOAD DISTRIBUTION:
-- Each lab subject has 2 faculty members to spread the teaching load
-- This prevents faculty bottleneck (was causing INFEASIBLE with single faculty per lab)

-- Clear existing data (in reverse order of dependencies)
TRUNCATE TABLE timetable_optimized CASCADE;
TRUNCATE TABLE timetable_base CASCADE;
TRUNCATE TABLE timetable_jobs CASCADE;
TRUNCATE TABLE faculty_availability CASCADE;
TRUNCATE TABLE section_subjects CASCADE;
TRUNCATE TABLE subject_faculty CASCADE;
TRUNCATE TABLE sections CASCADE;
TRUNCATE TABLE subjects CASCADE;
TRUNCATE TABLE faculty CASCADE;
TRUNCATE TABLE classrooms CASCADE;
TRUNCATE TABLE departments CASCADE;

-- =============================================
-- 1. DEPARTMENTS (2 departments)
-- =============================================
INSERT INTO departments (id, name, code, created_at) VALUES
('20000000-0000-0000-0000-000000000001', 'Computer Science & Engineering', 'CSE', NOW()),
('20000000-0000-0000-0000-000000000002', 'Information Technology', 'IT', NOW());

-- =============================================
-- 2. CLASSROOMS (13 total: 8 Theory + 5 Labs)
-- Theory: 8 rooms × 48 periods/week = 384 slots for 300 needed (78% utilization)
-- Labs: 5 rooms × 12 blocks/week = 60 blocks for 45 needed (75% utilization)
-- =============================================
INSERT INTO classrooms (id, name, capacity, room_type, building, floor, created_by) VALUES
-- Theory Classrooms (8 rooms for sufficient capacity)
('50000000-0000-0000-0000-000000000001', 'CR-101', 60, 'theory', 'Main Block', 1, '10000000-0000-0000-0000-000000000001'),
('50000000-0000-0000-0000-000000000002', 'CR-102', 60, 'theory', 'Main Block', 1, '10000000-0000-0000-0000-000000000001'),
('50000000-0000-0000-0000-000000000003', 'CR-103', 60, 'theory', 'Main Block', 2, '10000000-0000-0000-0000-000000000001'),
('50000000-0000-0000-0000-000000000004', 'CR-104', 60, 'theory', 'Main Block', 2, '10000000-0000-0000-0000-000000000001'),
('50000000-0000-0000-0000-000000000005', 'CR-105', 60, 'theory', 'Main Block', 3, '10000000-0000-0000-0000-000000000001'),
('50000000-0000-0000-0000-000000000011', 'CR-106', 60, 'theory', 'Main Block', 3, '10000000-0000-0000-0000-000000000001'),
('50000000-0000-0000-0000-000000000012', 'CR-107', 60, 'theory', 'Main Block', 4, '10000000-0000-0000-0000-000000000001'),
('50000000-0000-0000-0000-000000000013', 'CR-108', 60, 'theory', 'Main Block', 4, '10000000-0000-0000-0000-000000000001'),
-- Lab Classrooms (5 labs - provides 33% slack for 45 lab blocks, handles faculty constraints)
('50000000-0000-0000-0000-000000000006', 'LAB-01', 60, 'lab', 'Lab Block', 1, '10000000-0000-0000-0000-000000000001'),
('50000000-0000-0000-0000-000000000007', 'LAB-02', 60, 'lab', 'Lab Block', 2, '10000000-0000-0000-0000-000000000001'),
('50000000-0000-0000-0000-000000000008', 'LAB-03', 60, 'lab', 'Lab Block', 3, '10000000-0000-0000-0000-000000000001'),
('50000000-0000-0000-0000-000000000009', 'LAB-04', 60, 'lab', 'Lab Block', 4, '10000000-0000-0000-0000-000000000001'),
('50000000-0000-0000-0000-000000000010', 'LAB-05', 60, 'lab', 'Lab Block', 5, '10000000-0000-0000-0000-000000000001');

-- =============================================
-- 3. FACULTY (16 faculty members: 8 CSE + 8 IT)
-- Lab faculty: F001-F006 (teach labs, some also teach theory)
-- Theory-only faculty: F007-F008 (dedicated to theory, no lab conflicts)
-- =============================================
INSERT INTO faculty (id, code, name, email, department_id, phone, is_active, created_by) VALUES
-- CSE Faculty (8: 6 lab-capable + 2 theory-only)
('30000000-0000-0000-0001-000000000001', 'CSE-F001', 'Dr. Arun Sharma', 'arun@college.edu', '20000000-0000-0000-0000-000000000001', '9876543201', true, '10000000-0000-0000-0000-000000000001'),
('30000000-0000-0000-0001-000000000002', 'CSE-F002', 'Prof. Priya Nair', 'priya@college.edu', '20000000-0000-0000-0000-000000000001', '9876543202', true, '10000000-0000-0000-0000-000000000001'),
('30000000-0000-0000-0001-000000000003', 'CSE-F003', 'Mr. Karthik R', 'karthik@college.edu', '20000000-0000-0000-0000-000000000001', '9876543203', true, '10000000-0000-0000-0000-000000000001'),
('30000000-0000-0000-0001-000000000004', 'CSE-F004', 'Ms. Deepa M', 'deepa@college.edu', '20000000-0000-0000-0000-000000000001', '9876543204', true, '10000000-0000-0000-0000-000000000001'),
('30000000-0000-0000-0001-000000000005', 'CSE-F005', 'Dr. Ramesh K', 'ramesh@college.edu', '20000000-0000-0000-0000-000000000001', '9876543205', true, '10000000-0000-0000-0000-000000000001'),
('30000000-0000-0000-0001-000000000006', 'CSE-F006', 'Prof. Sunitha V', 'sunitha@college.edu', '20000000-0000-0000-0000-000000000001', '9876543206', true, '10000000-0000-0000-0000-000000000001'),
('30000000-0000-0000-0001-000000000007', 'CSE-F007', 'Dr. Mohan P', 'mohan@college.edu', '20000000-0000-0000-0000-000000000001', '9876543213', true, '10000000-0000-0000-0000-000000000001'),
('30000000-0000-0000-0001-000000000008', 'CSE-F008', 'Prof. Saranya K', 'saranya@college.edu', '20000000-0000-0000-0000-000000000001', '9876543214', true, '10000000-0000-0000-0000-000000000001'),
-- IT Faculty (8: 6 lab-capable + 2 theory-only)
('30000000-0000-0000-0002-000000000001', 'IT-F001', 'Dr. Suresh P', 'suresh@college.edu', '20000000-0000-0000-0000-000000000002', '9876543207', true, '10000000-0000-0000-0000-000000000001'),
('30000000-0000-0000-0002-000000000002', 'IT-F002', 'Prof. Meena K', 'meena@college.edu', '20000000-0000-0000-0000-000000000002', '9876543208', true, '10000000-0000-0000-0000-000000000001'),
('30000000-0000-0000-0002-000000000003', 'IT-F003', 'Mr. Vijay S', 'vijay@college.edu', '20000000-0000-0000-0000-000000000002', '9876543209', true, '10000000-0000-0000-0000-000000000001'),
('30000000-0000-0000-0002-000000000004', 'IT-F004', 'Ms. Lakshmi R', 'lakshmi@college.edu', '20000000-0000-0000-0000-000000000002', '9876543210', true, '10000000-0000-0000-0000-000000000001'),
('30000000-0000-0000-0002-000000000005', 'IT-F005', 'Dr. Ganesh M', 'ganesh@college.edu', '20000000-0000-0000-0000-000000000002', '9876543211', true, '10000000-0000-0000-0000-000000000001'),
('30000000-0000-0000-0002-000000000006', 'IT-F006', 'Prof. Anitha B', 'anitha@college.edu', '20000000-0000-0000-0000-000000000002', '9876543212', true, '10000000-0000-0000-0000-000000000001'),
('30000000-0000-0000-0002-000000000007', 'IT-F007', 'Dr. Ravi Kumar', 'ravi@college.edu', '20000000-0000-0000-0000-000000000002', '9876543215', true, '10000000-0000-0000-0000-000000000001'),
('30000000-0000-0000-0002-000000000008', 'IT-F008', 'Prof. Divya S', 'divya@college.edu', '20000000-0000-0000-0000-000000000002', '9876543216', true, '10000000-0000-0000-0000-000000000001');

-- =============================================
-- 4. SUBJECTS (16 total: 10 Theory + 6 Labs)
-- Theory: 4 periods/week
-- Labs: 3 periods/week (continuous block)
-- =============================================
INSERT INTO subjects (id, name, code, subject_type, periods_per_week, department_id, created_by) VALUES
-- CSE Theory Subjects (5) - 4 periods/week each
('40000000-0000-0000-0001-000000000001', 'Data Structures', 'CS201', 'theory', 4, '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
('40000000-0000-0000-0001-000000000002', 'Database Management', 'CS301', 'theory', 4, '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
('40000000-0000-0000-0001-000000000003', 'Operating Systems', 'CS302', 'theory', 4, '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
('40000000-0000-0000-0001-000000000004', 'Computer Networks', 'CS303', 'theory', 4, '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
('40000000-0000-0000-0001-000000000005', 'Software Engineering', 'CS401', 'theory', 4, '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),

-- CSE Lab Subjects (3) - 3 periods/week each (continuous block)
('40000000-0000-0000-0001-000000000006', 'Data Structures Lab', 'CS201L', 'lab', 3, '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
('40000000-0000-0000-0001-000000000007', 'DBMS Lab', 'CS301L', 'lab', 3, '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
('40000000-0000-0000-0001-000000000008', 'Networks Lab', 'CS303L', 'lab', 3, '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),

-- IT Theory Subjects (5) - 4 periods/week each
('40000000-0000-0000-0002-000000000001', 'Web Technologies', 'IT201', 'theory', 4, '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001'),
('40000000-0000-0000-0002-000000000002', 'Cloud Computing', 'IT301', 'theory', 4, '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001'),
('40000000-0000-0000-0002-000000000003', 'Cyber Security', 'IT302', 'theory', 4, '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001'),
('40000000-0000-0000-0002-000000000004', 'Machine Learning', 'IT303', 'theory', 4, '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001'),
('40000000-0000-0000-0002-000000000005', 'Big Data Analytics', 'IT401', 'theory', 4, '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001'),

-- IT Lab Subjects (3) - 3 periods/week each (continuous block)
('40000000-0000-0000-0002-000000000006', 'Web Tech Lab', 'IT201L', 'lab', 3, '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001'),
('40000000-0000-0000-0002-000000000007', 'Cloud Lab', 'IT301L', 'lab', 3, '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001'),
('40000000-0000-0000-0002-000000000008', 'ML Lab', 'IT303L', 'lab', 3, '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001');

-- =============================================
-- 5. SECTIONS (15 sections: 8 CSE + 7 IT)
-- =============================================
INSERT INTO sections (id, name, year_level, department_id, student_count, created_by) VALUES
-- CSE Sections (Year 2: 3, Year 3: 3, Year 4: 2)
('60000000-0000-0000-0001-000000000001', 'CSE-2A', 2, '20000000-0000-0000-0000-000000000001', 50, '10000000-0000-0000-0000-000000000001'),
('60000000-0000-0000-0001-000000000002', 'CSE-2B', 2, '20000000-0000-0000-0000-000000000001', 50, '10000000-0000-0000-0000-000000000001'),
('60000000-0000-0000-0001-000000000003', 'CSE-2C', 2, '20000000-0000-0000-0000-000000000001', 50, '10000000-0000-0000-0000-000000000001'),
('60000000-0000-0000-0001-000000000004', 'CSE-3A', 3, '20000000-0000-0000-0000-000000000001', 45, '10000000-0000-0000-0000-000000000001'),
('60000000-0000-0000-0001-000000000005', 'CSE-3B', 3, '20000000-0000-0000-0000-000000000001', 45, '10000000-0000-0000-0000-000000000001'),
('60000000-0000-0000-0001-000000000006', 'CSE-3C', 3, '20000000-0000-0000-0000-000000000001', 45, '10000000-0000-0000-0000-000000000001'),
('60000000-0000-0000-0001-000000000007', 'CSE-4A', 4, '20000000-0000-0000-0000-000000000001', 40, '10000000-0000-0000-0000-000000000001'),
('60000000-0000-0000-0001-000000000008', 'CSE-4B', 4, '20000000-0000-0000-0000-000000000001', 40, '10000000-0000-0000-0000-000000000001'),
-- IT Sections (Year 2: 2, Year 3: 3, Year 4: 2)
('60000000-0000-0000-0002-000000000001', 'IT-2A', 2, '20000000-0000-0000-0000-000000000002', 50, '10000000-0000-0000-0000-000000000001'),
('60000000-0000-0000-0002-000000000002', 'IT-2B', 2, '20000000-0000-0000-0000-000000000002', 50, '10000000-0000-0000-0000-000000000001'),
('60000000-0000-0000-0002-000000000003', 'IT-3A', 3, '20000000-0000-0000-0000-000000000002', 45, '10000000-0000-0000-0000-000000000001'),
('60000000-0000-0000-0002-000000000004', 'IT-3B', 3, '20000000-0000-0000-0000-000000000002', 45, '10000000-0000-0000-0000-000000000001'),
('60000000-0000-0000-0002-000000000005', 'IT-3C', 3, '20000000-0000-0000-0000-000000000002', 45, '10000000-0000-0000-0000-000000000001'),
('60000000-0000-0000-0002-000000000006', 'IT-4A', 4, '20000000-0000-0000-0000-000000000002', 40, '10000000-0000-0000-0000-000000000001'),
('60000000-0000-0000-0002-000000000007', 'IT-4B', 4, '20000000-0000-0000-0000-000000000002', 40, '10000000-0000-0000-0000-000000000001');

-- =============================================
-- 6. SUBJECT-FACULTY MAPPING
-- IMPORTANT: Theory subjects have DEDICATED faculty (F007/F008) who don't teach labs
-- This prevents lab scheduling from blocking theory slots!
-- Labs have dedicated faculty (F001-F006) separate from main theory faculty
-- =============================================
INSERT INTO subject_faculty (subject_id, faculty_id) VALUES
-- CSE Theory Subject-Faculty (2 faculty per subject: 1 dedicated theory-only + 1 backup)
-- F007/F008 are THEORY-ONLY (never blocked by labs)
('40000000-0000-0000-0001-000000000001', '30000000-0000-0000-0001-000000000007'), -- DS - Dr. Mohan (theory-only)
('40000000-0000-0000-0001-000000000001', '30000000-0000-0000-0001-000000000008'), -- DS - Prof. Saranya (theory-only backup)
('40000000-0000-0000-0001-000000000002', '30000000-0000-0000-0001-000000000007'), -- DBMS - Dr. Mohan (theory-only)
('40000000-0000-0000-0001-000000000002', '30000000-0000-0000-0001-000000000008'), -- DBMS - Prof. Saranya (theory-only backup)
('40000000-0000-0000-0001-000000000003', '30000000-0000-0000-0001-000000000007'), -- OS - Dr. Mohan (theory-only)
('40000000-0000-0000-0001-000000000003', '30000000-0000-0000-0001-000000000008'), -- OS - Prof. Saranya (theory-only backup)
('40000000-0000-0000-0001-000000000004', '30000000-0000-0000-0001-000000000007'), -- CN - Dr. Mohan (theory-only)
('40000000-0000-0000-0001-000000000004', '30000000-0000-0000-0001-000000000008'), -- CN - Prof. Saranya (theory-only backup)
('40000000-0000-0000-0001-000000000005', '30000000-0000-0000-0001-000000000007'), -- SE - Dr. Mohan (theory-only)
('40000000-0000-0000-0001-000000000005', '30000000-0000-0000-0001-000000000008'), -- SE - Prof. Saranya (theory-only backup)

-- CSE Lab Subject-Faculty (dedicated lab faculty F001-F006, 2 per lab)
('40000000-0000-0000-0001-000000000006', '30000000-0000-0000-0001-000000000001'), -- DS Lab - Dr. Arun (lab only)
('40000000-0000-0000-0001-000000000006', '30000000-0000-0000-0001-000000000006'), -- DS Lab - Prof. Sunitha (lab backup)
('40000000-0000-0000-0001-000000000007', '30000000-0000-0000-0001-000000000002'), -- DBMS Lab - Prof. Priya (lab only)
('40000000-0000-0000-0001-000000000007', '30000000-0000-0000-0001-000000000003'), -- DBMS Lab - Mr. Karthik (lab backup)
('40000000-0000-0000-0001-000000000008', '30000000-0000-0000-0001-000000000004'), -- CN Lab - Ms. Deepa (lab only)
('40000000-0000-0000-0001-000000000008', '30000000-0000-0000-0001-000000000005'), -- CN Lab - Dr. Ramesh (lab backup)

-- IT Theory Subject-Faculty (2 faculty per subject: 1 dedicated theory-only + 1 backup)
-- F007/F008 are THEORY-ONLY (never blocked by labs)
('40000000-0000-0000-0002-000000000001', '30000000-0000-0000-0002-000000000007'), -- Web Tech - Dr. Ravi (theory-only)
('40000000-0000-0000-0002-000000000001', '30000000-0000-0000-0002-000000000008'), -- Web Tech - Prof. Divya (theory-only backup)
('40000000-0000-0000-0002-000000000002', '30000000-0000-0000-0002-000000000007'), -- Cloud - Dr. Ravi (theory-only)
('40000000-0000-0000-0002-000000000002', '30000000-0000-0000-0002-000000000008'), -- Cloud - Prof. Divya (theory-only backup)
('40000000-0000-0000-0002-000000000003', '30000000-0000-0000-0002-000000000007'), -- Cyber Sec - Dr. Ravi (theory-only)
('40000000-0000-0000-0002-000000000003', '30000000-0000-0000-0002-000000000008'), -- Cyber Sec - Prof. Divya (theory-only backup)
('40000000-0000-0000-0002-000000000004', '30000000-0000-0000-0002-000000000007'), -- ML - Dr. Ravi (theory-only)
('40000000-0000-0000-0002-000000000004', '30000000-0000-0000-0002-000000000008'), -- ML - Prof. Divya (theory-only backup)
('40000000-0000-0000-0002-000000000005', '30000000-0000-0000-0002-000000000007'), -- Big Data - Dr. Ravi (theory-only)
('40000000-0000-0000-0002-000000000005', '30000000-0000-0000-0002-000000000008'), -- Big Data - Prof. Divya (theory-only backup)

-- IT Lab Subject-Faculty (dedicated lab faculty F001-F006, 2 per lab)
('40000000-0000-0000-0002-000000000006', '30000000-0000-0000-0002-000000000001'), -- Web Lab - Dr. Suresh (lab only)
('40000000-0000-0000-0002-000000000006', '30000000-0000-0000-0002-000000000006'), -- Web Lab - Prof. Anitha (backup)
('40000000-0000-0000-0002-000000000007', '30000000-0000-0000-0002-000000000002'), -- Cloud Lab - Prof. Meena
('40000000-0000-0000-0002-000000000007', '30000000-0000-0000-0002-000000000003'), -- Cloud Lab - Mr. Vijay (backup)
('40000000-0000-0000-0002-000000000008', '30000000-0000-0000-0002-000000000004'), -- ML Lab - Ms. Lakshmi
('40000000-0000-0000-0002-000000000008', '30000000-0000-0000-0002-000000000005'); -- ML Lab - Dr. Ganesh (backup)

-- =============================================
-- 7. SECTION-SUBJECTS MAPPING
-- MOVED TO SEPARATE FILE: 016_section_subjects_mapping.sql
-- Run that file AFTER this one to load section-subject mappings
-- =============================================
-- NOTE: Section-subjects data has been moved to a separate file for:
-- 1. Easier maintenance and updates
-- 2. Proper faculty distribution (F007 + F008 for theory)
-- 3. Avoiding the "all theory to one faculty" bug that caused INFEASIBLE errors

-- =============================================
-- 8. FACULTY AVAILABILITY
-- All faculty available Monday-Saturday (days 0-5), periods 1-8
-- =============================================
INSERT INTO faculty_availability (faculty_id, day_of_week, start_period, end_period)
SELECT f.id, d.day, 1, 8
FROM faculty f
CROSS JOIN (SELECT generate_series(0, 5) AS day) d;

-- =============================================
-- SUMMARY
-- =============================================
-- Departments: 2 (CSE, IT)
-- Classrooms: 13 (8 Theory + 5 Labs)
-- Faculty: 16 (8 CSE + 8 IT) - includes F007/F008 theory-only faculty per dept
-- Subjects: 16 (10 Theory + 6 Labs)
-- Sections: 15 (8 CSE + 7 IT)
-- 
-- IMPORTANT: Section-subject mappings are in 016_section_subjects_mapping.sql
-- Run that file AFTER this one!
--
-- FACULTY STRATEGY:
--   - Theory: F007 + F008 share the load (3+2 subjects each per section)
--   - Labs: F001-F006 handle labs (never blocked by theory)
--   - This separation prevents faculty conflicts!
-- =============================================

-- Verification queries
SELECT 'Departments' as entity, COUNT(*) as count FROM departments
UNION ALL
SELECT 'Classrooms', COUNT(*) FROM classrooms
UNION ALL
SELECT 'Faculty', COUNT(*) FROM faculty
UNION ALL
SELECT 'Subjects (Theory)', COUNT(*) FROM subjects WHERE subject_type = 'theory'
UNION ALL
SELECT 'Subjects (Lab)', COUNT(*) FROM subjects WHERE subject_type = 'lab'
UNION ALL
SELECT 'Sections', COUNT(*) FROM sections
UNION ALL
SELECT 'Section-Subject Mappings', COUNT(*) FROM section_subjects
UNION ALL
SELECT 'Faculty Availability Slots', COUNT(*) FROM faculty_availability;

-- NOTE: Section-subject mappings will show 0 until you run 016_section_subjects_mapping.sql




