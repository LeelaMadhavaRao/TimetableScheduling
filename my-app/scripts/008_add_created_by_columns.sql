-- Migration: Add created_by columns to support multi-tenant timetable administration
-- Run this AFTER 007_authentication_schema.sql

-- Enable extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- Add created_by column to existing tables
-- =============================================

-- Add is_active column to faculty if not exists
ALTER TABLE faculty ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add created_by to departments table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'departments' AND column_name = 'created_by') THEN
        ALTER TABLE departments ADD COLUMN created_by UUID;
    END IF;
END $$;

-- Add created_by to faculty table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'faculty' AND column_name = 'created_by') THEN
        ALTER TABLE faculty ADD COLUMN created_by UUID;
    END IF;
END $$;

-- Add created_by to subjects table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'subjects' AND column_name = 'created_by') THEN
        ALTER TABLE subjects ADD COLUMN created_by UUID;
    END IF;
END $$;

-- Add created_by to classrooms table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'classrooms' AND column_name = 'created_by') THEN
        ALTER TABLE classrooms ADD COLUMN created_by UUID;
    END IF;
END $$;

-- Add created_by to sections table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'sections' AND column_name = 'created_by') THEN
        ALTER TABLE sections ADD COLUMN created_by UUID;
    END IF;
END $$;

-- Add created_by to timetable_jobs table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'timetable_jobs' AND column_name = 'created_by') THEN
        ALTER TABLE timetable_jobs ADD COLUMN created_by UUID;
    END IF;
END $$;

-- Add created_by to timetable_base table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'timetable_base' AND column_name = 'created_by') THEN
        ALTER TABLE timetable_base ADD COLUMN created_by UUID;
    END IF;
END $$;

-- Add created_by to timetable_optimized table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'timetable_optimized' AND column_name = 'created_by') THEN
        ALTER TABLE timetable_optimized ADD COLUMN created_by UUID;
    END IF;
END $$;

-- =============================================
-- Create indexes for created_by columns
-- =============================================
CREATE INDEX IF NOT EXISTS idx_departments_created_by ON departments(created_by);
CREATE INDEX IF NOT EXISTS idx_faculty_created_by ON faculty(created_by);
CREATE INDEX IF NOT EXISTS idx_subjects_created_by ON subjects(created_by);
CREATE INDEX IF NOT EXISTS idx_classrooms_created_by ON classrooms(created_by);
CREATE INDEX IF NOT EXISTS idx_sections_created_by ON sections(created_by);
CREATE INDEX IF NOT EXISTS idx_timetable_jobs_created_by ON timetable_jobs(created_by);
CREATE INDEX IF NOT EXISTS idx_timetable_base_created_by ON timetable_base(created_by);
CREATE INDEX IF NOT EXISTS idx_timetable_optimized_created_by ON timetable_optimized(created_by);

-- =============================================
-- Create admin_users table if not exists
-- =============================================
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

-- =============================================
-- Create timetable_administrators table if not exists
-- =============================================
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

-- =============================================
-- Create user_sessions table if not exists
-- =============================================
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

-- =============================================
-- Create indexes for auth tables
-- =============================================
CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);
CREATE INDEX IF NOT EXISTS idx_timetable_admin_username ON timetable_administrators(username);
CREATE INDEX IF NOT EXISTS idx_timetable_admin_created_by ON timetable_administrators(created_by);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id, user_type);

-- =============================================
-- Enable RLS on new tables
-- =============================================
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_administrators ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate
DROP POLICY IF EXISTS "Allow all operations on admin_users" ON admin_users;
DROP POLICY IF EXISTS "Allow all operations on timetable_administrators" ON timetable_administrators;
DROP POLICY IF EXISTS "Allow all operations on user_sessions" ON user_sessions;

CREATE POLICY "Allow all operations on admin_users" ON admin_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on timetable_administrators" ON timetable_administrators FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on user_sessions" ON user_sessions FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- Password verification function
-- =============================================
CREATE OR REPLACE FUNCTION verify_password(
  stored_hash VARCHAR,
  input_password VARCHAR
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN stored_hash = crypt(input_password, stored_hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- Password hashing function
-- =============================================
CREATE OR REPLACE FUNCTION hash_password(
  password VARCHAR
) RETURNS VARCHAR AS $$
BEGIN
  RETURN crypt(password, gen_salt('bf'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- Session cleanup function
-- =============================================
CREATE OR REPLACE FUNCTION cleanup_expired_sessions() RETURNS void AS $$
BEGIN
  DELETE FROM user_sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMIT;
