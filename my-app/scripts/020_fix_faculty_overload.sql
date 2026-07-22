-- =============================================
-- 020: FIX & REBALANCE - 24 sections, 7 theory + 3 lab each
-- Theory: 4 periods/week (2+2 split). Lab: 3 periods/week (consecutive)
-- Target: theory rooms 87.5%, lab blocks 75%, faculty 84%
-- =============================================
-- =============================================

BEGIN;

-- Fix theory periods: should be 3 per week per theory subject (was correct)
-- The problem is faculty assigned to 8 sections each teaching 2-3 subjects
-- Faculty max available: 5 days × 6 usable periods + Sat P1-4 = 34 theory slots
-- But labs take 24 slots (4 sections × 3 lab sessions × 2 faculty per lab)
-- So faculty have ~10-20 slots for theory, need 24-48

-- Step 1: CLEAR all section_subjects so Step 5 can rebuild from scratch with proper load balancing
DELETE FROM section_subjects;

-- Step 2: ADD BACKUP FACULTY (6 new faculty - 2 per department)
DO $$
DECLARE
  cse_id UUID; it_id UUID; ece_id UUID;
BEGIN
  SELECT id INTO cse_id FROM departments WHERE code = 'CSE';
  SELECT id INTO it_id  FROM departments WHERE code = 'IT';
  SELECT id INTO ece_id FROM departments WHERE code = 'ECE';

  -- Only insert if not already existing (and set created_by to the standard admin user)
  INSERT INTO faculty (id, code, name, email, department_id, phone, is_active, created_by)
  SELECT gen_random_uuid(), 'CSE-F007', 'Dr. Ramesh Kumar', 'ramesh@university.edu', cse_id, '9876540107', true, '11111111-1111-1111-1111-111111111111'::UUID
  WHERE NOT EXISTS (SELECT 1 FROM faculty WHERE code = 'CSE-F007');

  INSERT INTO faculty (id, code, name, email, department_id, phone, is_active, created_by)
  SELECT gen_random_uuid(), 'CSE-F008', 'Prof. Shalini Das', 'shalini@university.edu', cse_id, '9876540108', true, '11111111-1111-1111-1111-111111111111'::UUID
  WHERE NOT EXISTS (SELECT 1 FROM faculty WHERE code = 'CSE-F008');

  INSERT INTO faculty (id, code, name, email, department_id, phone, is_active, created_by)
  SELECT gen_random_uuid(), 'IT-F007',  'Dr. Ganesh Pillai', 'ganesh@university.edu', it_id, '9876540207', true, '11111111-1111-1111-1111-111111111111'::UUID
  WHERE NOT EXISTS (SELECT 1 FROM faculty WHERE code = 'IT-F007');

  INSERT INTO faculty (id, code, name, email, department_id, phone, is_active, created_by)
  SELECT gen_random_uuid(), 'IT-F008',  'Prof. Radha Menon', 'radha@university.edu', it_id, '9876540208', true, '11111111-1111-1111-1111-111111111111'::UUID
  WHERE NOT EXISTS (SELECT 1 FROM faculty WHERE code = 'IT-F008');

  INSERT INTO faculty (id, code, name, email, department_id, phone, is_active, created_by)
  SELECT gen_random_uuid(), 'ECE-F007', 'Dr. Vinod Kumar', 'vinod@university.edu', ece_id, '9876540307', true, '11111111-1111-1111-1111-111111111111'::UUID
  WHERE NOT EXISTS (SELECT 1 FROM faculty WHERE code = 'ECE-F007');

  INSERT INTO faculty (id, code, name, email, department_id, phone, is_active, created_by)
  SELECT gen_random_uuid(), 'ECE-F008', 'Prof. Geeta Sharma', 'geeta@university.edu', ece_id, '9876540308', true, '11111111-1111-1111-1111-111111111111'::UUID
  WHERE NOT EXISTS (SELECT 1 FROM faculty WHERE code = 'ECE-F008');
END $$;

-- Step 3: ADD FACULTY AVAILABILITY for new faculty (Mon-Fri P1-8, Sat P1-4)
DO $$
DECLARE
  fac RECORD;
  d INT;
BEGIN
  FOR fac IN SELECT id FROM faculty WHERE code IN ('CSE-F007','CSE-F008','IT-F007','IT-F008','ECE-F007','ECE-F008') LOOP
    -- Skip if already has availability
    IF NOT EXISTS (SELECT 1 FROM faculty_availability WHERE faculty_id = fac.id LIMIT 1) THEN
      FOR d IN 0..4 LOOP
        INSERT INTO faculty_availability (id, faculty_id, day_of_week, start_period, end_period)
        VALUES (gen_random_uuid(), fac.id, d, 1, 8);
      END LOOP;
      INSERT INTO faculty_availability (id, faculty_id, day_of_week, start_period, end_period)
      VALUES (gen_random_uuid(), fac.id, 5, 1, 4);
    END IF;
  END LOOP;
END $$;

-- Step 4: MAP ALL FACULTY TO ALL SUBJECTS (THEORY + LAB) within their department
-- This ensures round-robin distribution can spread the load evenly
DO $$
DECLARE
  fac RECORD;
  subj RECORD;
