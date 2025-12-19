-- Notification Logs Table
-- Tracks all WhatsApp notifications sent to faculty

CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  faculty_id UUID REFERENCES faculty(id) ON DELETE CASCADE,
  job_id UUID REFERENCES timetable_jobs(id) ON DELETE CASCADE,
  notification_type VARCHAR(20) NOT NULL DEFAULT 'whatsapp',
  status VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  message_id VARCHAR(255), -- WhatsApp message ID
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_notification_logs_faculty ON notification_logs(faculty_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_job ON notification_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_notification_logs_sent_at ON notification_logs(sent_at DESC);

-- Comment on table
COMMENT ON TABLE notification_logs IS 'Tracks all WhatsApp notifications sent to faculty members';
