-- =============================================
-- 019: COMPREHENSIVE SAMPLE DATA (20 Sections)
-- 20 sections × 5 theory subjects + 3 lab subjects
-- =============================================
-- WARNING: This clears existing timetable data first.
-- Run in Supabase SQL Editor.
-- =============================================

BEGIN;

-- Clean up existing timetable data
DELETE FROM timetable_optimized;
DELETE FROM timetable_base;
DELETE FROM timetable_jobs;
DELETE FROM section_subjects;
DELETE FROM subject_faculty;
DELETE FROM faculty_availability;
DELETE FROM faculty;
DELETE FROM subjects;
DELETE FROM sections;
DELETE FROM classrooms;
DELETE FROM departments;

-- Delete old sample admin if exists
DELETE FROM timetable_administrators WHERE username = 'sample_admin';

-- =============================================
-- SAMPLE TIMETABLE ADMINISTRATOR
-- =============================================
INSERT INTO timetable_administrators (id, username, password_hash, name, email, is_active)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'sample_admin',
  hash_password('password123'),
  'Sample Admin',
  'admin@timetable.edu',
  true
);

-- =============================================
-- DEPARTMENTS (3)
-- =============================================
INSERT INTO departments (id, name, code) VALUES
  (gen_random_uuid(), 'Computer Science & Engineering', 'CSE'),
  (gen_random_uuid(), 'Information Technology', 'IT'),
  (gen_random_uuid(), 'Electronics & Communication', 'ECE');

-- =============================================
-- CLASSROOMS (12 theory + 8 lab = 20)
-- =============================================
-- Theory rooms (capacity 60-80)
INSERT INTO classrooms (id, name, capacity, room_type, building, floor) VALUES
  (gen_random_uuid(), 'CSE-TH-101', 70, 'theory', 'CSE Block', 1),
  (gen_random_uuid(), 'CSE-TH-102', 70, 'theory', 'CSE Block', 1),
  (gen_random_uuid(), 'IT-TH-201',  70, 'theory', 'IT Block',  2),
  (gen_random_uuid(), 'IT-TH-202',  70, 'theory', 'IT Block',  2),
  (gen_random_uuid(), 'ECE-TH-301', 65, 'theory', 'ECE Block', 3),
  (gen_random_uuid(), 'ECE-TH-302', 65, 'theory', 'ECE Block', 3),
  (gen_random_uuid(), 'TH-401',     80, 'theory', 'Main Block', 4),
  (gen_random_uuid(), 'TH-402',     80, 'theory', 'Main Block', 4),
  (gen_random_uuid(), 'TH-403',     60, 'theory', 'Main Block', 4),
  (gen_random_uuid(), 'TH-501',     75, 'theory', 'Annex',      5),
  (gen_random_uuid(), 'TH-502',     75, 'theory', 'Annex',      5),
  (gen_random_uuid(), 'TH-503',     60, 'theory', 'Annex',      5);

-- Lab rooms (capacity 40-60)
INSERT INTO classrooms (id, name, capacity, room_type, building, floor) VALUES
  (gen_random_uuid(), 'CSE-LAB-1', 50, 'lab', 'CSE Block', 1),
  (gen_random_uuid(), 'CSE-LAB-2', 50, 'lab', 'CSE Block', 1),
  (gen_random_uuid(), 'IT-LAB-1',  50, 'lab', 'IT Block',  2),
  (gen_random_uuid(), 'IT-LAB-2',  50, 'lab', 'IT Block',  2),
  (gen_random_uuid(), 'ECE-LAB-1', 40, 'lab', 'ECE Block', 3),
  (gen_random_uuid(), 'ECE-LAB-2', 40, 'lab', 'ECE Block', 3),
  (gen_random_uuid(), 'LAB-401',   60, 'lab', 'Main Block', 4),
  (gen_random_uuid(), 'LAB-402',   60, 'lab', 'Main Block', 4);

-- =============================================
-- THEORY SUBJECTS (15 unique)
-- =============================================
DO $$
DECLARE
  cse_dept_id UUID; it_dept_id UUID; ece_dept_id UUID;
