# WhatsApp Faculty Notification - Edge Function

This Supabase Edge Function sends WhatsApp notifications to faculty members when a timetable is generated.

## Features

- ✅ Automatic notification when base/optimized timetable is generated
- ✅ Manual notification button in admin dashboard
- ✅ Sends timetable summary with weekly schedule
- ✅ Logs all notifications for audit
- ✅ Uses WhatsApp Business Meta API

## Required Environment Variables

Set these in your Supabase Dashboard → Edge Functions → Secrets:

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `WHATSAPP_PHONE_NUMBER_ID` | Your WhatsApp Business phone number ID | Meta Business Manager → WhatsApp Manager → Phone Numbers |
| `WHATSAPP_ACCESS_TOKEN` | Permanent access token for Meta API | Meta Developer Portal → Your App → WhatsApp → API Setup |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | WhatsApp Business Account ID | Meta Business Manager → Business Settings |
| `SUPABASE_URL` | Your Supabase project URL | Already set automatically |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for database access | Supabase Dashboard → Settings → API |
| `APP_URL` | Your app's URL | e.g., `https://yourapp.vercel.app` |

## Meta WhatsApp Business Setup

### Step 1: Create Meta Business Account
1. Go to [Meta Business Suite](https://business.facebook.com)
2. Create a business account if you don't have one

### Step 2: Create Meta Developer App
1. Go to [Meta for Developers](https://developers.facebook.com)
2. Create a new app → Select "Business" type
3. Add "WhatsApp" product to your app

### Step 3: Get API Credentials
1. In your app, go to WhatsApp → API Setup
2. Note down:
   - **Phone Number ID**: Under "From" section
   - **WhatsApp Business Account ID**: In the URL or settings
3. Generate a **Permanent Access Token**:
   - Go to Business Settings → Users → System Users
   - Create a system user
   - Generate token with `whatsapp_business_messaging` permission

### Step 4: Create Message Template (Required for first contact)
1. Go to WhatsApp Manager → Message Templates
2. Create a new template named `timetable_notification`:
   ```
   Template Name: timetable_notification
   Category: Utility
   Language: English
   
   Body:
   Dear {{1}},
   
   Your {{2}} timetable has been generated successfully!
   
   Please login to view your complete schedule and download the PDF.
   
   Best regards,
   Timetable Scheduling System
   ```
3. Submit for approval (takes 24-48 hours)

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
npx supabase secrets set WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
npx supabase secrets set WHATSAPP_ACCESS_TOKEN=your_access_token
npx supabase secrets set WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id
npx supabase secrets set APP_URL=https://yourapp.com
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
📅 *TIMETABLE NOTIFICATION*

Dear *Dr. John Smith*,

Your BASE timetable has been generated.

📊 *Summary:*
• Total Classes: 12
• Theory: 8
• Lab: 4

📆 *Weekly Schedule:*

*Monday:*
  P1: CS101 (CSE-A) @ CR-101
  P3: CS102 (CSE-B) @ CR-102 [Lab]

*Tuesday:*
  P2: CS101 (CSE-A) @ CR-101
  ...

🔗 Login to view full timetable and download PDF.

_Generated on 12/19/2024, 3:45:00 PM_
```

## Troubleshooting

### "Template not found" Error
- Ensure `timetable_notification` template is created and approved
- Check template name matches exactly

### "Invalid phone number" Error
- Phone numbers must be in international format (e.g., 923001234567)
- No + prefix, no spaces, no dashes

### "Authentication error"
- Check WHATSAPP_ACCESS_TOKEN is valid
- Token might have expired - regenerate if needed

### "User not opted in"
- Users must first message your WhatsApp Business number
- Or use approved template messages for first contact

## Cost Considerations

WhatsApp Business API charges per conversation:
- Business-initiated conversations: ~$0.05-0.15 per message
- User-initiated (within 24h window): Free
- Template messages: Charged as business-initiated

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
