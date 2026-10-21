-- =============================================
-- 021: COLLEGE -> DEPARTMENT HIERARCHY + ENHANCED ILP-GA SUPPORT
-- =============================================
-- Run AFTER 000_complete_setup.sql (safe to re-run).
--
-- Role hierarchy introduced by this migration:
--   System Admin (admin_users)
--     └── College Admin (timetable_administrators)      one row = one college
--           ├── Faculty, faculty availability, classrooms (shared by the whole college)
--           └── Department Admin (department_admins)    exactly one per department
--                 └── Subjects, sections, timetable generation for selected sections
--
-- A department's timetable becomes binding only when it is PUBLISHED. Published
-- slots (view: committed_timetable) are treated as occupied faculty/room time by
-- every later generation in the same college, so departments never double-book
-- a shared faculty member or classroom.
-- =============================================

BEGIN;

-- ---------------------------------------------
-- 1. Drop legacy created_by foreign keys
--    (007 pointed created_by at timetable_administrators; department admins now
--    create sections/subjects/jobs too, so created_by is a plain audit column)
-- ---------------------------------------------
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT tc.table_name, tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND kcu.column_name = 'created_by'
      AND tc.table_name IN ('departments', 'faculty', 'subjects', 'classrooms', 'sections',
                            'timetable_jobs', 'timetable_base', 'timetable_optimized')
  LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', r.table_name, r.constraint_name);
  END LOOP;
END $$;

-- ---------------------------------------------
-- 2. College scoping columns (backfilled from created_by)
-- ---------------------------------------------
ALTER TABLE departments ADD COLUMN IF NOT EXISTS college_id UUID REFERENCES timetable_administrators(id) ON DELETE CASCADE;
ALTER TABLE faculty     ADD COLUMN IF NOT EXISTS college_id UUID REFERENCES timetable_administrators(id) ON DELETE CASCADE;
ALTER TABLE classrooms  ADD COLUMN IF NOT EXISTS college_id UUID REFERENCES timetable_administrators(id) ON DELETE CASCADE;
ALTER TABLE sections    ADD COLUMN IF NOT EXISTS college_id UUID REFERENCES timetable_administrators(id) ON DELETE CASCADE;
ALTER TABLE subjects    ADD COLUMN IF NOT EXISTS college_id UUID REFERENCES timetable_administrators(id) ON DELETE CASCADE;

UPDATE departments SET college_id = created_by WHERE college_id IS NULL AND created_by IN (SELECT id FROM timetable_administrators);
UPDATE faculty     SET college_id = created_by WHERE college_id IS NULL AND created_by IN (SELECT id FROM timetable_administrators);
UPDATE classrooms  SET college_id = created_by WHERE college_id IS NULL AND created_by IN (SELECT id FROM timetable_administrators);
UPDATE sections    SET college_id = created_by WHERE college_id IS NULL AND created_by IN (SELECT id FROM timetable_administrators);
UPDATE subjects    SET college_id = created_by WHERE college_id IS NULL AND created_by IN (SELECT id FROM timetable_administrators);

ALTER TABLE faculty ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_departments_college ON departments(college_id);
CREATE INDEX IF NOT EXISTS idx_faculty_college     ON faculty(college_id);
CREATE INDEX IF NOT EXISTS idx_classrooms_college  ON classrooms(college_id);
CREATE INDEX IF NOT EXISTS idx_sections_college    ON sections(college_id);
CREATE INDEX IF NOT EXISTS idx_subjects_college    ON subjects(college_id);

