-- Authentication and Multi-Role System Schema
-- This script creates tables for admin, timetable administrators, and faculty authentication

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- Admin Users Table (System Administrators)
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
-- Timetable Administrators Table
-- Created by Admin users, can manage their own faculty/subjects/etc
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
-- Add created_by column to existing tables to link to timetable administrators
-- =============================================

-- Add created_by to faculty table
ALTER TABLE faculty ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES timetable_administrators(id) ON DELETE SET NULL;

-- Add created_by to departments table
ALTER TABLE departments ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES timetable_administrators(id) ON DELETE SET NULL;

-- Add created_by to subjects table
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES timetable_administrators(id) ON DELETE SET NULL;

-- Add created_by to classrooms table
ALTER TABLE classrooms ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES timetable_administrators(id) ON DELETE SET NULL;

-- Add created_by to sections table
ALTER TABLE sections ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES timetable_administrators(id) ON DELETE SET NULL;

-- Add created_by to timetable_jobs table
ALTER TABLE timetable_jobs ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES timetable_administrators(id) ON DELETE SET NULL;

-- Add created_by to timetable_base table
ALTER TABLE timetable_base ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES timetable_administrators(id) ON DELETE SET NULL;

-- Add created_by to timetable_optimized table
ALTER TABLE timetable_optimized ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES timetable_administrators(id) ON DELETE SET NULL;

-- =============================================
-- User Sessions Table (for managing login sessions)
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
-- Indexes for Performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);
CREATE INDEX IF NOT EXISTS idx_timetable_admin_username ON timetable_administrators(username);
CREATE INDEX IF NOT EXISTS idx_timetable_admin_created_by ON timetable_administrators(created_by);
CREATE INDEX IF NOT EXISTS idx_faculty_created_by ON faculty(created_by);
CREATE INDEX IF NOT EXISTS idx_departments_created_by ON departments(created_by);
CREATE INDEX IF NOT EXISTS idx_subjects_created_by ON subjects(created_by);
CREATE INDEX IF NOT EXISTS idx_classrooms_created_by ON classrooms(created_by);
CREATE INDEX IF NOT EXISTS idx_sections_created_by ON sections(created_by);
CREATE INDEX IF NOT EXISTS idx_timetable_jobs_created_by ON timetable_jobs(created_by);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id, user_type);

-- =============================================
-- Row Level Security
-- =============================================
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_administrators ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow all operations on admin_users" ON admin_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on timetable_administrators" ON timetable_administrators FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on user_sessions" ON user_sessions FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- Insert Default Admin User
-- Username: admin, Password: admin123 (hashed)
-- =============================================
INSERT INTO admin_users (username, password_hash, name, email)
VALUES (
  'admin',
  crypt('admin123', gen_salt('bf')),
  'System Administrator',
  'admin@timetable.edu'
) ON CONFLICT (username) DO NOTHING;

-- =============================================
-- Function to verify password
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
-- Function to hash password
-- =============================================
CREATE OR REPLACE FUNCTION hash_password(
  password VARCHAR
) RETURNS VARCHAR AS $$
BEGIN
  RETURN crypt(password, gen_salt('bf'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- Function to clean up expired sessions
-- =============================================
CREATE OR REPLACE FUNCTION cleanup_expired_sessions() RETURNS void AS $$
BEGIN
  DELETE FROM user_sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
