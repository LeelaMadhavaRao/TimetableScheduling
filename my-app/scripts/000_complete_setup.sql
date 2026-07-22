-- ============================================================
-- TIMETABLE SCHEDULING - COMPLETE DATABASE SETUP
-- ============================================================
-- Run this entire script in the Supabase SQL Editor (Dashboard → SQL Editor)
-- This creates ALL tables, functions, RLS policies, and the default admin user.
--
-- ⚠️  BEFORE RUNNING: Replace YOUR_SUPABASE_URL and YOUR_SERVICE_ROLE_KEY
--     at the bottom of this script (Section 9) with your actual values.
-- ============================================================

-- ============================================================
-- 1. EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 2. CORE TABLES
-- ============================================================

-- Departments
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  code VARCHAR(20) NOT NULL UNIQUE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Faculty
CREATE TABLE IF NOT EXISTS faculty (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Faculty availability (time slots)
CREATE TABLE IF NOT EXISTS faculty_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  faculty_id UUID NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_period INTEGER NOT NULL CHECK (start_period BETWEEN 1 AND 8),
  end_period INTEGER NOT NULL CHECK (end_period BETWEEN 1 AND 8),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(faculty_id, day_of_week, start_period, end_period)
);

-- Subjects
CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) NOT NULL UNIQUE,
  subject_type VARCHAR(20) NOT NULL CHECK (subject_type IN ('theory', 'lab')),
  periods_per_week INTEGER NOT NULL CHECK (periods_per_week > 0),
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subject-Faculty mapping
CREATE TABLE IF NOT EXISTS subject_faculty (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  faculty_id UUID NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(subject_id, faculty_id)
);

-- Classrooms
CREATE TABLE IF NOT EXISTS classrooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) NOT NULL UNIQUE,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  room_type VARCHAR(20) NOT NULL CHECK (room_type IN ('lab', 'theory')),
  building VARCHAR(50),
  floor INTEGER,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Academic years
CREATE TABLE IF NOT EXISTS academic_years (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  year_level INTEGER NOT NULL CHECK (year_level BETWEEN 1 AND 4),
  name VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sections
CREATE TABLE IF NOT EXISTS sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) NOT NULL UNIQUE,
  year_level INTEGER NOT NULL CHECK (year_level BETWEEN 1 AND 4),
  student_count INTEGER NOT NULL CHECK (student_count > 0),
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Section-Subject mapping
CREATE TABLE IF NOT EXISTS section_subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  faculty_id UUID NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(section_id, subject_id)
);

-- Timetable generation jobs
CREATE TABLE IF NOT EXISTS timetable_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating_base', 'base_complete', 'optimizing', 'completed', 'failed')),
  progress INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  message TEXT,
  base_generation_time INTEGER,
  optimization_time INTEGER,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Base timetable (generated by ILP)