BEGIN
  SELECT id INTO cse_dept_id FROM departments WHERE code = 'CSE';
  SELECT id INTO it_dept_id  FROM departments WHERE code = 'IT';
  SELECT id INTO ece_dept_id FROM departments WHERE code = 'ECE';

  INSERT INTO subjects (id, code, name, subject_type, periods_per_week, department_id) VALUES
    (gen_random_uuid(), 'CS301',   'Data Structures',       'theory', 3, cse_dept_id),
    (gen_random_uuid(), 'CS302',   'Algorithms',            'theory', 3, cse_dept_id),
    (gen_random_uuid(), 'CS303',   'Database Management',   'theory', 3, cse_dept_id),
    (gen_random_uuid(), 'CS304',   'Operating Systems',     'theory', 3, cse_dept_id),
    (gen_random_uuid(), 'CS305',   'Computer Networks',     'theory', 3, cse_dept_id),
    (gen_random_uuid(), 'IT301',   'Software Engineering',  'theory', 3, it_dept_id),
    (gen_random_uuid(), 'IT302',   'Object Oriented Java',  'theory', 3, it_dept_id),
    (gen_random_uuid(), 'IT303',   'Web Technologies',      'theory', 3, it_dept_id),
    (gen_random_uuid(), 'IT304',   'Python Programming',    'theory', 3, it_dept_id),
    (gen_random_uuid(), 'IT305',   'Discrete Mathematics',  'theory', 3, it_dept_id),
    (gen_random_uuid(), 'EC301',   'Digital Electronics',   'theory', 3, ece_dept_id),
    (gen_random_uuid(), 'EC302',   'Signals & Systems',     'theory', 3, ece_dept_id),
    (gen_random_uuid(), 'EC303',   'Microprocessors',       'theory', 3, ece_dept_id),
    (gen_random_uuid(), 'EC304',   'Communication Systems', 'theory', 3, ece_dept_id),
    (gen_random_uuid(), 'EC305',   'VLSI Design',           'theory', 3, ece_dept_id);

  -- LAB SUBJECTS (9 unique)
  INSERT INTO subjects (id, code, name, subject_type, periods_per_week, department_id) VALUES
    (gen_random_uuid(), 'CS311L', 'Data Structures Lab',       'lab', 3, cse_dept_id),
    (gen_random_uuid(), 'CS312L', 'DBMS Lab',                  'lab', 3, cse_dept_id),
    (gen_random_uuid(), 'CS313L', 'Operating Systems Lab',     'lab', 3, cse_dept_id),
    (gen_random_uuid(), 'CS314L', 'Computer Networks Lab',     'lab', 3, cse_dept_id),
    (gen_random_uuid(), 'IT311L', 'Java Programming Lab',      'lab', 3, it_dept_id),
    (gen_random_uuid(), 'IT312L', 'Web Technologies Lab',      'lab', 3, it_dept_id),
    (gen_random_uuid(), 'EC311L', 'Digital Electronics Lab',   'lab', 3, ece_dept_id),
    (gen_random_uuid(), 'EC312L', 'Microprocessor Lab',        'lab', 3, ece_dept_id),
    (gen_random_uuid(), 'EC313L', 'Communication Systems Lab', 'lab', 3, ece_dept_id);
END $$;

-- =============================================
-- FACULTY (18 members)
-- =============================================
DO $$
DECLARE
  cse_dept_id UUID; it_dept_id UUID; ece_dept_id UUID;
