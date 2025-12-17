-- Comprehensive seed data for timetable scheduling system
-- This script populates realistic sample data for testing
-- Faculty, Subjects, Classrooms, Sections with assignments

-- ==================== DEPARTMENTS ====================
-- (Already created, just ensure they exist)
INSERT INTO departments (name, code) VALUES
  ('Computer Science', 'CSE'),
  ('Electronics', 'ECE'),
  ('Mechanical', 'MECH'),
  ('Civil', 'CIVIL')
ON CONFLICT (code) DO NOTHING;

-- Get department IDs for reference
WITH dept_ids AS (
  SELECT id, code FROM departments
)

-- ==================== CLASSROOMS ====================
-- Increased capacities to accommodate all sections comfortably
INSERT INTO classrooms (name, capacity, room_type, building, floor) VALUES
  -- Theory Classrooms (Building A) - Large capacity for theory classes
  ('A-101', 70, 'theory', 'Building A', 1),
  ('A-102', 60, 'theory', 'Building A', 1),
  ('A-103', 55, 'theory', 'Building A', 1),
  ('A-201', 70, 'theory', 'Building A', 2),
  ('A-202', 60, 'theory', 'Building A', 2),
  ('A-301', 50, 'theory', 'Building A', 3),
  ('A-302', 65, 'theory', 'Building A', 3),
  
  -- Theory Classrooms (Building B) - Additional capacity
  ('B-101', 75, 'theory', 'Building B', 1),
  ('B-102', 65, 'theory', 'Building B', 1),
  ('B-201', 60, 'theory', 'Building B', 2),
  ('B-202', 55, 'theory', 'Building B', 2),
  
  -- Lab Classrooms (Building C) - Adequate for all lab sections
  ('C-LAB-01', 50, 'lab', 'Building C', 1),
  ('C-LAB-02', 50, 'lab', 'Building C', 1),
  ('C-LAB-03', 45, 'lab', 'Building C', 2),
  ('C-LAB-04', 45, 'lab', 'Building C', 2),
  
  -- Lab Classrooms (Building D) - High capacity labs
  ('D-LAB-01', 60, 'lab', 'Building D', 1),
  ('D-LAB-02', 55, 'lab', 'Building D', 1),
  ('D-LAB-03', 50, 'lab', 'Building D', 2)
ON CONFLICT (name) DO NOTHING;

-- ==================== FACULTY - COMPUTER SCIENCE ====================
INSERT INTO faculty (code, name, email, department_id, phone) VALUES
  -- CSE Faculty
  ('CSE-F001', 'Dr. Rajesh Kumar', 'rajesh.kumar@university.edu', 
   (SELECT id FROM departments WHERE code = 'CSE'), '9876543210'),
  ('CSE-F002', 'Prof. Priya Sharma', 'priya.sharma@university.edu', 
   (SELECT id FROM departments WHERE code = 'CSE'), '9876543211'),
  ('CSE-F003', 'Dr. Amit Patel', 'amit.patel@university.edu', 
   (SELECT id FROM departments WHERE code = 'CSE'), '9876543212'),
  ('CSE-F004', 'Dr. Sneha Desai', 'sneha.desai@university.edu', 
   (SELECT id FROM departments WHERE code = 'CSE'), '9876543213'),
  ('CSE-F005', 'Prof. Vikram Singh', 'vikram.singh@university.edu', 
   (SELECT id FROM departments WHERE code = 'CSE'), '9876543214'),
  ('CSE-F006', 'Dr. Neha Gupta', 'neha.gupta@university.edu', 
   (SELECT id FROM departments WHERE code = 'CSE'), '9876543215'),
  
  -- ECE Faculty
  ('ECE-F001', 'Dr. Arun Verma', 'arun.verma@university.edu', 
   (SELECT id FROM departments WHERE code = 'ECE'), '9876543220'),
  ('ECE-F002', 'Prof. Meera Singh', 'meera.singh@university.edu', 
   (SELECT id FROM departments WHERE code = 'ECE'), '9876543221'),
  ('ECE-F003', 'Dr. Suresh Rao', 'suresh.rao@university.edu', 
   (SELECT id FROM departments WHERE code = 'ECE'), '9876543222'),
  ('ECE-F004', 'Prof. Divya Kapoor', 'divya.kapoor@university.edu', 
   (SELECT id FROM departments WHERE code = 'ECE'), '9876543223'),
  
  -- MECH Faculty
  ('MECH-F001', 'Dr. Harish Nair', 'harish.nair@university.edu', 
   (SELECT id FROM departments WHERE code = 'MECH'), '9876543230'),
  ('MECH-F002', 'Prof. Pooja Desai', 'pooja.desai@university.edu', 
   (SELECT id FROM departments WHERE code = 'MECH'), '9876543231'),
  ('MECH-F003', 'Dr. Ravi Kumar', 'ravi.kumar@university.edu', 
   (SELECT id FROM departments WHERE code = 'MECH'), '9876543232'),
  
  -- CIVIL Faculty
  ('CIVIL-F001', 'Dr. Bhavna Singh', 'bhavna.singh@university.edu', 
   (SELECT id FROM departments WHERE code = 'CIVIL'), '9876543240'),
  ('CIVIL-F002', 'Prof. Akshay Rao', 'akshay.rao@university.edu', 
   (SELECT id FROM departments WHERE code = 'CIVIL'), '9876543241')
