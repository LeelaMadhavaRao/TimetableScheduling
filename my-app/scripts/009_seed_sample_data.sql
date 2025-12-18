-- Seed Script: Sample data for multi-tenant timetable scheduling
-- This creates sample admin, timetable administrators, and complete scheduling data
-- Run AFTER 008_add_created_by_columns.sql

-- =============================================
-- Clear existing data (optional - comment out if you want to keep existing data)
-- =============================================
-- TRUNCATE TABLE timetable_optimized, timetable_base, timetable_jobs, 
--                section_subjects, sections, subject_faculty, subjects, 
--                faculty_availability, faculty, classrooms, departments,
--                user_sessions, timetable_administrators, admin_users CASCADE;

-- =============================================
-- 1. Create System Admin (if not exists)
-- Username: admin, Password: admin123
-- =============================================

-- First, remove any conflicting timetable_administrators records
DELETE FROM timetable_administrators 
WHERE created_by NOT IN (SELECT id FROM admin_users);

-- Delete the old admin user if it exists to ensure we have the correct ID
DELETE FROM admin_users WHERE username = 'admin';

-- Now insert the admin user with the correct ID
INSERT INTO admin_users (id, username, password_hash, name, email)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin',
  crypt('admin123', gen_salt('bf')),
  'System Administrator',
  'admin@timetable.edu'
);

-- =============================================
-- 2. Create Timetable Administrators
-- =============================================

-- Delete old timetable administrators to start fresh
DELETE FROM timetable_administrators 
WHERE username IN ('eng_admin', 'sci_admin');

-- Timetable Admin 1: Engineering College
-- Username: eng_admin, Password: eng123
INSERT INTO timetable_administrators (id, username, password_hash, name, email, phone, institution_name, created_by)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  'eng_admin',
  crypt('eng123', gen_salt('bf')),
  'Dr. Ramesh Kumar',
  'ramesh@engineering.edu',
  '9876543210',
  'ABC Engineering College',
  '00000000-0000-0000-0000-000000000001'
);

-- Timetable Admin 2: Science College
-- Username: sci_admin, Password: sci123
INSERT INTO timetable_administrators (id, username, password_hash, name, email, phone, institution_name, created_by)
VALUES (
  '10000000-0000-0000-0000-000000000002',
  'sci_admin',
  crypt('sci123', gen_salt('bf')),
  'Prof. Lakshmi Devi',
  'lakshmi@science.edu',
  '9876543211',
  'XYZ Science College',
  '00000000-0000-0000-0000-000000000001'
);

-- =============================================
-- 3. ENGINEERING COLLEGE DATA (Admin 1)
-- =============================================

-- Clean up old engineering data by code to handle all existing records
DELETE FROM departments WHERE code IN ('CSE', 'IT');