BEGIN
  SELECT id INTO cse_dept_id FROM departments WHERE code = 'CSE';
  SELECT id INTO it_dept_id  FROM departments WHERE code = 'IT';
  SELECT id INTO ece_dept_id FROM departments WHERE code = 'ECE';

  -- CSE Faculty (6)
  INSERT INTO faculty (id, code, name, email, department_id, phone, is_active) VALUES
    (gen_random_uuid(), 'CSE-F001', 'Dr. Anand Kumar',     'anand@university.edu',    cse_dept_id, '9876540101', true),
    (gen_random_uuid(), 'CSE-F002', 'Dr. Priya Sharma',    'priya@university.edu',    cse_dept_id, '9876540102', true),
    (gen_random_uuid(), 'CSE-F003', 'Prof. Rajesh Verma',  'rajesh@university.edu',   cse_dept_id, '9876540103', true),
    (gen_random_uuid(), 'CSE-F004', 'Dr. Sunita Patil',    'sunita@university.edu',   cse_dept_id, '9876540104', true),
    (gen_random_uuid(), 'CSE-F005', 'Prof. Amit Gupta',    'amit@university.edu',     cse_dept_id, '9876540105', true),
    (gen_random_uuid(), 'CSE-F006', 'Dr. Neha Reddy',      'neha@university.edu',     cse_dept_id, '9876540106', true);

  -- IT Faculty (6)
  INSERT INTO faculty (id, code, name, email, department_id, phone, is_active) VALUES
    (gen_random_uuid(), 'IT-F001',  'Dr. Suresh Iyer',     'suresh@university.edu',   it_dept_id,  '9876540201', true),
    (gen_random_uuid(), 'IT-F002',  'Prof. Meera Nair',    'meera@university.edu',    it_dept_id,  '9876540202', true),
    (gen_random_uuid(), 'IT-F003',  'Dr. Vikram Singh',    'vikram@university.edu',   it_dept_id,  '9876540203', true),
    (gen_random_uuid(), 'IT-F004',  'Prof. Anjali Desai',  'anjali@university.edu',   it_dept_id,  '9876540204', true),
    (gen_random_uuid(), 'IT-F005',  'Dr. Karthik Rao',     'karthik@university.edu',  it_dept_id,  '9876540205', true),
    (gen_random_uuid(), 'IT-F006',  'Prof. Deepa Menon',   'deepa@university.edu',    it_dept_id,  '9876540206', true);

  -- ECE Faculty (6)
  INSERT INTO faculty (id, code, name, email, department_id, phone, is_active) VALUES
    (gen_random_uuid(), 'ECE-F001', 'Dr. Ravi Shankar',    'ravi@university.edu',     ece_dept_id, '9876540301', true),
    (gen_random_uuid(), 'ECE-F002', 'Prof. Lakshmi B',     'lakshmi@university.edu',  ece_dept_id, '9876540302', true),
    (gen_random_uuid(), 'ECE-F003', 'Dr. Manoj Tiwari',    'manoj@university.edu',    ece_dept_id, '9876540303', true),
    (gen_random_uuid(), 'ECE-F004', 'Prof. Kavita Joshi',  'kavita@university.edu',   ece_dept_id, '9876540304', true),
    (gen_random_uuid(), 'ECE-F005', 'Dr. Arun Prasad',     'arun@university.edu',     ece_dept_id, '9876540305', true),
    (gen_random_uuid(), 'ECE-F006', 'Prof. Swati Kulkarni','swati@university.edu',    ece_dept_id, '9876540306', true);
END $$;

-- =============================================
-- SUBJECT-FACULTY MAPPINGS
-- =============================================
DO $$
DECLARE
  subj_id UUID; fac_id UUID;