ON CONFLICT (code) DO NOTHING;

-- ==================== FACULTY AVAILABILITY ====================
-- Define teaching time slots for faculty (Monday=0 to Saturday=5)
-- Period 1-8 represent different time slots in a day
-- Patterns: Most faculty available Mon-Fri, some on Saturday, with varying period preferences

-- CSE-F001: Rajesh Kumar - Available Mon-Wed periods 1-5, Thu-Fri periods 2-6
INSERT INTO faculty_availability (faculty_id, day_of_week, start_period, end_period) VALUES
  ((SELECT id FROM faculty WHERE code = 'CSE-F001'), 0, 1, 5),  -- Monday
  ((SELECT id FROM faculty WHERE code = 'CSE-F001'), 1, 1, 5),  -- Tuesday
  ((SELECT id FROM faculty WHERE code = 'CSE-F001'), 2, 1, 5),  -- Wednesday
  ((SELECT id FROM faculty WHERE code = 'CSE-F001'), 3, 2, 6),  -- Thursday
  ((SELECT id FROM faculty WHERE code = 'CSE-F001'), 4, 2, 6);  -- Friday

-- CSE-F002: Priya Sharma - Available Mon-Fri all periods, Sat 1-4
INSERT INTO faculty_availability (faculty_id, day_of_week, start_period, end_period) VALUES
  ((SELECT id FROM faculty WHERE code = 'CSE-F002'), 0, 1, 8),  -- Monday
  ((SELECT id FROM faculty WHERE code = 'CSE-F002'), 1, 1, 8),  -- Tuesday
  ((SELECT id FROM faculty WHERE code = 'CSE-F002'), 2, 1, 8),  -- Wednesday
  ((SELECT id FROM faculty WHERE code = 'CSE-F002'), 3, 1, 8),  -- Thursday
  ((SELECT id FROM faculty WHERE code = 'CSE-F002'), 4, 1, 8),  -- Friday
  ((SELECT id FROM faculty WHERE code = 'CSE-F002'), 5, 1, 4);  -- Saturday

-- CSE-F003: Amit Patel - Available periods 3-8 on weekdays
INSERT INTO faculty_availability (faculty_id, day_of_week, start_period, end_period) VALUES
  ((SELECT id FROM faculty WHERE code = 'CSE-F003'), 0, 3, 8),  -- Monday
  ((SELECT id FROM faculty WHERE code = 'CSE-F003'), 1, 3, 8),  -- Tuesday
  ((SELECT id FROM faculty WHERE code = 'CSE-F003'), 2, 3, 8),  -- Wednesday
  ((SELECT id FROM faculty WHERE code = 'CSE-F003'), 3, 3, 8),  -- Thursday
  ((SELECT id FROM faculty WHERE code = 'CSE-F003'), 4, 3, 8);  -- Friday

-- CSE-F004: Sneha Desai - Limited availability
INSERT INTO faculty_availability (faculty_id, day_of_week, start_period, end_period) VALUES
  ((SELECT id FROM faculty WHERE code = 'CSE-F004'), 0, 1, 4),  -- Monday
  ((SELECT id FROM faculty WHERE code = 'CSE-F004'), 2, 2, 6),  -- Wednesday
  ((SELECT id FROM faculty WHERE code = 'CSE-F004'), 4, 1, 5);  -- Friday

-- CSE-F005: Vikram Singh - Expanded availability for lab sections
INSERT INTO faculty_availability (faculty_id, day_of_week, start_period, end_period) VALUES
  ((SELECT id FROM faculty WHERE code = 'CSE-F005'), 0, 1, 8),  -- Monday
  ((SELECT id FROM faculty WHERE code = 'CSE-F005'), 1, 1, 8),  -- Tuesday
  ((SELECT id FROM faculty WHERE code = 'CSE-F005'), 2, 1, 8),  -- Wednesday
  ((SELECT id FROM faculty WHERE code = 'CSE-F005'), 3, 1, 8),  -- Thursday
  ((SELECT id FROM faculty WHERE code = 'CSE-F005'), 4, 1, 8);  -- Friday