-- Names/codes only need to be unique inside one college (faculty.code stays
-- globally unique because faculty log in with it).
ALTER TABLE departments DROP CONSTRAINT IF EXISTS departments_name_key;
ALTER TABLE departments DROP CONSTRAINT IF EXISTS departments_code_key;
ALTER TABLE sections    DROP CONSTRAINT IF EXISTS sections_name_key;
ALTER TABLE subjects    DROP CONSTRAINT IF EXISTS subjects_code_key;
ALTER TABLE classrooms  DROP CONSTRAINT IF EXISTS classrooms_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_departments_college_code ON departments(college_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_departments_college_name ON departments(college_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sections_college_name    ON sections(college_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS uq_subjects_college_code    ON subjects(college_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_classrooms_college_name  ON classrooms(college_id, name);

-- ---------------------------------------------
-- 3. Department administrators (one account per department)
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS department_admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100),
  phone VARCHAR(20),
  department_id UUID NOT NULL UNIQUE REFERENCES departments(id) ON DELETE CASCADE,
  college_id UUID NOT NULL REFERENCES timetable_administrators(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_department_admins_college ON department_admins(college_id);
CREATE INDEX IF NOT EXISTS idx_department_admins_username ON department_admins(username);

ALTER TABLE department_admins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on department_admins" ON department_admins;
CREATE POLICY "Allow all operations on department_admins" ON department_admins FOR ALL USING (true) WITH CHECK (true);

-- Sessions now carry the two new roles ('timetable_admin' kept for old rows)
ALTER TABLE user_sessions DROP CONSTRAINT IF EXISTS user_sessions_user_type_check;
ALTER TABLE user_sessions ADD CONSTRAINT user_sessions_user_type_check
  CHECK (user_type IN ('admin', 'college_admin', 'department_admin', 'faculty', 'timetable_admin'));

-- ---------------------------------------------
-- 4. Timetable jobs: department scope, algorithm mode, publishing, metrics
-- ---------------------------------------------
ALTER TABLE timetable_jobs ADD COLUMN IF NOT EXISTS college_id UUID REFERENCES timetable_administrators(id) ON DELETE CASCADE;
ALTER TABLE timetable_jobs ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE CASCADE;
ALTER TABLE timetable_jobs ADD COLUMN IF NOT EXISTS section_ids UUID[] NOT NULL DEFAULT '{}';
-- Sorted, comma-joined section ids: identifies runs over the same class set (baseline vs enhanced pairs)
ALTER TABLE timetable_jobs ADD COLUMN IF NOT EXISTS section_key TEXT;
ALTER TABLE timetable_jobs ADD COLUMN IF NOT EXISTS algorithm_mode VARCHAR(20) NOT NULL DEFAULT 'baseline'
  CHECK (algorithm_mode IN ('baseline', 'enhanced'));
ALTER TABLE timetable_jobs ADD COLUMN IF NOT EXISTS run_type VARCHAR(20) NOT NULL DEFAULT 'full'
  CHECK (run_type IN ('full', 'reschedule'));
ALTER TABLE timetable_jobs ADD COLUMN IF NOT EXISTS parent_job_id UUID REFERENCES timetable_jobs(id) ON DELETE SET NULL;
ALTER TABLE timetable_jobs ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE timetable_jobs ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE;
-- Evaluation metrics: { base: {...}, final: {...}, process: {...}, reschedule?: {...} }
ALTER TABLE timetable_jobs ADD COLUMN IF NOT EXISTS metrics JSONB NOT NULL DEFAULT '{}'::jsonb;
-- Enhanced mode: diversified ILP seeds handed from the base stage to NSGA-II
ALTER TABLE timetable_jobs ADD COLUMN IF NOT EXISTS seed_population JSONB;
-- Enhanced mode: non-dominated solutions [{ objectives, quality, slots }]
ALTER TABLE timetable_jobs ADD COLUMN IF NOT EXISTS pareto_front JSONB;
ALTER TABLE timetable_jobs ADD COLUMN IF NOT EXISTS selected_solution INTEGER;

UPDATE timetable_jobs SET college_id = created_by
WHERE college_id IS NULL AND created_by IN (SELECT id FROM timetable_administrators);

CREATE INDEX IF NOT EXISTS idx_timetable_jobs_college_published ON timetable_jobs(college_id, is_published);
CREATE INDEX IF NOT EXISTS idx_timetable_jobs_department ON timetable_jobs(department_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_timetable_optimized_faculty ON timetable_optimized(faculty_id);

-- ---------------------------------------------
-- 5. Committed (published) timetable for the whole college
-- ---------------------------------------------
CREATE OR REPLACE VIEW committed_timetable AS
SELECT
  o.id,
  o.job_id,
  o.section_id,
  o.subject_id,
  o.faculty_id,
  o.classroom_id,
  o.day_of_week,
  o.start_period,
  o.end_period,
  j.college_id,
  j.department_id
FROM timetable_optimized o
JOIN timetable_jobs j ON j.id = o.job_id
WHERE j.is_published = true;

-- ---------------------------------------------
-- 6. Publish a department timetable
--    - refuses if a shared faculty member / room was booked by another
--      department after this timetable was generated
--    - each section keeps exactly one committed timetable
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION publish_timetable_job(p_job_id UUID)
RETURNS JSON AS $$
DECLARE
  v_job RECORD;
  v_conflicts INTEGER;
  v_sample TEXT;
BEGIN
  SELECT * INTO v_job FROM timetable_jobs WHERE id = p_job_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Timetable job not found');
  END IF;

  IF v_job.status <> 'completed' THEN
    RETURN json_build_object('success', false, 'message', 'Only optimized (completed) timetables can be published');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM timetable_optimized WHERE job_id = p_job_id) THEN
    RETURN json_build_object('success', false, 'message', 'This timetable has no slots to publish');
  END IF;

  -- One publish per college at a time: two departments publishing simultaneously must not
  -- both pass the clash check against the same committed state
  PERFORM pg_advisory_xact_lock(hashtext('publish:' || v_job.college_id::text));

  SELECT COUNT(*), MIN(f.code || ' / ' || r.name || ' on day ' || n.day_of_week || ' P' || n.start_period)
  INTO v_conflicts, v_sample
  FROM timetable_optimized n
  JOIN committed_timetable c
    ON c.college_id = v_job.college_id
   AND NOT (c.section_id = ANY(v_job.section_ids))
   AND c.day_of_week = n.day_of_week
   AND c.start_period <= n.end_period
   AND n.start_period <= c.end_period
   AND (c.faculty_id = n.faculty_id OR c.classroom_id = n.classroom_id)
  JOIN faculty f ON f.id = n.faculty_id
  JOIN classrooms r ON r.id = n.classroom_id
  WHERE n.job_id = p_job_id;

  IF v_conflicts > 0 THEN
    RETURN json_build_object(
      'success', false,
      'message', format('%s slot(s) now clash with timetables another department published after this one was generated (e.g. %s). Regenerate to pick up the latest faculty/room occupancy.', v_conflicts, v_sample)
    );
  END IF;

  -- The selected sections leave whichever job previously committed them
  DELETE FROM timetable_optimized o
  USING timetable_jobs j
  WHERE o.job_id = j.id
    AND j.is_published = true
    AND j.id <> p_job_id
    AND j.college_id = v_job.college_id
    AND o.section_id = ANY(v_job.section_ids);

  UPDATE timetable_jobs j
  SET is_published = false
  WHERE j.is_published = true
    AND j.id <> p_job_id
    AND j.college_id = v_job.college_id
    AND NOT EXISTS (SELECT 1 FROM timetable_optimized o WHERE o.job_id = j.id);

  UPDATE timetable_jobs
  SET is_published = true, published_at = NOW(), updated_at = NOW()
  WHERE id = p_job_id;

  RETURN json_build_object('success', true, 'message', 'Timetable published. Faculty availability for other departments is updated.');
END;
$$ LANGUAGE plpgsql;

COMMENT ON VIEW committed_timetable IS 'Published timetable slots across the college; used as occupied faculty/room time by later generations.';
COMMENT ON TABLE department_admins IS 'One administrator account per department, created by the college administrator.';

COMMIT;