BEGIN
  -- CSE Theory mappings (each subject → 2 faculty)
  SELECT id INTO subj_id FROM subjects WHERE code = 'CS301';
  SELECT id INTO fac_id FROM faculty WHERE code = 'CSE-F001'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);
  SELECT id INTO fac_id FROM faculty WHERE code = 'CSE-F002'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);

  SELECT id INTO subj_id FROM subjects WHERE code = 'CS302';
  SELECT id INTO fac_id FROM faculty WHERE code = 'CSE-F001'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);
  SELECT id INTO fac_id FROM faculty WHERE code = 'CSE-F003'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);

  SELECT id INTO subj_id FROM subjects WHERE code = 'CS303';
  SELECT id INTO fac_id FROM faculty WHERE code = 'CSE-F002'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);
  SELECT id INTO fac_id FROM faculty WHERE code = 'CSE-F004'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);

  SELECT id INTO subj_id FROM subjects WHERE code = 'CS304';
  SELECT id INTO fac_id FROM faculty WHERE code = 'CSE-F003'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);
  SELECT id INTO fac_id FROM faculty WHERE code = 'CSE-F005'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);

  SELECT id INTO subj_id FROM subjects WHERE code = 'CS305';
  SELECT id INTO fac_id FROM faculty WHERE code = 'CSE-F004'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);
  SELECT id INTO fac_id FROM faculty WHERE code = 'CSE-F006'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);

  -- IT Theory mappings
  SELECT id INTO subj_id FROM subjects WHERE code = 'IT301';
  SELECT id INTO fac_id FROM faculty WHERE code = 'IT-F001'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);
  SELECT id INTO fac_id FROM faculty WHERE code = 'IT-F002'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);

  SELECT id INTO subj_id FROM subjects WHERE code = 'IT302';
  SELECT id INTO fac_id FROM faculty WHERE code = 'IT-F001'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);
  SELECT id INTO fac_id FROM faculty WHERE code = 'IT-F003'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);

  SELECT id INTO subj_id FROM subjects WHERE code = 'IT303';
  SELECT id INTO fac_id FROM faculty WHERE code = 'IT-F002'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);
  SELECT id INTO fac_id FROM faculty WHERE code = 'IT-F004'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);

  SELECT id INTO subj_id FROM subjects WHERE code = 'IT304';
  SELECT id INTO fac_id FROM faculty WHERE code = 'IT-F003'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);
  SELECT id INTO fac_id FROM faculty WHERE code = 'IT-F005'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);

  SELECT id INTO subj_id FROM subjects WHERE code = 'IT305';
  SELECT id INTO fac_id FROM faculty WHERE code = 'IT-F004'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);
  SELECT id INTO fac_id FROM faculty WHERE code = 'IT-F006'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);

  -- ECE Theory mappings
  SELECT id INTO subj_id FROM subjects WHERE code = 'EC301';
  SELECT id INTO fac_id FROM faculty WHERE code = 'ECE-F001'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);
  SELECT id INTO fac_id FROM faculty WHERE code = 'ECE-F002'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);

  SELECT id INTO subj_id FROM subjects WHERE code = 'EC302';
  SELECT id INTO fac_id FROM faculty WHERE code = 'ECE-F001'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);
  SELECT id INTO fac_id FROM faculty WHERE code = 'ECE-F003'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);

  SELECT id INTO subj_id FROM subjects WHERE code = 'EC303';
  SELECT id INTO fac_id FROM faculty WHERE code = 'ECE-F002'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);
  SELECT id INTO fac_id FROM faculty WHERE code = 'ECE-F004'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);

  SELECT id INTO subj_id FROM subjects WHERE code = 'EC304';
  SELECT id INTO fac_id FROM faculty WHERE code = 'ECE-F003'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);
  SELECT id INTO fac_id FROM faculty WHERE code = 'ECE-F005'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);

  SELECT id INTO subj_id FROM subjects WHERE code = 'EC305';
  SELECT id INTO fac_id FROM faculty WHERE code = 'ECE-F004'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);
  SELECT id INTO fac_id FROM faculty WHERE code = 'ECE-F006'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);

  -- Lab subject-faculty mappings
  SELECT id INTO subj_id FROM subjects WHERE code = 'CS311L';
  SELECT id INTO fac_id FROM faculty WHERE code = 'CSE-F001'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);
  SELECT id INTO fac_id FROM faculty WHERE code = 'CSE-F005'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);

  SELECT id INTO subj_id FROM subjects WHERE code = 'CS312L';
  SELECT id INTO fac_id FROM faculty WHERE code = 'CSE-F002'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);
  SELECT id INTO fac_id FROM faculty WHERE code = 'CSE-F004'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);

  SELECT id INTO subj_id FROM subjects WHERE code = 'CS313L';
  SELECT id INTO fac_id FROM faculty WHERE code = 'CSE-F003'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);
  SELECT id INTO fac_id FROM faculty WHERE code = 'CSE-F006'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);

  SELECT id INTO subj_id FROM subjects WHERE code = 'CS314L';
  SELECT id INTO fac_id FROM faculty WHERE code = 'CSE-F005'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);

  SELECT id INTO subj_id FROM subjects WHERE code = 'IT311L';
  SELECT id INTO fac_id FROM faculty WHERE code = 'IT-F001'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);
  SELECT id INTO fac_id FROM faculty WHERE code = 'IT-F003'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);

  SELECT id INTO subj_id FROM subjects WHERE code = 'IT312L';
  SELECT id INTO fac_id FROM faculty WHERE code = 'IT-F002'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);
  SELECT id INTO fac_id FROM faculty WHERE code = 'IT-F004'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);

  SELECT id INTO subj_id FROM subjects WHERE code = 'EC311L';
  SELECT id INTO fac_id FROM faculty WHERE code = 'ECE-F001'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);
  SELECT id INTO fac_id FROM faculty WHERE code = 'ECE-F005'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);

  SELECT id INTO subj_id FROM subjects WHERE code = 'EC312L';
  SELECT id INTO fac_id FROM faculty WHERE code = 'ECE-F002'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);
  SELECT id INTO fac_id FROM faculty WHERE code = 'ECE-F006'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);

  SELECT id INTO subj_id FROM subjects WHERE code = 'EC313L';
  SELECT id INTO fac_id FROM faculty WHERE code = 'ECE-F003'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);
  SELECT id INTO fac_id FROM faculty WHERE code = 'ECE-F005'; INSERT INTO subject_faculty (id, subject_id, faculty_id) VALUES (gen_random_uuid(), subj_id, fac_id);