-- CSE-F006: Neha Gupta - Available Mon, Tue, Thu, Fri
INSERT INTO faculty_availability (faculty_id, day_of_week, start_period, end_period) VALUES
  ((SELECT id FROM faculty WHERE code = 'CSE-F006'), 0, 1, 6),  -- Monday
  ((SELECT id FROM faculty WHERE code = 'CSE-F006'), 1, 2, 8),  -- Tuesday
  ((SELECT id FROM faculty WHERE code = 'CSE-F006'), 3, 1, 7),  -- Thursday
  ((SELECT id FROM faculty WHERE code = 'CSE-F006'), 4, 2, 6);  -- Friday

-- ECE-F001: Arun Verma - Full week availability
INSERT INTO faculty_availability (faculty_id, day_of_week, start_period, end_period) VALUES
  ((SELECT id FROM faculty WHERE code = 'ECE-F001'), 0, 1, 8),  -- Monday
  ((SELECT id FROM faculty WHERE code = 'ECE-F001'), 1, 1, 8),  -- Tuesday
  ((SELECT id FROM faculty WHERE code = 'ECE-F001'), 2, 1, 8),  -- Wednesday
  ((SELECT id FROM faculty WHERE code = 'ECE-F001'), 3, 1, 8),  -- Thursday
  ((SELECT id FROM faculty WHERE code = 'ECE-F001'), 4, 1, 8);  -- Friday

-- ECE-F002: Meera Singh - Mon, Wed, Fri availability
INSERT INTO faculty_availability (faculty_id, day_of_week, start_period, end_period) VALUES
  ((SELECT id FROM faculty WHERE code = 'ECE-F002'), 0, 2, 7),  -- Monday
  ((SELECT id FROM faculty WHERE code = 'ECE-F002'), 2, 1, 6),  -- Wednesday
  ((SELECT id FROM faculty WHERE code = 'ECE-F002'), 4, 2, 8);  -- Friday

-- ECE-F003: Suresh Rao - Tue-Sat availability
INSERT INTO faculty_availability (faculty_id, day_of_week, start_period, end_period) VALUES
  ((SELECT id FROM faculty WHERE code = 'ECE-F003'), 1, 1, 8),  -- Tuesday
  ((SELECT id FROM faculty WHERE code = 'ECE-F003'), 2, 1, 8),  -- Wednesday
  ((SELECT id FROM faculty WHERE code = 'ECE-F003'), 3, 1, 8),  -- Thursday
  ((SELECT id FROM faculty WHERE code = 'ECE-F003'), 4, 1, 8),  -- Friday
  ((SELECT id FROM faculty WHERE code = 'ECE-F003'), 5, 1, 5);  -- Saturday

-- ECE-F004: Divya Kapoor - Morning slots only
INSERT INTO faculty_availability (faculty_id, day_of_week, start_period, end_period) VALUES
  ((SELECT id FROM faculty WHERE code = 'ECE-F004'), 0, 1, 4),  -- Monday
  ((SELECT id FROM faculty WHERE code = 'ECE-F004'), 1, 1, 4),  -- Tuesday
  ((SELECT id FROM faculty WHERE code = 'ECE-F004'), 2, 1, 4),  -- Wednesday
  ((SELECT id FROM faculty WHERE code = 'ECE-F004'), 3, 1, 4),  -- Thursday
  ((SELECT id FROM faculty WHERE code = 'ECE-F004'), 4, 1, 4);  -- Friday

-- MECH-F001: Harish Nair - Full availability
INSERT INTO faculty_availability (faculty_id, day_of_week, start_period, end_period) VALUES
  ((SELECT id FROM faculty WHERE code = 'MECH-F001'), 0, 1, 8),  -- Monday
  ((SELECT id FROM faculty WHERE code = 'MECH-F001'), 1, 1, 8),  -- Tuesday
  ((SELECT id FROM faculty WHERE code = 'MECH-F001'), 2, 1, 8),  -- Wednesday
  ((SELECT id FROM faculty WHERE code = 'MECH-F001'), 3, 1, 8),  -- Thursday
  ((SELECT id FROM faculty WHERE code = 'MECH-F001'), 4, 1, 8);  -- Friday

