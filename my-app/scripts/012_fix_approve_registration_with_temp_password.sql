-- Fix approve_registration_request to return user details and generate temporary password
-- This ensures the approval email can be sent with login credentials

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

  -- Generate a temporary password (8 characters: mix of letters and numbers)
  -- Format: TT + 6 random alphanumeric characters
  v_temp_password := 'TT' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6);

  -- Create new timetable administrator with new temporary password
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
    crypt(v_temp_password, gen_salt('bf', 8)), -- Hash the new temporary password
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

  -- Return all necessary data for email notification including the plain temp password
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

-- Add comment explaining the change
COMMENT ON FUNCTION approve_registration_request IS 'Approves a registration request and creates a timetable administrator account with a generated temporary password. Returns user details including the plain temporary password for email notification.';