CREATE TABLE IF NOT EXISTS timetable_base (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES timetable_jobs(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  faculty_id UUID NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 5),
  start_period INTEGER NOT NULL CHECK (start_period BETWEEN 1 AND 8),
  end_period INTEGER NOT NULL CHECK (end_period BETWEEN 1 AND 8),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Optimized timetable (optimized by GA)
CREATE TABLE IF NOT EXISTS timetable_optimized (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES timetable_jobs(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  faculty_id UUID NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 5),
  start_period INTEGER NOT NULL CHECK (start_period BETWEEN 1 AND 8),
  end_period INTEGER NOT NULL CHECK (end_period BETWEEN 1 AND 8),
  fitness_score DECIMAL(10, 4),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 3. AUTHENTICATION TABLES
-- ============================================================

-- Admin Users (System Administrators)
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE,
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Timetable Administrators (created by admin users)
CREATE TABLE IF NOT EXISTS timetable_administrators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE,
  phone VARCHAR(20),
  institution_name VARCHAR(200),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Sessions
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('admin', 'timetable_admin', 'faculty')),
  session_token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Registration Requests
CREATE TABLE IF NOT EXISTS registration_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  institution_name VARCHAR(200),
  username VARCHAR(50) NOT NULL,
  requested_password VARCHAR(255) NOT NULL,
  message TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notification Logs
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  faculty_id UUID REFERENCES faculty(id) ON DELETE CASCADE,
  job_id UUID REFERENCES timetable_jobs(id) ON DELETE CASCADE,
  notification_type VARCHAR(20) NOT NULL DEFAULT 'whatsapp',
  status VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  message_id VARCHAR(255),
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notification Config (stores Supabase credentials for triggers)
CREATE TABLE IF NOT EXISTS notification_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  supabase_url TEXT NOT NULL,
  service_role_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- ============================================================
-- 4. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_faculty_dept ON faculty(department_id);
CREATE INDEX IF NOT EXISTS idx_faculty_code ON faculty(code);
CREATE INDEX IF NOT EXISTS idx_faculty_availability_faculty ON faculty_availability(faculty_id);
CREATE INDEX IF NOT EXISTS idx_subjects_dept ON subjects(department_id);
CREATE INDEX IF NOT EXISTS idx_subject_faculty_subject ON subject_faculty(subject_id);
CREATE INDEX IF NOT EXISTS idx_subject_faculty_faculty ON subject_faculty(faculty_id);
CREATE INDEX IF NOT EXISTS idx_sections_dept ON sections(department_id);
CREATE INDEX IF NOT EXISTS idx_section_subjects_section ON section_subjects(section_id);
CREATE INDEX IF NOT EXISTS idx_section_subjects_subject ON section_subjects(subject_id);
CREATE INDEX IF NOT EXISTS idx_timetable_base_job ON timetable_base(job_id);
CREATE INDEX IF NOT EXISTS idx_timetable_base_section ON timetable_base(section_id);
CREATE INDEX IF NOT EXISTS idx_timetable_base_faculty ON timetable_base(faculty_id);
CREATE INDEX IF NOT EXISTS idx_timetable_optimized_job ON timetable_optimized(job_id);
CREATE INDEX IF NOT EXISTS idx_timetable_optimized_section ON timetable_optimized(section_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);
CREATE INDEX IF NOT EXISTS idx_timetable_admin_username ON timetable_administrators(username);
CREATE INDEX IF NOT EXISTS idx_timetable_admin_created_by ON timetable_administrators(created_by);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id, user_type);
CREATE INDEX IF NOT EXISTS idx_departments_created_by ON departments(created_by);
CREATE INDEX IF NOT EXISTS idx_faculty_created_by ON faculty(created_by);
CREATE INDEX IF NOT EXISTS idx_subjects_created_by ON subjects(created_by);
CREATE INDEX IF NOT EXISTS idx_classrooms_created_by ON classrooms(created_by);
CREATE INDEX IF NOT EXISTS idx_sections_created_by ON sections(created_by);
CREATE INDEX IF NOT EXISTS idx_timetable_jobs_created_by ON timetable_jobs(created_by);
CREATE INDEX IF NOT EXISTS idx_timetable_base_created_by ON timetable_base(created_by);
CREATE INDEX IF NOT EXISTS idx_timetable_optimized_created_by ON timetable_optimized(created_by);
CREATE INDEX IF NOT EXISTS idx_registration_requests_status ON registration_requests(status);
CREATE INDEX IF NOT EXISTS idx_registration_requests_email ON registration_requests(email);
CREATE INDEX IF NOT EXISTS idx_registration_requests_created ON registration_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_faculty ON notification_logs(faculty_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_job ON notification_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_notification_logs_sent_at ON notification_logs(sent_at DESC);

-- ============================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE subject_faculty ENABLE ROW LEVEL SECURITY;
ALTER TABLE classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_optimized ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_administrators ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on departments" ON departments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on faculty" ON faculty FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on faculty_availability" ON faculty_availability FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on subjects" ON subjects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on subject_faculty" ON subject_faculty FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on classrooms" ON classrooms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on academic_years" ON academic_years FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on sections" ON sections FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on section_subjects" ON section_subjects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on timetable_jobs" ON timetable_jobs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on timetable_base" ON timetable_base FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on timetable_optimized" ON timetable_optimized FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on admin_users" ON admin_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on timetable_administrators" ON timetable_administrators FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on user_sessions" ON user_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on registration_requests" ON registration_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on notification_logs" ON notification_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on notification_config" ON notification_config FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 6. DATABASE FUNCTIONS
-- ============================================================

-- Password hashing
CREATE OR REPLACE FUNCTION hash_password(input_password TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN crypt(input_password, gen_salt('bf', 8));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Password verification
CREATE OR REPLACE FUNCTION verify_password(stored_hash TEXT, input_password TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN stored_hash = crypt(input_password, stored_hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Session cleanup
CREATE OR REPLACE FUNCTION cleanup_expired_sessions() RETURNS void AS $$
BEGIN
  DELETE FROM user_sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Registration requests updated_at trigger
CREATE OR REPLACE FUNCTION update_registration_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_registration_requests_updated_at ON registration_requests;
CREATE TRIGGER trigger_update_registration_requests_updated_at
  BEFORE UPDATE ON registration_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_registration_requests_updated_at();

-- Approve registration request
CREATE OR REPLACE FUNCTION approve_registration_request(
  p_request_id UUID,
  p_admin_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_request RECORD;
  v_new_admin_id UUID;
  v_temp_password TEXT;
BEGIN
  SELECT * INTO v_request
  FROM registration_requests
  WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Request not found or already processed');
  END IF;

  IF EXISTS (SELECT 1 FROM timetable_administrators WHERE username = v_request.username) THEN
    RETURN json_build_object('success', false, 'message', 'Username already exists');
  END IF;

  IF EXISTS (SELECT 1 FROM timetable_administrators WHERE email = v_request.email) THEN
    RETURN json_build_object('success', false, 'message', 'Email already exists');
  END IF;

  v_temp_password := 'TT' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6);

  INSERT INTO timetable_administrators (
    username, name, email, phone, institution_name,
    password_hash, is_active, created_by
  ) VALUES (
    v_request.username, v_request.full_name, v_request.email,
    v_request.phone, v_request.institution_name,
    crypt(v_temp_password, gen_salt('bf', 8)),
    true, p_admin_id
  ) RETURNING id INTO v_new_admin_id;

  UPDATE registration_requests
  SET status = 'approved', reviewed_by = p_admin_id, reviewed_at = NOW()
  WHERE id = p_request_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Registration approved successfully',
    'admin_id', v_new_admin_id,
    'username', v_request.username,
    'email', v_request.email,
    'name', v_request.full_name,
    'temp_password', v_temp_password
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION approve_registration_request IS 'Approves a registration request and creates a timetable administrator account with a generated temporary password.';

-- Reject registration request
CREATE OR REPLACE FUNCTION reject_registration_request(
  p_request_id UUID,
  p_admin_id UUID,
  p_rejection_reason TEXT
)
RETURNS JSON AS $$
DECLARE
  v_request RECORD;
BEGIN
  SELECT * INTO v_request
  FROM registration_requests
  WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Request not found or already processed');
  END IF;

  UPDATE registration_requests
  SET status = 'rejected', reviewed_by = p_admin_id,
      reviewed_at = NOW(), rejection_reason = p_rejection_reason
  WHERE id = p_request_id;

  RETURN json_build_object('success', true, 'message', 'Registration rejected successfully');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 7. DEFAULT ADMIN USER
-- ============================================================
INSERT INTO admin_users (username, password_hash, name, email)
VALUES (
  'admin',
  crypt('admin123', gen_salt('bf')),
  'System Administrator',
  'admin@timetable.edu'
) ON CONFLICT (username) DO NOTHING;

-- Academic years
INSERT INTO academic_years (year_level, name) VALUES
  (1, 'First Year'),
  (2, 'Second Year'),
  (3, 'Third Year'),
  (4, 'Fourth Year')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 8. STORAGE BUCKET (faculty-timetables)
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'faculty-timetables',
  'faculty-timetables',
  true,
  5242880,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['application/pdf'];

-- Storage policies
CREATE POLICY "Service role can manage faculty timetable PDFs"
ON storage.objects FOR ALL
USING (bucket_id = 'faculty-timetables')
WITH CHECK (bucket_id = 'faculty-timetables');

CREATE POLICY "Public can view faculty timetable PDFs"
ON storage.objects FOR SELECT
USING (bucket_id = 'faculty-timetables');

-- ============================================================
-- 9. NOTIFICATION CONFIG
-- ============================================================
-- ⚠️  REPLACE the values below with your NEW Supabase project URL and service role key!
INSERT INTO notification_config (id, supabase_url, service_role_key)
VALUES (
  1,
  'https://rrngxjezixktfrbotaos.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJybmd4amV6aXhrdGZyYm90YW9zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDYzNjEyMywiZXhwIjoyMTAwMjEyMTIzfQ.2JybwbrgLT2H3w6yatZRh6V9IeafDrXDbtO0W3Zxj1E'
)
ON CONFLICT (id) DO UPDATE SET
  supabase_url = EXCLUDED.supabase_url,
  service_role_key = EXCLUDED.service_role_key,
  updated_at = NOW();

-- ============================================================
-- 10. WHATSAPP NOTIFICATION TRIGGER (requires pg_net)
-- ============================================================
-- NOTE: pg_net is available on Supabase Pro plans.
-- If this section fails, skip it. The app still works with manual notifications.
-- Uncomment the line below if you have pg_net available:
-- CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION trigger_whatsapp_notifications()
RETURNS TRIGGER AS $$
DECLARE
  timetable_type TEXT;
  request_id BIGINT;
  supabase_url TEXT;
  service_role_key TEXT;
BEGIN
  SELECT nc.supabase_url, nc.service_role_key
  INTO supabase_url, service_role_key
  FROM notification_config nc WHERE id = 1;

  IF supabase_url IS NULL OR service_role_key IS NULL THEN
    RAISE WARNING 'Supabase URL or service role key not configured.';
    RETURN NEW;
  END IF;

  IF NEW.base_generation_time IS NOT NULL AND (OLD.base_generation_time IS NULL OR NEW.base_generation_time != OLD.base_generation_time) THEN
    timetable_type := 'base';
  ELSIF NEW.optimization_time IS NOT NULL AND (OLD.optimization_time IS NULL OR NEW.optimization_time != OLD.optimization_time) THEN
    timetable_type := 'optimized';
  ELSE
    RETURN NEW;
  END IF;

  SELECT INTO request_id net.http_post(
    url := supabase_url || '/functions/v1/notify-faculty-timetable',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object(
      'jobId', NEW.id::TEXT,
      'timetableType', timetable_type
    ),
    timeout_milliseconds := 30000
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to trigger WhatsApp notifications: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS timetable_completion_notify_trigger ON timetable_jobs;
CREATE TRIGGER timetable_completion_notify_trigger
  AFTER UPDATE OF base_generation_time, optimization_time ON timetable_jobs
  FOR EACH ROW
  WHEN (
    (NEW.base_generation_time IS NOT NULL AND (OLD.base_generation_time IS NULL OR NEW.base_generation_time != OLD.base_generation_time))
    OR
    (NEW.optimization_time IS NOT NULL AND (OLD.optimization_time IS NULL OR NEW.optimization_time != OLD.optimization_time))
  )
  EXECUTE FUNCTION trigger_whatsapp_notifications();

COMMENT ON TABLE registration_requests IS 'Stores registration requests from users wanting to become timetable administrators';
COMMENT ON TABLE notification_logs IS 'Tracks all WhatsApp notifications sent to faculty members';

-- ============================================================
-- SETUP COMPLETE!
-- Next: Update notification_config, deploy edge functions, update .env.local
-- ============================================================