END $$;

-- =============================================
-- FACULTY AVAILABILITY (all faculty available Mon-Fri, periods 1-8)
-- =============================================
DO $$
DECLARE
  fac RECORD;
  d INT;
BEGIN
  FOR fac IN SELECT id, code FROM faculty LOOP
    FOR d IN 0..4 LOOP  -- Monday(0) to Friday(4)
      INSERT INTO faculty_availability (id, faculty_id, day_of_week, start_period, end_period)
      VALUES (gen_random_uuid(), fac.id, d, 1, 8);
    END LOOP;
    -- Saturday morning only
    INSERT INTO faculty_availability (id, faculty_id, day_of_week, start_period, end_period)
    VALUES (gen_random_uuid(), fac.id, 5, 1, 4);
  END LOOP;
END $$;

-- =============================================
-- SECTIONS (20 sections across 3 departments, 4 year levels)
-- =============================================
DO $$
DECLARE
  cse_dept_id UUID; it_dept_id UUID; ece_dept_id UUID;
  sec_prefix TEXT; sec_year INT; sec_name TEXT;
  d INT;
BEGIN
  SELECT id INTO cse_dept_id FROM departments WHERE code = 'CSE';
  SELECT id INTO it_dept_id  FROM departments WHERE code = 'IT';
  SELECT id INTO ece_dept_id FROM departments WHERE code = 'ECE';

  -- CSE Sections (8): 1A,1B,2A,2B,3A,3B,4A,4B
  sec_prefix := 'CSE'; sec_year := 1;
  INSERT INTO sections (id, name, year_level, student_count, department_id) VALUES (gen_random_uuid(), sec_prefix || '-' || sec_year || 'A', sec_year, 60, cse_dept_id);
  INSERT INTO sections (id, name, year_level, student_count, department_id) VALUES (gen_random_uuid(), sec_prefix || '-' || sec_year || 'B', sec_year, 58, cse_dept_id);
  sec_year := 2;
  INSERT INTO sections (id, name, year_level, student_count, department_id) VALUES (gen_random_uuid(), sec_prefix || '-' || sec_year || 'A', sec_year, 62, cse_dept_id);
  INSERT INTO sections (id, name, year_level, student_count, department_id) VALUES (gen_random_uuid(), sec_prefix || '-' || sec_year || 'B', sec_year, 60, cse_dept_id);
  sec_year := 3;
  INSERT INTO sections (id, name, year_level, student_count, department_id) VALUES (gen_random_uuid(), sec_prefix || '-' || sec_year || 'A', sec_year, 55, cse_dept_id);
  INSERT INTO sections (id, name, year_level, student_count, department_id) VALUES (gen_random_uuid(), sec_prefix || '-' || sec_year || 'B', sec_year, 58, cse_dept_id);
  sec_year := 4;
  INSERT INTO sections (id, name, year_level, student_count, department_id) VALUES (gen_random_uuid(), sec_prefix || '-' || sec_year || 'A', sec_year, 50, cse_dept_id);
  INSERT INTO sections (id, name, year_level, student_count, department_id) VALUES (gen_random_uuid(), sec_prefix || '-' || sec_year || 'B', sec_year, 48, cse_dept_id);

  -- IT Sections (8)
  sec_prefix := 'IT'; sec_year := 1;
  INSERT INTO sections (id, name, year_level, student_count, department_id) VALUES (gen_random_uuid(), sec_prefix || '-' || sec_year || 'A', sec_year, 60, it_dept_id);
  INSERT INTO sections (id, name, year_level, student_count, department_id) VALUES (gen_random_uuid(), sec_prefix || '-' || sec_year || 'B', sec_year, 58, it_dept_id);
  sec_year := 2;
  INSERT INTO sections (id, name, year_level, student_count, department_id) VALUES (gen_random_uuid(), sec_prefix || '-' || sec_year || 'A', sec_year, 60, it_dept_id);
  INSERT INTO sections (id, name, year_level, student_count, department_id) VALUES (gen_random_uuid(), sec_prefix || '-' || sec_year || 'B', sec_year, 55, it_dept_id);
  sec_year := 3;
  INSERT INTO sections (id, name, year_level, student_count, department_id) VALUES (gen_random_uuid(), sec_prefix || '-' || sec_year || 'A', sec_year, 55, it_dept_id);
  INSERT INTO sections (id, name, year_level, student_count, department_id) VALUES (gen_random_uuid(), sec_prefix || '-' || sec_year || 'B', sec_year, 50, it_dept_id);
  sec_year := 4;
  INSERT INTO sections (id, name, year_level, student_count, department_id) VALUES (gen_random_uuid(), sec_prefix || '-' || sec_year || 'A', sec_year, 48, it_dept_id);
  INSERT INTO sections (id, name, year_level, student_count, department_id) VALUES (gen_random_uuid(), sec_prefix || '-' || sec_year || 'B', sec_year, 45, it_dept_id);

  -- ECE Sections (4)
  sec_prefix := 'ECE';
  INSERT INTO sections (id, name, year_level, student_count, department_id) VALUES (gen_random_uuid(), sec_prefix || '-' || '1' || 'A', 1, 55, ece_dept_id);
  INSERT INTO sections (id, name, year_level, student_count, department_id) VALUES (gen_random_uuid(), sec_prefix || '-' || '2' || 'A', 2, 55, ece_dept_id);
  INSERT INTO sections (id, name, year_level, student_count, department_id) VALUES (gen_random_uuid(), sec_prefix || '-' || '3' || 'A', 3, 50, ece_dept_id);
  INSERT INTO sections (id, name, year_level, student_count, department_id) VALUES (gen_random_uuid(), sec_prefix || '-' || '4' || 'A', 4, 48, ece_dept_id);