-- MECH-F002: Pooja Desai - Mon, Wed, Thu, Sat
INSERT INTO faculty_availability (faculty_id, day_of_week, start_period, end_period) VALUES
  ((SELECT id FROM faculty WHERE code = 'MECH-F002'), 0, 2, 7),  -- Monday
  ((SELECT id FROM faculty WHERE code = 'MECH-F002'), 2, 2, 7),  -- Wednesday
  ((SELECT id FROM faculty WHERE code = 'MECH-F002'), 3, 1, 6),  -- Thursday
  ((SELECT id FROM faculty WHERE code = 'MECH-F002'), 5, 2, 5);  -- Saturday

-- MECH-F003: Ravi Kumar - Expanded availability for lab sections
INSERT INTO faculty_availability (faculty_id, day_of_week, start_period, end_period) VALUES
  ((SELECT id FROM faculty WHERE code = 'MECH-F003'), 0, 1, 8),  -- Monday
  ((SELECT id FROM faculty WHERE code = 'MECH-F003'), 1, 1, 8),  -- Tuesday
  ((SELECT id FROM faculty WHERE code = 'MECH-F003'), 2, 1, 8),  -- Wednesday
  ((SELECT id FROM faculty WHERE code = 'MECH-F003'), 3, 1, 8),  -- Thursday
  ((SELECT id FROM faculty WHERE code = 'MECH-F003'), 4, 1, 8),  -- Friday
  ((SELECT id FROM faculty WHERE code = 'MECH-F003'), 5, 1, 5);  -- Saturday

-- CIVIL-F001: Bhavna Singh - Full availability
INSERT INTO faculty_availability (faculty_id, day_of_week, start_period, end_period) VALUES
  ((SELECT id FROM faculty WHERE code = 'CIVIL-F001'), 0, 1, 8),  -- Monday
  ((SELECT id FROM faculty WHERE code = 'CIVIL-F001'), 1, 1, 8),  -- Tuesday
  ((SELECT id FROM faculty WHERE code = 'CIVIL-F001'), 2, 1, 8),  -- Wednesday
  ((SELECT id FROM faculty WHERE code = 'CIVIL-F001'), 3, 1, 8),  -- Thursday
  ((SELECT id FROM faculty WHERE code = 'CIVIL-F001'), 4, 1, 8);  -- Friday

-- CIVIL-F002: Akshay Rao - Limited mid-week slots
INSERT INTO faculty_availability (faculty_id, day_of_week, start_period, end_period) VALUES
  ((SELECT id FROM faculty WHERE code = 'CIVIL-F002'), 1, 2, 7),  -- Tuesday
  ((SELECT id FROM faculty WHERE code = 'CIVIL-F002'), 2, 1, 6),  -- Wednesday
  ((SELECT id FROM faculty WHERE code = 'CIVIL-F002'), 3, 2, 7),  -- Thursday
  ((SELECT id FROM faculty WHERE code = 'CIVIL-F002'), 5, 1, 4);  -- Saturday