-- Department for Engineering
INSERT INTO departments (id, name, code, created_by)
VALUES 
  ('20000000-0000-0000-0000-000000000001', 'Computer Science & Engineering', 'CSE', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002', 'Information Technology', 'IT', '10000000-0000-0000-0000-000000000001');

-- Engineering Faculty (including shared guest faculty)
INSERT INTO faculty (id, code, name, email, department_id, phone, is_active, created_by)
VALUES 
  -- CSE Faculty
  ('30000000-0000-0000-0001-000000000001', 'CSE001', 'Dr. Arun Sharma', 'arun@eng.edu', '20000000-0000-0000-0000-000000000001', '9000000001', true, '10000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0001-000000000002', 'CSE002', 'Prof. Priya Nair', 'priya@eng.edu', '20000000-0000-0000-0000-000000000001', '9000000002', true, '10000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0001-000000000003', 'CSE003', 'Mr. Karthik R', 'karthik@eng.edu', '20000000-0000-0000-0000-000000000001', '9000000003', true, '10000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0001-000000000004', 'CSE004', 'Ms. Deepa M', 'deepa@eng.edu', '20000000-0000-0000-0000-000000000001', '9000000004', true, '10000000-0000-0000-0000-000000000001'),
  -- IT Faculty
  ('30000000-0000-0000-0001-000000000005', 'IT001', 'Dr. Suresh P', 'suresh@eng.edu', '20000000-0000-0000-0000-000000000002', '9000000005', true, '10000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0001-000000000006', 'IT002', 'Prof. Meena K', 'meena@eng.edu', '20000000-0000-0000-0000-000000000002', '9000000006', true, '10000000-0000-0000-0000-000000000001'),
  -- Shared Guest Faculty (Mathematics - can teach in both colleges)
  ('30000000-0000-0000-0000-000000000001', 'GUEST001', 'Dr. Sanjay Kumar', 'sanjay.eng@guest.edu', '20000000-0000-0000-0000-000000000001', '9999999999', true, '10000000-0000-0000-0000-000000000001')
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  created_by = EXCLUDED.created_by;

-- Engineering Faculty Availability (All weekdays 1-8 periods)
INSERT INTO faculty_availability (faculty_id, day_of_week, start_period, end_period)
SELECT f.id, d.day, 1, 8
FROM faculty f
CROSS JOIN (SELECT generate_series(0, 5) as day) d
WHERE f.created_by = '10000000-0000-0000-0000-000000000001'
ON CONFLICT (faculty_id, day_of_week, start_period, end_period) DO NOTHING;

-- Engineering Subjects
INSERT INTO subjects (id, name, code, subject_type, periods_per_week, department_id, created_by)
VALUES 
  -- CSE Subjects
  ('40000000-0000-0000-0001-000000000001', 'Data Structures', 'CS201', 'theory', 3, '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0001-000000000002', 'Data Structures Lab', 'CS201L', 'lab', 4, '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0001-000000000003', 'Database Management', 'CS301', 'theory', 3, '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0001-000000000004', 'DBMS Lab', 'CS301L', 'lab', 4, '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0001-000000000005', 'Operating Systems', 'CS302', 'theory', 3, '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0001-000000000006', 'Computer Networks', 'CS303', 'theory', 3, '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  -- IT Subjects
  ('40000000-0000-0000-0001-000000000007', 'Web Technologies', 'IT201', 'theory', 3, '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0001-000000000008', 'Web Tech Lab', 'IT201L', 'lab', 4, '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001')
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  created_by = EXCLUDED.created_by;

-- Engineering Subject-Faculty Mapping
INSERT INTO subject_faculty (subject_id, faculty_id)
VALUES 
  ('40000000-0000-0000-0001-000000000001', '30000000-0000-0000-0001-000000000001'), -- DS - Arun
  ('40000000-0000-0000-0001-000000000002', '30000000-0000-0000-0001-000000000001'), -- DS Lab - Arun
  ('40000000-0000-0000-0001-000000000003', '30000000-0000-0000-0001-000000000002'), -- DBMS - Priya
  ('40000000-0000-0000-0001-000000000004', '30000000-0000-0000-0001-000000000002'), -- DBMS Lab - Priya
  ('40000000-0000-0000-0001-000000000005', '30000000-0000-0000-0001-000000000003'), -- OS - Karthik
  ('40000000-0000-0000-0001-000000000006', '30000000-0000-0000-0001-000000000004'), -- CN - Deepa
  ('40000000-0000-0000-0001-000000000007', '30000000-0000-0000-0001-000000000005'), -- Web - Suresh
  ('40000000-0000-0000-0001-000000000008', '30000000-0000-0000-0001-000000000006')  -- Web Lab - Meena
ON CONFLICT (subject_id, faculty_id) DO NOTHING;

-- Engineering Classrooms
INSERT INTO classrooms (id, name, capacity, room_type, building, floor, created_by)
VALUES 
  ('50000000-0000-0000-0001-000000000001', 'ENG-101', 60, 'theory', 'Engineering Block', 1, '10000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0001-000000000002', 'ENG-102', 60, 'theory', 'Engineering Block', 1, '10000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0001-000000000003', 'ENG-LAB1', 65, 'lab', 'Engineering Block', 2, '10000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0001-000000000004', 'ENG-LAB2', 65, 'lab', 'Engineering Block', 2, '10000000-0000-0000-0000-000000000001')
ON CONFLICT (name) DO UPDATE SET 
  capacity = EXCLUDED.capacity,
  created_by = EXCLUDED.created_by;

-- Engineering Sections
INSERT INTO sections (id, name, year_level, student_count, department_id, created_by)
VALUES 
  ('60000000-0000-0000-0001-000000000001', 'CSE-2A', 2, 55, '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('60000000-0000-0000-0001-000000000002', 'CSE-2B', 2, 55, '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('60000000-0000-0000-0001-000000000003', 'IT-2A', 2, 50, '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001')
ON CONFLICT (name) DO UPDATE SET 
  student_count = EXCLUDED.student_count,
  created_by = EXCLUDED.created_by;

-- Engineering Section-Subject Mapping
INSERT INTO section_subjects (section_id, subject_id, faculty_id)
VALUES 
  -- CSE-2A
  ('60000000-0000-0000-0001-000000000001', '40000000-0000-0000-0001-000000000001', '30000000-0000-0000-0001-000000000001'), -- DS
  ('60000000-0000-0000-0001-000000000001', '40000000-0000-0000-0001-000000000002', '30000000-0000-0000-0001-000000000001'), -- DS Lab
  ('60000000-0000-0000-0001-000000000001', '40000000-0000-0000-0001-000000000003', '30000000-0000-0000-0001-000000000002'), -- DBMS
  ('60000000-0000-0000-0001-000000000001', '40000000-0000-0000-0001-000000000004', '30000000-0000-0000-0001-000000000002'), -- DBMS Lab
  ('60000000-0000-0000-0001-000000000001', '40000000-0000-0000-0001-000000000005', '30000000-0000-0000-0001-000000000003'), -- OS
  ('60000000-0000-0000-0001-000000000001', '40000000-0000-0000-0001-000000000006', '30000000-0000-0000-0001-000000000004'), -- CN
  -- CSE-2B
  ('60000000-0000-0000-0001-000000000002', '40000000-0000-0000-0001-000000000001', '30000000-0000-0000-0001-000000000001'), -- DS
  ('60000000-0000-0000-0001-000000000002', '40000000-0000-0000-0001-000000000002', '30000000-0000-0000-0001-000000000001'), -- DS Lab
  ('60000000-0000-0000-0001-000000000002', '40000000-0000-0000-0001-000000000005', '30000000-0000-0000-0001-000000000003'), -- OS
  ('60000000-0000-0000-0001-000000000002', '40000000-0000-0000-0001-000000000006', '30000000-0000-0000-0001-000000000004'), -- CN
  -- IT-2A
  ('60000000-0000-0000-0001-000000000003', '40000000-0000-0000-0001-000000000007', '30000000-0000-0000-0001-000000000005'), -- Web
  ('60000000-0000-0000-0001-000000000003', '40000000-0000-0000-0001-000000000008', '30000000-0000-0000-0001-000000000006')  -- Web Lab
ON CONFLICT (section_id, subject_id) DO UPDATE SET 
  faculty_id = EXCLUDED.faculty_id;

-- =============================================
-- 4. SCIENCE COLLEGE DATA (Admin 2)
-- =============================================

-- Clean up old science data by code to handle all existing records
DELETE FROM departments WHERE code IN ('PHY', 'CHEM');

-- Department for Science
INSERT INTO departments (id, name, code, created_by)
VALUES 
  ('20000000-0000-0000-0000-000000000003', 'Physics', 'PHY', '10000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000004', 'Chemistry', 'CHEM', '10000000-0000-0000-0000-000000000002');

-- Science Faculty (including shared guest faculty)
INSERT INTO faculty (id, code, name, email, department_id, phone, is_active, created_by)
VALUES 
  -- Physics Faculty
  ('30000000-0000-0000-0002-000000000001', 'PHY001', 'Dr. Venkat Rao', 'venkat@sci.edu', '20000000-0000-0000-0000-000000000003', '9100000001', true, '10000000-0000-0000-0000-000000000002'),
  ('30000000-0000-0000-0002-000000000002', 'PHY002', 'Prof. Anitha S', 'anitha@sci.edu', '20000000-0000-0000-0000-000000000003', '9100000002', true, '10000000-0000-0000-0000-000000000002'),
  -- Chemistry Faculty
  ('30000000-0000-0000-0002-000000000003', 'CHEM001', 'Dr. Rajesh B', 'rajesh@sci.edu', '20000000-0000-0000-0000-000000000004', '9100000003', true, '10000000-0000-0000-0000-000000000002'),
  ('30000000-0000-0000-0002-000000000004', 'CHEM002', 'Ms. Kavitha L', 'kavitha@sci.edu', '20000000-0000-0000-0000-000000000004', '9100000004', true, '10000000-0000-0000-0000-000000000002'),
  -- Shared Guest Faculty (same person, different record for Science college)
  ('30000000-0000-0000-0000-000000000002', 'GUEST001S', 'Dr. Sanjay Kumar', 'sanjay.sci@guest.edu', '20000000-0000-0000-0000-000000000003', '9999999999', true, '10000000-0000-0000-0000-000000000002')
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  created_by = EXCLUDED.created_by;

-- Science Faculty Availability
INSERT INTO faculty_availability (faculty_id, day_of_week, start_period, end_period)
SELECT f.id, d.day, 1, 8
FROM faculty f
CROSS JOIN (SELECT generate_series(0, 5) as day) d
WHERE f.created_by = '10000000-0000-0000-0000-000000000002'
ON CONFLICT (faculty_id, day_of_week, start_period, end_period) DO NOTHING;

-- Science Subjects
INSERT INTO subjects (id, name, code, subject_type, periods_per_week, department_id, created_by)
VALUES 
  -- Physics Subjects
  ('40000000-0000-0000-0002-000000000001', 'Mechanics', 'PHY101', 'theory', 3, '20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002'),
  ('40000000-0000-0000-0002-000000000002', 'Physics Lab', 'PHY101L', 'lab', 4, '20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002'),
  ('40000000-0000-0000-0002-000000000003', 'Thermodynamics', 'PHY102', 'theory', 3, '20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002'),
  -- Chemistry Subjects
  ('40000000-0000-0000-0002-000000000004', 'Organic Chemistry', 'CHEM101', 'theory', 3, '20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002'),
  ('40000000-0000-0000-0002-000000000005', 'Chemistry Lab', 'CHEM101L', 'lab', 4, '20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002'),
  ('40000000-0000-0000-0002-000000000006', 'Inorganic Chemistry', 'CHEM102', 'theory', 3, '20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002')
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  created_by = EXCLUDED.created_by;

-- Science Subject-Faculty Mapping
INSERT INTO subject_faculty (subject_id, faculty_id)
VALUES 
  ('40000000-0000-0000-0002-000000000001', '30000000-0000-0000-0002-000000000001'), -- Mechanics - Venkat
  ('40000000-0000-0000-0002-000000000002', '30000000-0000-0000-0002-000000000002'), -- Physics Lab - Anitha
  ('40000000-0000-0000-0002-000000000003', '30000000-0000-0000-0002-000000000001'), -- Thermo - Venkat
  ('40000000-0000-0000-0002-000000000004', '30000000-0000-0000-0002-000000000003'), -- Organic - Rajesh
  ('40000000-0000-0000-0002-000000000005', '30000000-0000-0000-0002-000000000004'), -- Chem Lab - Kavitha
  ('40000000-0000-0000-0002-000000000006', '30000000-0000-0000-0002-000000000003')  -- Inorganic - Rajesh
ON CONFLICT (subject_id, faculty_id) DO NOTHING;

-- Science Classrooms
INSERT INTO classrooms (id, name, capacity, room_type, building, floor, created_by)
VALUES 
  ('50000000-0000-0000-0002-000000000001', 'SCI-101', 50, 'theory', 'Science Block', 1, '10000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0002-000000000002', 'SCI-102', 50, 'theory', 'Science Block', 1, '10000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0002-000000000003', 'SCI-LAB1', 55, 'lab', 'Science Block', 2, '10000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0002-000000000004', 'SCI-LAB2', 55, 'lab', 'Science Block', 2, '10000000-0000-0000-0000-000000000002')
ON CONFLICT (name) DO UPDATE SET 
  capacity = EXCLUDED.capacity,
  created_by = EXCLUDED.created_by;

-- Science Sections
INSERT INTO sections (id, name, year_level, student_count, department_id, created_by)
VALUES 
  ('60000000-0000-0000-0002-000000000001', 'PHY-1A', 1, 45, '20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002'),
  ('60000000-0000-0000-0002-000000000002', 'CHEM-1A', 1, 45, '20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002')
ON CONFLICT (name) DO UPDATE SET 
  student_count = EXCLUDED.student_count,
  created_by = EXCLUDED.created_by;

-- Science Section-Subject Mapping
INSERT INTO section_subjects (section_id, subject_id, faculty_id)
VALUES 
  -- PHY-1A
  ('60000000-0000-0000-0002-000000000001', '40000000-0000-0000-0002-000000000001', '30000000-0000-0000-0002-000000000001'), -- Mechanics
  ('60000000-0000-0000-0002-000000000001', '40000000-0000-0000-0002-000000000002', '30000000-0000-0000-0002-000000000002'), -- Physics Lab
  ('60000000-0000-0000-0002-000000000001', '40000000-0000-0000-0002-000000000003', '30000000-0000-0000-0002-000000000001'), -- Thermo
  -- CHEM-1A
  ('60000000-0000-0000-0002-000000000002', '40000000-0000-0000-0002-000000000004', '30000000-0000-0000-0002-000000000003'), -- Organic
  ('60000000-0000-0000-0002-000000000002', '40000000-0000-0000-0002-000000000005', '30000000-0000-0000-0002-000000000004'), -- Chem Lab
  ('60000000-0000-0000-0002-000000000002', '40000000-0000-0000-0002-000000000006', '30000000-0000-0000-0002-000000000003')  -- Inorganic
ON CONFLICT (section_id, subject_id) DO UPDATE SET 
  faculty_id = EXCLUDED.faculty_id;

-- =============================================
-- Summary of Test Credentials
-- =============================================
/*
SYSTEM ADMIN:
  Username: admin
  Password: admin123
  Access: /login/admin -> /dashboard/admin

TIMETABLE ADMIN 1 (Engineering College):
  Username: eng_admin
  Password: eng123
  Access: /login/timetable-admin -> /admin
  Data: 
    - 2 Departments (CSE, IT)
    - 6 Faculty members
    - 8 Subjects (including 2 labs)
    - 4 Classrooms (2 theory, 2 lab)
    - 3 Sections

TIMETABLE ADMIN 2 (Science College):
  Username: sci_admin
  Password: sci123
  Access: /login/timetable-admin -> /admin
  Data:
    - 2 Departments (Physics, Chemistry)
    - 4 Faculty members
    - 6 Subjects (including 2 labs)
    - 4 Classrooms (2 theory, 2 lab)
    - 2 Sections

FACULTY LOGIN (samples):
  Engineering:
    Code: CSE001, Phone: 9000000001 (Dr. Arun Sharma)
    Code: CSE002, Phone: 9000000002 (Prof. Priya Nair)
  Science:
    Code: PHY001, Phone: 9100000001 (Dr. Venkat Rao)
    Code: CHEM001, Phone: 9100000003 (Dr. Rajesh B)
  
  SHARED GUEST FACULTY (works for BOTH colleges):
    Engineering College:
      Code: GUEST001, Phone: 9999999999 (Dr. Sanjay Kumar)
    Science College:
      Code: GUEST001S, Phone: 9999999999 (Dr. Sanjay Kumar)
    
    Note: Same phone number, different codes per college
*/

COMMIT;
