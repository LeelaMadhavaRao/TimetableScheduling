-- Trigger to automatically send WhatsApp notifications when timetable generation completes
-- This trigger fires when base_generation_time or optimization_time is updated

-- First, ensure pg_net extension is enabled (required for HTTP requests)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create configuration table for storing Supabase credentials
CREATE TABLE IF NOT EXISTS notification_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  supabase_url TEXT NOT NULL,
  service_role_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Insert default configuration (you'll need to update this with your actual values)
INSERT INTO notification_config (id, supabase_url, service_role_key)
VALUES (
  1,
  'https://dkhqnhhfqcusnzmnqryb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRraHFuaGhmcWN1c256bW5xcnliIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTc5NTA5MywiZXhwIjoyMDgxMzcxMDkzfQ.X882NVDMwS5Q_j7Q27FMEL90QKECbBl429NGbMfby7A'
)
ON CONFLICT (id) DO UPDATE SET
  supabase_url = EXCLUDED.supabase_url,
  service_role_key = EXCLUDED.service_role_key,
  updated_at = NOW();

-- Function to trigger WhatsApp notifications via HTTP call to edge function
CREATE OR REPLACE FUNCTION trigger_whatsapp_notifications()
RETURNS TRIGGER AS $$
DECLARE
  timetable_type TEXT;
  request_id BIGINT;
  supabase_url TEXT;
  service_role_key TEXT;
BEGIN
  -- Get Supabase URL and service role key from config table
  SELECT nc.supabase_url, nc.service_role_key 
  INTO supabase_url, service_role_key
  FROM notification_config nc
  WHERE id = 1;
  
  -- If settings are not configured, log and skip
  IF supabase_url IS NULL OR service_role_key IS NULL THEN
    RAISE WARNING 'Supabase URL or service role key not configured in notification_config table.';
    RETURN NEW;
  END IF;

  -- Determine timetable type based on which field was updated
  IF NEW.base_generation_time IS NOT NULL AND (OLD.base_generation_time IS NULL OR NEW.base_generation_time != OLD.base_generation_time) THEN
    timetable_type := 'base';
    RAISE LOG 'Base timetable completed for job %, triggering WhatsApp notifications', NEW.id;
  ELSIF NEW.optimization_time IS NOT NULL AND (OLD.optimization_time IS NULL OR NEW.optimization_time != OLD.optimization_time) THEN
    timetable_type := 'optimized';
    RAISE LOG 'Optimized timetable completed for job %, triggering WhatsApp notifications', NEW.id;
  ELSE
    -- No relevant field was updated, skip
    RETURN NEW;
  END IF;

  -- Make async HTTP POST request to edge function
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

  RAISE LOG 'WhatsApp notification HTTP request sent for job % (type: %, request_id: %)', NEW.id, timetable_type, request_id;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to trigger WhatsApp notifications: %', SQLERRM;
    RETURN NEW; -- Don't fail the update if notification fails
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS timetable_completion_notify_trigger ON timetable_jobs;

-- Create trigger on timetable_jobs table
CREATE TRIGGER timetable_completion_notify_trigger
  AFTER UPDATE OF base_generation_time, optimization_time ON timetable_jobs
  FOR EACH ROW
  WHEN (
    (NEW.base_generation_time IS NOT NULL AND (OLD.base_generation_time IS NULL OR NEW.base_generation_time != OLD.base_generation_time))
    OR
    (NEW.optimization_time IS NOT NULL AND (OLD.optimization_time IS NULL OR NEW.optimization_time != OLD.optimization_time))
  )
  EXECUTE FUNCTION trigger_whatsapp_notifications();

COMMENT ON FUNCTION trigger_whatsapp_notifications() IS 
'Automatically triggers WhatsApp notifications to faculty when timetable generation completes. 
Monitors base_generation_time and optimization_time fields to detect completion.
Requires pg_net extension and notification_config table with Supabase credentials.';

-- To update configuration later:
-- UPDATE notification_config 
-- SET supabase_url = 'https://your-new-url.supabase.co',
--     service_role_key = 'your-new-service-role-key'
-- WHERE id = 1;