-- ==================== SUBJECTS - COMPUTER SCIENCE ====================
INSERT INTO subjects (name, code, subject_type, periods_per_week, department_id) VALUES
  ('Data Structures', 'CS-101', 'theory', 3, (SELECT id FROM departments WHERE code = 'CSE')),
  ('Data Structures Lab', 'CS-101L', 'lab', 2, (SELECT id FROM departments WHERE code = 'CSE')),
  ('Web Development', 'CS-201', 'theory', 3, (SELECT id FROM departments WHERE code = 'CSE')),
  ('Web Development Lab', 'CS-201L', 'lab', 2, (SELECT id FROM departments WHERE code = 'CSE')),
  ('Database Management', 'CS-301', 'theory', 3, (SELECT id FROM departments WHERE code = 'CSE')),
  ('Database Lab', 'CS-301L', 'lab', 2, (SELECT id FROM departments WHERE code = 'CSE')),
  ('Artificial Intelligence', 'CS-401', 'theory', 3, (SELECT id FROM departments WHERE code = 'CSE')),
  ('Machine Learning', 'CS-402', 'theory', 3, (SELECT id FROM departments WHERE code = 'CSE')),
  ('Cloud Computing', 'CS-501', 'theory', 3, (SELECT id FROM departments WHERE code = 'CSE')),
  ('Cloud Computing Lab', 'CS-501L', 'lab', 2, (SELECT id FROM departments WHERE code = 'CSE')),
  
  -- ECE Subjects
  ('Circuit Theory', 'EC-101', 'theory', 3, (SELECT id FROM departments WHERE code = 'ECE')),
  ('Circuit Lab', 'EC-101L', 'lab', 2, (SELECT id FROM departments WHERE code = 'ECE')),
  ('Digital Electronics', 'EC-201', 'theory', 3, (SELECT id FROM departments WHERE code = 'ECE')),
  ('Digital Electronics Lab', 'EC-201L', 'lab', 2, (SELECT id FROM departments WHERE code = 'ECE')),
  ('Microprocessors', 'EC-301', 'theory', 3, (SELECT id FROM departments WHERE code = 'ECE')),
  ('Microprocessor Lab', 'EC-301L', 'lab', 2, (SELECT id FROM departments WHERE code = 'ECE')),
  
  -- MECH Subjects
  ('Thermodynamics', 'ME-101', 'theory', 3, (SELECT id FROM departments WHERE code = 'MECH')),
  ('Mechanics', 'ME-201', 'theory', 3, (SELECT id FROM departments WHERE code = 'MECH')),
  ('Mechanics Lab', 'ME-201L', 'lab', 2, (SELECT id FROM departments WHERE code = 'MECH')),
  ('CAD Design', 'ME-301', 'theory', 2, (SELECT id FROM departments WHERE code = 'MECH')),
  ('CAD Lab', 'ME-301L', 'lab', 3, (SELECT id FROM departments WHERE code = 'MECH')),
  
  -- CIVIL Subjects
  ('Structural Analysis', 'CE-101', 'theory', 3, (SELECT id FROM departments WHERE code = 'CIVIL')),
  ('Structural Design', 'CE-201', 'theory', 3, (SELECT id FROM departments WHERE code = 'CIVIL')),
  ('Geotechnics', 'CE-301', 'theory', 3, (SELECT id FROM departments WHERE code = 'CIVIL')),
  ('Geotechnics Lab', 'CE-301L', 'lab', 2, (SELECT id FROM departments WHERE code = 'CIVIL'))
ON CONFLICT (code) DO NOTHING;

-- ==================== SUBJECT-FACULTY ASSIGNMENTS ====================
-- CSE Subjects assigned to CSE Faculty
INSERT INTO subject_faculty (subject_id, faculty_id) VALUES
  ((SELECT id FROM subjects WHERE code = 'CS-101'), (SELECT id FROM faculty WHERE code = 'CSE-F001')),
  ((SELECT id FROM subjects WHERE code = 'CS-101L'), (SELECT id FROM faculty WHERE code = 'CSE-F002')),
  ((SELECT id FROM subjects WHERE code = 'CS-201'), (SELECT id FROM faculty WHERE code = 'CSE-F003')),
  ((SELECT id FROM subjects WHERE code = 'CS-201L'), (SELECT id FROM faculty WHERE code = 'CSE-F004')),
  ((SELECT id FROM subjects WHERE code = 'CS-301'), (SELECT id FROM faculty WHERE code = 'CSE-F001')),
  ((SELECT id FROM subjects WHERE code = 'CS-301L'), (SELECT id FROM faculty WHERE code = 'CSE-F005')),
  ((SELECT id FROM subjects WHERE code = 'CS-401'), (SELECT id FROM faculty WHERE code = 'CSE-F002')),
  ((SELECT id FROM subjects WHERE code = 'CS-402'), (SELECT id FROM faculty WHERE code = 'CSE-F006')),
  ((SELECT id FROM subjects WHERE code = 'CS-501'), (SELECT id FROM faculty WHERE code = 'CSE-F003')),
  ((SELECT id FROM subjects WHERE code = 'CS-501L'), (SELECT id FROM faculty WHERE code = 'CSE-F004')),
  
  -- ECE Subjects assigned to ECE Faculty
  ((SELECT id FROM subjects WHERE code = 'EC-101'), (SELECT id FROM faculty WHERE code = 'ECE-F001')),
  ((SELECT id FROM subjects WHERE code = 'EC-101L'), (SELECT id FROM faculty WHERE code = 'ECE-F002')),
  ((SELECT id FROM subjects WHERE code = 'EC-201'), (SELECT id FROM faculty WHERE code = 'ECE-F001')),
  ((SELECT id FROM subjects WHERE code = 'EC-201L'), (SELECT id FROM faculty WHERE code = 'ECE-F003')),
  ((SELECT id FROM subjects WHERE code = 'EC-301'), (SELECT id FROM faculty WHERE code = 'ECE-F004')),
  ((SELECT id FROM subjects WHERE code = 'EC-301L'), (SELECT id FROM faculty WHERE code = 'ECE-F002')),
  
  -- MECH Subjects assigned to MECH Faculty
  ((SELECT id FROM subjects WHERE code = 'ME-101'), (SELECT id FROM faculty WHERE code = 'MECH-F001')),
  ((SELECT id FROM subjects WHERE code = 'ME-201'), (SELECT id FROM faculty WHERE code = 'MECH-F002')),
  ((SELECT id FROM subjects WHERE code = 'ME-201L'), (SELECT id FROM faculty WHERE code = 'MECH-F003')),
  ((SELECT id FROM subjects WHERE code = 'ME-301'), (SELECT id FROM faculty WHERE code = 'MECH-F001')),
  ((SELECT id FROM subjects WHERE code = 'ME-301L'), (SELECT id FROM faculty WHERE code = 'MECH-F002')),
  
  -- CIVIL Subjects assigned to CIVIL Faculty
  ((SELECT id FROM subjects WHERE code = 'CE-101'), (SELECT id FROM faculty WHERE code = 'CIVIL-F001')),
  ((SELECT id FROM subjects WHERE code = 'CE-201'), (SELECT id FROM faculty WHERE code = 'CIVIL-F002')),
  ((SELECT id FROM subjects WHERE code = 'CE-301'), (SELECT id FROM faculty WHERE code = 'CIVIL-F001')),
  ((SELECT id FROM subjects WHERE code = 'CE-301L'), (SELECT id FROM faculty WHERE code = 'CIVIL-F002'))
