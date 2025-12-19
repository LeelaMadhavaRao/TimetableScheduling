-- Registration Requests Table
-- Stores requests from users who want to become timetable administrators

-- Enable pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop existing password functions if they exist (to avoid overloading conflicts)
DROP FUNCTION IF EXISTS hash_password(TEXT);
DROP FUNCTION IF EXISTS hash_password(VARCHAR);
DROP FUNCTION IF EXISTS hash_password(CHARACTER VARYING);
DROP FUNCTION IF EXISTS verify_password(TEXT, TEXT);
DROP FUNCTION IF EXISTS verify_password(VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS verify_password(CHARACTER VARYING, CHARACTER VARYING);

-- RPC function to hash password
CREATE OR REPLACE FUNCTION hash_password(input_password TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN crypt(input_password, gen_salt('bf', 8));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC function to verify password
CREATE OR REPLACE FUNCTION verify_password(stored_hash TEXT, input_password TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN stored_hash = crypt(input_password, stored_hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TABLE IF NOT EXISTS registration_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  institution_name VARCHAR(200),
  username VARCHAR(50) NOT NULL,
  requested_password VARCHAR(255) NOT NULL, -- Encrypted on client before sending
  message TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_registration_requests_status ON registration_requests(status);
CREATE INDEX IF NOT EXISTS idx_registration_requests_email ON registration_requests(email);
CREATE INDEX IF NOT EXISTS idx_registration_requests_created ON registration_requests(created_at DESC);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_registration_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists, then create it
DROP TRIGGER IF EXISTS trigger_update_registration_requests_updated_at ON registration_requests;

CREATE TRIGGER trigger_update_registration_requests_updated_at
  BEFORE UPDATE ON registration_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_registration_requests_updated_at();

-- RPC function to approve registration request and create timetable administrator
CREATE OR REPLACE FUNCTION approve_registration_request(
  p_request_id UUID,
  p_admin_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_request RECORD;
  v_new_admin_id UUID;
BEGIN
  -- Get the request details
  SELECT * INTO v_request
  FROM registration_requests
  WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Request not found or already processed');
  END IF;

  -- Check if username already exists
  IF EXISTS (SELECT 1 FROM timetable_administrators WHERE username = v_request.username) THEN
    RETURN json_build_object('success', false, 'message', 'Username already exists');
  END IF;

  -- Check if email already exists
  IF EXISTS (SELECT 1 FROM timetable_administrators WHERE email = v_request.email) THEN
    RETURN json_build_object('success', false, 'message', 'Email already exists');
  END IF;

  -- Create new timetable administrator
  INSERT INTO timetable_administrators (
    username,
    name,
    email,
    phone,
    institution_name,
    password_hash,
    is_active,
    created_by
  ) VALUES (
    v_request.username,
    v_request.full_name,
    v_request.email,
    v_request.phone,
    v_request.institution_name,
    v_request.requested_password, -- Already hashed on client
    true,
    p_admin_id
  ) RETURNING id INTO v_new_admin_id;

  -- Update request status
  UPDATE registration_requests
  SET 
    status = 'approved',
    reviewed_by = p_admin_id,
    reviewed_at = NOW()
  WHERE id = p_request_id;

  RETURN json_build_object(
    'success', true, 
    'message', 'Registration approved successfully',
    'admin_id', v_new_admin_id
  );
END;
$$ LANGUAGE plpgsql;

-- RPC function to reject registration request
CREATE OR REPLACE FUNCTION reject_registration_request(
  p_request_id UUID,
  p_admin_id UUID,
  p_rejection_reason TEXT
)
RETURNS JSON AS $$
DECLARE
  v_request RECORD;
BEGIN
  -- Get the request details
  SELECT * INTO v_request
  FROM registration_requests
  WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Request not found or already processed');
  END IF;

  -- Update request status
  UPDATE registration_requests
  SET 
    status = 'rejected',
    reviewed_by = p_admin_id,
    reviewed_at = NOW(),
    rejection_reason = p_rejection_reason
  WHERE id = p_request_id;

  RETURN json_build_object(
    'success', true, 
    'message', 'Registration rejected successfully'
  );
END;
$$ LANGUAGE plpgsql;

-- Comment on table
COMMENT ON TABLE registration_requests IS 'Stores registration requests from users wanting to become timetable administrators';