BEGIN
  FOR fac IN SELECT id, department_id FROM faculty LOOP
    FOR subj IN SELECT id FROM subjects WHERE department_id = fac.department_id LOOP
      INSERT INTO subject_faculty (id, subject_id, faculty_id) 
      VALUES (gen_random_uuid(), subj.id, fac.id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Step 5: REDISTRIBUTE section-subject mappings with load balancing
-- Track cumulative assignments per faculty, pick least-loaded each time

DO $$
DECLARE
  sec RECORD;
  theory_subjs RECORD;
  lab_subjs RECORD;
  fac_list UUID[];
  chosen_fac UUID;
  min_count INT;
  this_count INT;
  fac_id UUID;
  theory_count INT;
  lab_count INT;
BEGIN
  -- Create temp table to track faculty assignment counts
  CREATE TEMP TABLE IF NOT EXISTS faculty_load (
    faculty_id UUID PRIMARY KEY,
    theory_count INT DEFAULT 0,
    lab_count INT DEFAULT 0,
    total_count INT DEFAULT 0
  ) ON COMMIT DROP;
  
  -- Initialize with all faculty
  INSERT INTO faculty_load (faculty_id, theory_count, lab_count, total_count)
  SELECT id, 0, 0, 0 FROM faculty;

  FOR sec IN SELECT id, name, department_id, year_level FROM sections ORDER BY name LOOP
    theory_count := 0;
    
    -- Assign 7 theory subjects - pick least-loaded faculty each time
    FOR theory_subjs IN
      SELECT DISTINCT ON (s.id) s.id AS subj_id, s.code, s.subject_type
      FROM subjects s
      WHERE s.department_id = sec.department_id AND s.subject_type = 'theory'
      ORDER BY s.id, s.code
    LOOP
      IF theory_count >= 7 THEN EXIT; END IF;
      
      -- Find least-loaded faculty who can teach this subject
      SELECT sf.faculty_id INTO chosen_fac
      FROM subject_faculty sf
      JOIN faculty f ON f.id = sf.faculty_id
      LEFT JOIN faculty_load fl ON fl.faculty_id = sf.faculty_id
      WHERE sf.subject_id = theory_subjs.subj_id
        AND f.department_id = sec.department_id
      ORDER BY COALESCE(fl.total_count, 0) ASC, f.code ASC
      LIMIT 1;
      
      IF chosen_fac IS NOT NULL THEN
        INSERT INTO section_subjects (id, section_id, subject_id, faculty_id)
        VALUES (gen_random_uuid(), sec.id, theory_subjs.subj_id, chosen_fac)
        ON CONFLICT DO NOTHING;
        
        UPDATE faculty_load SET theory_count = faculty_load.theory_count + 1, total_count = faculty_load.total_count + 1
        WHERE faculty_id = chosen_fac;
        
        theory_count := theory_count + 1;
      END IF;
    END LOOP;

    -- Assign 4 lab subjects - pick least-loaded faculty
    lab_count := 0;
    FOR lab_subjs IN
      SELECT DISTINCT ON (s.id) s.id AS subj_id, s.code
      FROM subjects s
      WHERE s.department_id = sec.department_id AND s.subject_type = 'lab'
      ORDER BY s.id
    LOOP
      IF lab_count >= 3 THEN EXIT; END IF;
      
      -- Find least-loaded faculty who can teach this lab subject
      SELECT sf.faculty_id INTO chosen_fac
      FROM subject_faculty sf
      JOIN faculty f ON f.id = sf.faculty_id
      LEFT JOIN faculty_load fl ON fl.faculty_id = sf.faculty_id
      WHERE sf.subject_id = lab_subjs.subj_id
        AND f.department_id = sec.department_id
      ORDER BY COALESCE(fl.total_count, 0) ASC, f.code ASC
      LIMIT 1;
      
      IF chosen_fac IS NOT NULL THEN
        INSERT INTO section_subjects (id, section_id, subject_id, faculty_id)
        VALUES (gen_random_uuid(), sec.id, lab_subjs.subj_id, chosen_fac)
        ON CONFLICT DO NOTHING;
        
        UPDATE faculty_load SET lab_count = faculty_load.lab_count + 1, total_count = faculty_load.total_count + 1
        WHERE faculty_id = chosen_fac;
        
        lab_count := lab_count + 1;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Step 6: ADD EXTRA ROOM CAPACITY (removed - now handled in 019 with 14 theory rooms)
-- 019 already creates TH-504 and TH-505

-- Step 7: VERIFICATION
SELECT 'Total Sections' AS metric, COUNT(*) AS value FROM sections
UNION ALL
SELECT 'Total Faculty', COUNT(*) FROM faculty
UNION ALL
SELECT 'Section-Subject mappings', COUNT(*) FROM section_subjects
UNION ALL
SELECT 'Total Classrooms', COUNT(*) FROM classrooms
UNION ALL
SELECT 'Theory Rooms', COUNT(*) FROM classrooms WHERE room_type = 'theory'
UNION ALL
SELECT 'Lab Rooms', COUNT(*) FROM classrooms WHERE room_type = 'lab';

-- Check faculty workload distribution
SELECT f.code, f.name,
  COUNT(CASE WHEN sub.subject_type = 'theory' THEN 1 END) AS theory_courses,
  COUNT(CASE WHEN sub.subject_type = 'lab' THEN 1 END) AS lab_courses,
  SUM(CASE WHEN sub.subject_type = 'theory' THEN sub.periods_per_week ELSE 0 END) AS theory_periods_weekly
FROM section_subjects ss
JOIN faculty f ON f.id = ss.faculty_id
JOIN subjects sub ON sub.id = ss.subject_id
GROUP BY f.id, f.code, f.name
ORDER BY theory_periods_weekly DESC;

COMMIT;