ON CONFLICT (subject_id, faculty_id) DO NOTHING;

-- ==================== SECTIONS ====================
-- Adjusted student counts to fit within lab capacities (max 60)
-- Distribution ensures realistic spread without exceeding room capacity
INSERT INTO sections (name, year_level, student_count, department_id) VALUES
  -- CSE Sections - Reduced to fit largest labs (60 capacity)
  ('CSE-1A', 1, 48, (SELECT id FROM departments WHERE code = 'CSE')),
  ('CSE-1B', 1, 45, (SELECT id FROM departments WHERE code = 'CSE')),
  ('CSE-2A', 2, 42, (SELECT id FROM departments WHERE code = 'CSE')),
  ('CSE-2B', 2, 40, (SELECT id FROM departments WHERE code = 'CSE')),
  
  -- ECE Sections - Balanced for medium labs (45-50 capacity)
  ('ECE-1A', 1, 38, (SELECT id FROM departments WHERE code = 'ECE')),
  ('ECE-1B', 1, 36, (SELECT id FROM departments WHERE code = 'ECE')),
  ('ECE-2A', 2, 35, (SELECT id FROM departments WHERE code = 'ECE')),
  
  -- MECH Sections - Fit smaller labs (45-50 capacity)
  ('MECH-1A', 1, 44, (SELECT id FROM departments WHERE code = 'MECH')),
  ('MECH-1B', 1, 42, (SELECT id FROM departments WHERE code = 'MECH')),
  ('MECH-2A', 2, 40, (SELECT id FROM departments WHERE code = 'MECH')),
  
  -- CIVIL Sections - Fit various lab sizes (45-55 capacity)
  ('CIVIL-1A', 1, 46, (SELECT id FROM departments WHERE code = 'CIVIL')),
  ('CIVIL-1B', 1, 44, (SELECT id FROM departments WHERE code = 'CIVIL')),
  ('CIVIL-2A', 2, 42, (SELECT id FROM departments WHERE code = 'CIVIL'))
ON CONFLICT (name) DO NOTHING;