END $$;

-- =============================================
-- SECTION-SUBJECT MAPPINGS
-- Each section: 5 theory subjects + 3 lab subjects
-- Theory is unique per section, labs are shared
-- =============================================
DO $$
DECLARE
  sec RECORD;
  fac RECORD;
  theory_subjs RECORD;
  lab_subjs RECORD;
  theory_count INT;
  lab_count INT;
  chosen_subj_id UUID;
  chosen_fac_id UUID;
BEGIN
  FOR sec IN SELECT id, name, department_id, year_level FROM sections ORDER BY name LOOP
    -- Assign 5 theory subjects
    theory_count := 0;
    FOR theory_subjs IN
      SELECT DISTINCT ON (s.id) s.id AS subj_id, sf.faculty_id
      FROM subjects s
      JOIN subject_faculty sf ON sf.subject_id = s.id
      WHERE s.subject_type = 'theory'
        AND s.department_id = sec.department_id
      ORDER BY s.id, sf.created_at
    LOOP
      IF theory_count >= 5 THEN EXIT; END IF;
      INSERT INTO section_subjects (id, section_id, subject_id, faculty_id)
      VALUES (gen_random_uuid(), sec.id, theory_subjs.subj_id, theory_subjs.faculty_id)
      ON CONFLICT (section_id, subject_id) DO NOTHING;
      theory_count := theory_count + 1;
    END LOOP;

    -- Assign 3 lab subjects
    lab_count := 0;
    FOR lab_subjs IN
      SELECT DISTINCT ON (s.id) s.id AS subj_id, sf.faculty_id
      FROM subjects s
      JOIN subject_faculty sf ON sf.subject_id = s.id
      WHERE s.subject_type = 'lab'
        AND s.department_id = sec.department_id
      ORDER BY s.id, sf.created_at
    LOOP
      IF lab_count >= 3 THEN EXIT; END IF;
      INSERT INTO section_subjects (id, section_id, subject_id, faculty_id)
      VALUES (gen_random_uuid(), sec.id, lab_subjs.subj_id, lab_subjs.faculty_id)
      ON CONFLICT (section_id, subject_id) DO NOTHING;
      lab_count := lab_count + 1;
    END LOOP;
  END LOOP;
