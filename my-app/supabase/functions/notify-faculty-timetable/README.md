# WhatsApp Faculty Notification - Edge Function

This Supabase Edge Function sends WhatsApp notifications to faculty members when a timetable is generated.

## Features

- ✅ Automatic notification when base/optimized timetable is generated
- ✅ Manual notification button in admin dashboard
- ✅ **Enhanced message template with emojis and formatting**
- ✅ **PDF attachment of individual faculty timetables**
- ✅ **Automatic PDF cleanup in Supabase Storage**
- ✅ Sends timetable summary with weekly schedule and statistics
- ✅ Logs all notifications for audit
- ✅ Uses WATI (WhatsApp Team Inbox) API

## Required Environment Variables

Set these in your Supabase Dashboard → Edge Functions → Secrets:

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `WATI_API_URL` | WATI API endpoint | `https://live-mt-server.wati.io/api/v1/sendTemplateMessage` |
| `WATI_ACCESS_TOKEN` | Your WATI access token | WATI Dashboard → API Docs → Access Token |
| `FRONTEND_URL` | Your app's URL | e.g., `https://yourapp.vercel.app` |
| `SUPABASE_URL` | Your Supabase project URL | Already set automatically |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for database access | Supabase Dashboard → Settings → API |

## WATI WhatsApp Business Setup

### Step 1: Create WATI Account
1. Go to [WATI](https://www.wati.io)
2. Sign up for an account and choose a plan
3. Complete WhatsApp Business verification

### Step 2: Get API Credentials
1. Login to WATI Dashboard
2. Go to **API Docs** section
3. Copy your **Access Token**
4. Note the API URL: `https://live-mt-server.wati.io/api/v1/sendTemplateMessage`

### Step 3: Setup Message Template (Optional)
WATI allows sending messages without pre-approved templates for existing contacts.

## Supabase Storage Setup

### Create Faculty Timetables Bucket
Run the migration script:
```bash
psql -U postgres -d postgres -f scripts/013_storage_faculty_timetables_bucket.sql
```

Or create manually:
1. Go to Supabase Dashboard → Storage
2. Create new bucket: `faculty-timetables`
3. Set to **Public**
4. Allow MIME types: `application/pdf`
5. File size limit: **5MB**

## Database Setup

Run the following SQL to create the notification logs table:

```sql
-- Run scripts/012_notification_logs.sql
```

## Deployment

### Deploy Edge Function

```bash
# From project root
cd my-app

# Login to Supabase
npx supabase login

# Link to your project
npx supabase link --project-ref YOUR_PROJECT_REF

# Deploy the function
npx supabase functions deploy notify-faculty-timetable

# Set secrets
npx supabase secrets set WATI_API_URL=https://live-mt-server.wati.io/api/v1/sendTemplateMessage
npx supabase secrets set WATI_ACCESS_TOKEN=your_wati_access_token
npx supabase secrets set FRONTEND_URL=https://yourapp.com
```

## Usage

### Automatic Notification
Notifications are automatically sent when:
- Base timetable generation completes
- Optimized timetable generation completes

### Manual Notification
Click the "Notify Faculty via WhatsApp" button in the timetable generation dashboard.

### API Call
```typescript
const { data, error } = await supabase.functions.invoke('notify-faculty-timetable', {
  method: 'POST',
  body: {
    jobId: 'uuid-of-timetable-job',
    timetableType: 'base' | 'optimized',
    adminId: 'uuid-of-admin' // optional
  }
})
```

## Response Format

```json
{
  "success": true,
  "message": "Notifications processed: 5 sent, 1 failed, 2 skipped",
  "results": {
    "total": 8,
    "sent": 5,
    "failed": 1,
    "skipped": 2,
    "details": [
      {
        "facultyId": "uuid",
        "facultyName": "Dr. John Doe",
        "phone": "923001234567",
        "status": "sent",
        "messageId": "wamid.xxx"
      }
    ]
  }
}
```

## Message Format

Faculty receive a WhatsApp message with:
- Personal greeting
- Timetable type (base/optimized)
- Summary (total classes, theory, labs)
- Weekly schedule breakdown
- Login prompt

Example:
```
⚠️ *Important Notification*

📅 *TIMETABLE NOTIFICATION*

Dear *Mr. Karthik R*,

Your *Base* timetable has been successfully generated! 🎉

📊 *Your Teaching Schedule:*
• Total Classes: 12
• Subjects: 3
• Days Active: 5

📖 *Sample Schedule:*
Monday 09:00-10:00 - CS101 (CSE-A)
Monday 11:00-12:00 - CS102 (CSE-B) [Lab]
Tuesday 10:00-11:00 - CS101 (CSE-A)

🔗 *Access Your Complete Timetable:*
https://yourapp.com/login/faculty

📄 *Download Your Timetable PDF:*
https://your-storage.supabase.co/.../CSE-F001_base_1234567890.pdf

_Thank you for your attention._

Best regards,
Timetable Management Team
```

## Troubleshooting

### "Invalid phone number" Error
- Phone numbers must be in international format (e.g., 919876543210)
- No + prefix, no spaces, no dashes

### "WATI API Authentication error"
- Check WATI_ACCESS_TOKEN is valid
- Token might have expired - regenerate from WATI Dashboard

### "Storage bucket not found"
- Ensure `faculty-timetables` bucket exists in Supabase Storage
- Run migration script: `013_storage_faculty_timetables_bucket.sql`

### "PDF generation failed"
- Check jsPDF imports are working (esm.sh CDN)
- Verify timetable data is properly formatted

### "WhatsApp message not delivered"
- Ensure faculty phone number is correct and has WhatsApp
- Check WATI account has sufficient credits
- Verify phone number format (91XXXXXXXXXX)

## Cost Considerations

WATI pricing varies by plan. Typical costs:
- Startup Plan: ₹1,999/month (1000 conversations)
- Growth Plan: ₹4,999/month (5000 conversations)
- Check current pricing at [wati.io/pricing](https://www.wati.io/pricing)

## PDF Storage Management

PDFs are automatically cleaned up:
- Old faculty PDFs deleted before new upload
- Each faculty has one PDF per job/timetable type
- Manual cleanup query (optional):

```sql
-- Delete PDFs older than 30 days
DELETE FROM storage.objects 
WHERE bucket_id = 'faculty-timetables' 
AND created_at < NOW() - INTERVAL '30 days';
```

## Logs

View notification logs in Supabase:
```sql
SELECT 
  nl.*,
  f.name as faculty_name,
  f.phone as faculty_phone
FROM notification_logs nl
JOIN faculty f ON f.id = nl.faculty_id
ORDER BY nl.sent_at DESC;
```
