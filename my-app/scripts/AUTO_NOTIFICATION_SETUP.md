# Setup Instructions for Automatic WhatsApp Notifications

This guide explains how to set up automatic WhatsApp notifications that trigger whenever a timetable generation completes.

## Overview

The system uses a **PostgreSQL trigger** to automatically send WhatsApp notifications when:
- Base timetable generation completes (`base_generation_time` is updated)
- Optimized timetable generation completes (`optimization_time` is updated)

## Setup Steps

### 1. Run the Trigger Migration

Connect to your Supabase database and run the migration:

```bash
# Option A: Using psql (if you have direct database access)
psql -U postgres -h db.your-project.supabase.co -d postgres -f scripts/014_auto_whatsapp_notification_trigger.sql

# Option B: Using Supabase SQL Editor
# Copy the contents of scripts/014_auto_whatsapp_notification_trigger.sql
# Paste into Supabase Dashboard -> SQL Editor -> New Query
# Run the query
```

### 2. Configure Database Settings

You need to set two configuration variables in your Supabase database:

**Method A: Using Supabase Dashboard**
1. Go to **Project Settings** → **Database**
2. Scroll to **Custom Postgres Config**
3. Add these two settings:
   - **Key**: `app.settings.supabase_url`  
     **Value**: `https://your-project-id.supabase.co`
   - **Key**: `app.settings.service_role_key`  
     **Value**: Your service role key (from Settings → API)

**Method B: Using SQL**
```sql
-- Replace with your actual values
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://dkhqnhhfqcusnzmnqryb.supabase.co';
ALTER DATABASE postgres SET app.settings.service_role_key = 'your-service-role-key-here';

-- Reload configuration
SELECT pg_reload_conf();
```

### 3. Verify pg_net Extension

The trigger uses `pg_net` extension for HTTP requests. Verify it's enabled:

```sql
-- Check if pg_net is installed
SELECT * FROM pg_extension WHERE extname = 'pg_net';

-- If not installed, enable it:
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### 4. Test the Trigger

Generate a test timetable and check the logs:

```sql
-- Check recent trigger executions
SELECT * FROM net.http_request_queue 
ORDER BY created_at DESC 
LIMIT 10;

-- Check for any warnings/errors in logs
-- (View in Supabase Dashboard -> Logs -> Postgres Logs)
```

## How It Works

### Trigger Flow

```
1. Edge Function updates timetable_jobs table
   ↓
2. Sets base_generation_time OR optimization_time
   ↓
3. Database trigger detects the change
   ↓
4. Trigger calls trigger_whatsapp_notifications() function
   ↓
5. Function makes HTTP POST to notify-faculty-timetable edge function
   ↓
6. Edge function sends WhatsApp messages to all faculty
```

### Trigger Conditions

The trigger fires when:
- `base_generation_time` changes from NULL to a value (base timetable completed)
- `base_generation_time` value changes (re-generation)
- `optimization_time` changes from NULL to a value (optimization completed)
- `optimization_time` value changes (re-optimization)

### Error Handling

- If Supabase URL/key is not configured, trigger logs a warning and continues
- If HTTP request fails, trigger logs a warning but doesn't fail the update
- Faculty without phone numbers are skipped (not an error)
- Inactive faculty will also receive notifications (only missing phones are skipped)

## Troubleshooting

### Notifications Not Sending

**Check 1: Verify trigger exists**
```sql
SELECT * FROM pg_trigger WHERE tgname = 'timetable_completion_notify_trigger';
```

**Check 2: Verify configuration**
```sql
SHOW app.settings.supabase_url;
SHOW app.settings.service_role_key;
```

**Check 3: Check HTTP request queue**
```sql
SELECT * FROM net.http_request_queue 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

**Check 4: View PostgreSQL logs**
Go to Supabase Dashboard → Logs → Postgres Logs  
Look for messages like:
- `Base timetable completed for job X, triggering WhatsApp notifications`
- `WhatsApp notification HTTP request sent for job X`

### Common Issues

**Issue**: "Configuration not set" warning in logs  
**Solution**: Run the ALTER DATABASE commands to set URL and service role key

**Issue**: "Extension pg_net does not exist"  
**Solution**: Run `CREATE EXTENSION IF NOT EXISTS pg_net;`

**Issue**: Trigger not firing  
**Solution**: Check if base_generation_time or optimization_time is actually being updated

**Issue**: HTTP requests failing  
**Solution**: Verify service role key is correct and edge function is deployed

## Manual Testing

Test the notification system manually:

```sql
-- Manually trigger a notification (simulates timetable completion)
UPDATE timetable_jobs 
SET base_generation_time = EXTRACT(EPOCH FROM NOW())::INTEGER 
WHERE id = 'your-job-id';

-- Or for optimized:
UPDATE timetable_jobs 
SET optimization_time = EXTRACT(EPOCH FROM NOW())::INTEGER 
WHERE id = 'your-job-id';
```

## Disable Auto-Notifications (if needed)

To temporarily disable automatic notifications:

```sql
-- Disable the trigger
ALTER TABLE timetable_jobs DISABLE TRIGGER timetable_completion_notify_trigger;

-- Re-enable later
ALTER TABLE timetable_jobs ENABLE TRIGGER timetable_completion_notify_trigger;

-- Or drop completely
DROP TRIGGER IF EXISTS timetable_completion_notify_trigger ON timetable_jobs;
```

## Alternative: Frontend-Only Notifications

If you prefer to keep notifications triggered only from the frontend:

1. Don't run the trigger migration
2. Keep the existing real-time listener in `generate-timetable.tsx`
3. Notifications will only send when user is watching the dashboard

## Monitoring

Monitor notification delivery:

1. **Edge Function Logs**: Dashboard → Functions → notify-faculty-timetable → Logs
2. **Postgres Logs**: Dashboard → Logs → Postgres Logs (for trigger execution)
3. **HTTP Request Queue**: Query `net.http_request_queue` table
4. **WATI Dashboard**: Check message delivery status in WATI

## Performance Notes

- Trigger executes asynchronously (doesn't block timetable generation)
- HTTP requests are queued via pg_net
- Each notification takes ~100ms per faculty (rate-limited)
- For 20 faculty, expect ~2-3 seconds total notification time

---

**Status**: Ready for deployment  
**Last Updated**: December 19, 2025