END $$;

-- =============================================
-- VERIFICATION QUERIES
-- =============================================
SELECT 'Sections' AS entity, COUNT(*) AS count FROM sections
UNION ALL
SELECT 'Subjects', COUNT(*) FROM subjects
UNION ALL
SELECT 'Theory Subjects', COUNT(*) FROM subjects WHERE subject_type = 'theory'
UNION ALL
SELECT 'Lab Subjects', COUNT(*) FROM subjects WHERE subject_type = 'lab'
UNION ALL
SELECT 'Faculty', COUNT(*) FROM faculty
UNION ALL
SELECT 'Classrooms', COUNT(*) FROM classrooms
UNION ALL
SELECT 'Theory Rooms', COUNT(*) FROM classrooms WHERE room_type = 'theory'
UNION ALL
SELECT 'Lab Rooms', COUNT(*) FROM classrooms WHERE room_type = 'lab'
UNION ALL
SELECT 'Section-Subject Mappings', COUNT(*) FROM section_subjects
UNION ALL
SELECT 'Subject-Faculty Mappings', COUNT(*) FROM subject_faculty
UNION ALL
SELECT 'Faculty Availability Slots', COUNT(*) FROM faculty_availability;

-- Check per-section subject counts
SELECT s.name AS section, s.year_level, d.code AS dept,
  COUNT(ss.id) AS total_subjects,
  COUNT(CASE WHEN sub.subject_type = 'theory' THEN 1 END) AS theory_count,
  COUNT(CASE WHEN sub.subject_type = 'lab' THEN 1 END) AS lab_count
FROM sections s
JOIN section_subjects ss ON ss.section_id = s.id
JOIN subjects sub ON sub.id = ss.subject_id
JOIN departments d ON d.id = s.department_id
GROUP BY s.id, s.name, s.year_level, d.code
ORDER BY d.code, s.year_level, s.name;

-- =============================================
-- SET OWNERSHIP
-- =============================================
UPDATE departments SET created_by = '11111111-1111-1111-1111-111111111111' WHERE created_by IS NULL;
UPDATE classrooms SET created_by = '11111111-1111-1111-1111-111111111111' WHERE created_by IS NULL;
UPDATE subjects SET created_by = '11111111-1111-1111-1111-111111111111' WHERE created_by IS NULL;
UPDATE faculty SET created_by = '11111111-1111-1111-1111-111111111111' WHERE created_by IS NULL;
UPDATE sections SET created_by = '11111111-1111-1111-1111-111111111111' WHERE created_by IS NULL;
UPDATE timetable_jobs SET created_by = '11111111-1111-1111-1111-111111111111' WHERE created_by IS NULL;

COMMIT;