-- ==================== SECTION-SUBJECT ASSIGNMENTS ====================
-- CSE Section 1 (Year 1) subjects
INSERT INTO section_subjects (section_id, subject_id, faculty_id) VALUES
  -- CSE-1A Year 1
  ((SELECT id FROM sections WHERE name = 'CSE-1A'), 
   (SELECT id FROM subjects WHERE code = 'CS-101'), 
   (SELECT id FROM faculty WHERE code = 'CSE-F001')),
  ((SELECT id FROM sections WHERE name = 'CSE-1A'), 
   (SELECT id FROM subjects WHERE code = 'CS-101L'), 
   (SELECT id FROM faculty WHERE code = 'CSE-F002')),
  ((SELECT id FROM sections WHERE name = 'CSE-1A'), 
   (SELECT id FROM subjects WHERE code = 'CS-201'), 
   (SELECT id FROM faculty WHERE code = 'CSE-F003')),
  ((SELECT id FROM sections WHERE name = 'CSE-1A'), 
   (SELECT id FROM subjects WHERE code = 'CS-201L'), 
   (SELECT id FROM faculty WHERE code = 'CSE-F004')),
  
  -- CSE-1B Year 1
  ((SELECT id FROM sections WHERE name = 'CSE-1B'), 
   (SELECT id FROM subjects WHERE code = 'CS-101'), 
   (SELECT id FROM faculty WHERE code = 'CSE-F001')),
  ((SELECT id FROM sections WHERE name = 'CSE-1B'), 
   (SELECT id FROM subjects WHERE code = 'CS-101L'), 
   (SELECT id FROM faculty WHERE code = 'CSE-F002')),
  ((SELECT id FROM sections WHERE name = 'CSE-1B'), 
   (SELECT id FROM subjects WHERE code = 'CS-201'), 
   (SELECT id FROM faculty WHERE code = 'CSE-F005')),
  ((SELECT id FROM sections WHERE name = 'CSE-1B'), 
   (SELECT id FROM subjects WHERE code = 'CS-201L'), 
   (SELECT id FROM faculty WHERE code = 'CSE-F006')),
  
  -- CSE-2A Year 2
  ((SELECT id FROM sections WHERE name = 'CSE-2A'), 
   (SELECT id FROM subjects WHERE code = 'CS-301'), 
   (SELECT id FROM faculty WHERE code = 'CSE-F001')),
  ((SELECT id FROM sections WHERE name = 'CSE-2A'), 
   (SELECT id FROM subjects WHERE code = 'CS-301L'), 
   (SELECT id FROM faculty WHERE code = 'CSE-F005')),
  ((SELECT id FROM sections WHERE name = 'CSE-2A'), 
   (SELECT id FROM subjects WHERE code = 'CS-401'), 
   (SELECT id FROM faculty WHERE code = 'CSE-F002')),
  ((SELECT id FROM sections WHERE name = 'CSE-2A'), 
   (SELECT id FROM subjects WHERE code = 'CS-402'), 
   (SELECT id FROM faculty WHERE code = 'CSE-F006')),
  
  -- CSE-2B Year 2
  ((SELECT id FROM sections WHERE name = 'CSE-2B'), 
   (SELECT id FROM subjects WHERE code = 'CS-301'), 
   (SELECT id FROM faculty WHERE code = 'CSE-F003')),
  ((SELECT id FROM sections WHERE name = 'CSE-2B'), 
   (SELECT id FROM subjects WHERE code = 'CS-301L'), 
   (SELECT id FROM faculty WHERE code = 'CSE-F004')),
  ((SELECT id FROM sections WHERE name = 'CSE-2B'), 
   (SELECT id FROM subjects WHERE code = 'CS-501'), 
   (SELECT id FROM faculty WHERE code = 'CSE-F003')),
  ((SELECT id FROM sections WHERE name = 'CSE-2B'), 
   (SELECT id FROM subjects WHERE code = 'CS-501L'), 
   (SELECT id FROM faculty WHERE code = 'CSE-F004')),
  
  -- ECE-1A Year 1
  ((SELECT id FROM sections WHERE name = 'ECE-1A'), 
   (SELECT id FROM subjects WHERE code = 'EC-101'), 
   (SELECT id FROM faculty WHERE code = 'ECE-F001')),
  ((SELECT id FROM sections WHERE name = 'ECE-1A'), 
   (SELECT id FROM subjects WHERE code = 'EC-101L'), 
   (SELECT id FROM faculty WHERE code = 'ECE-F002')),
  ((SELECT id FROM sections WHERE name = 'ECE-1A'), 
   (SELECT id FROM subjects WHERE code = 'EC-201'), 
   (SELECT id FROM faculty WHERE code = 'ECE-F001')),
  ((SELECT id FROM sections WHERE name = 'ECE-1A'), 
   (SELECT id FROM subjects WHERE code = 'EC-201L'), 
   (SELECT id FROM faculty WHERE code = 'ECE-F003')),
  
  -- ECE-1B Year 1
  ((SELECT id FROM sections WHERE name = 'ECE-1B'), 
   (SELECT id FROM subjects WHERE code = 'EC-101'), 
   (SELECT id FROM faculty WHERE code = 'ECE-F001')),
  ((SELECT id FROM sections WHERE name = 'ECE-1B'), 
   (SELECT id FROM subjects WHERE code = 'EC-101L'), 
   (SELECT id FROM faculty WHERE code = 'ECE-F004')),
  ((SELECT id FROM sections WHERE name = 'ECE-1B'), 
   (SELECT id FROM subjects WHERE code = 'EC-201'), 
   (SELECT id FROM faculty WHERE code = 'ECE-F002')),
  ((SELECT id FROM sections WHERE name = 'ECE-1B'), 
   (SELECT id FROM subjects WHERE code = 'EC-201L'), 
   (SELECT id FROM faculty WHERE code = 'ECE-F003')),
  
  -- ECE-2A Year 2
  ((SELECT id FROM sections WHERE name = 'ECE-2A'), 
   (SELECT id FROM subjects WHERE code = 'EC-301'), 
   (SELECT id FROM faculty WHERE code = 'ECE-F004')),
  ((SELECT id FROM sections WHERE name = 'ECE-2A'), 
   (SELECT id FROM subjects WHERE code = 'EC-301L'), 
   (SELECT id FROM faculty WHERE code = 'ECE-F002')),
  
  -- MECH-1A Year 1
  ((SELECT id FROM sections WHERE name = 'MECH-1A'), 
   (SELECT id FROM subjects WHERE code = 'ME-101'), 
   (SELECT id FROM faculty WHERE code = 'MECH-F001')),
  ((SELECT id FROM sections WHERE name = 'MECH-1A'), 
   (SELECT id FROM subjects WHERE code = 'ME-201'), 
   (SELECT id FROM faculty WHERE code = 'MECH-F002')),
  ((SELECT id FROM sections WHERE name = 'MECH-1A'), 
   (SELECT id FROM subjects WHERE code = 'ME-201L'), 
   (SELECT id FROM faculty WHERE code = 'MECH-F003')),
  
  -- MECH-1B Year 1
  ((SELECT id FROM sections WHERE name = 'MECH-1B'), 
   (SELECT id FROM subjects WHERE code = 'ME-101'), 
   (SELECT id FROM faculty WHERE code = 'MECH-F001')),
  ((SELECT id FROM sections WHERE name = 'MECH-1B'), 
   (SELECT id FROM subjects WHERE code = 'ME-201'), 
   (SELECT id FROM faculty WHERE code = 'MECH-F002')),
  ((SELECT id FROM sections WHERE name = 'MECH-1B'), 
   (SELECT id FROM subjects WHERE code = 'ME-201L'), 
   (SELECT id FROM faculty WHERE code = 'MECH-F003')),
  
  -- MECH-2A Year 2
  ((SELECT id FROM sections WHERE name = 'MECH-2A'), 
   (SELECT id FROM subjects WHERE code = 'ME-301'), 
   (SELECT id FROM faculty WHERE code = 'MECH-F001')),
  ((SELECT id FROM sections WHERE name = 'MECH-2A'), 
   (SELECT id FROM subjects WHERE code = 'ME-301L'), 
   (SELECT id FROM faculty WHERE code = 'MECH-F002')),
  
  -- CIVIL-1A Year 1
  ((SELECT id FROM sections WHERE name = 'CIVIL-1A'), 
   (SELECT id FROM subjects WHERE code = 'CE-101'), 
   (SELECT id FROM faculty WHERE code = 'CIVIL-F001')),
  ((SELECT id FROM sections WHERE name = 'CIVIL-1A'), 
   (SELECT id FROM subjects WHERE code = 'CE-201'), 
   (SELECT id FROM faculty WHERE code = 'CIVIL-F002')),
  
  -- CIVIL-1B Year 1
  ((SELECT id FROM sections WHERE name = 'CIVIL-1B'), 
   (SELECT id FROM subjects WHERE code = 'CE-101'), 
   (SELECT id FROM faculty WHERE code = 'CIVIL-F001')),
  ((SELECT id FROM sections WHERE name = 'CIVIL-1B'), 
   (SELECT id FROM subjects WHERE code = 'CE-201'), 
   (SELECT id FROM faculty WHERE code = 'CIVIL-F002')),
  
  -- CIVIL-2A Year 2
  ((SELECT id FROM sections WHERE name = 'CIVIL-2A'), 
   (SELECT id FROM subjects WHERE code = 'CE-301'), 
   (SELECT id FROM faculty WHERE code = 'CIVIL-F001')),
  ((SELECT id FROM sections WHERE name = 'CIVIL-2A'), 
   (SELECT id FROM subjects WHERE code = 'CE-301L'), 
   (SELECT id FROM faculty WHERE code = 'CIVIL-F002'))
ON CONFLICT (section_id, subject_id) DO NOTHING;

-- ==================== SUMMARY ====================
-- This script seeds:
-- - 17 Classrooms (11 theory, 6 labs)
-- - 16 Faculty members with availability schedules
-- - 25 Subjects (theory and lab)
-- - 25 Subject-Faculty assignments
-- - 13 Sections across 4 departments
-- - 43 Section-Subject assignments
--
-- Ready for timetable generation testing!
