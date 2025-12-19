# Registration Request System - Setup Guide

## Overview
This system allows potential users to request Timetable Administrator access through a contact form on the homepage. System administrators can review, approve, or reject these requests.

## 🗄️ Database Setup

### Step 1: Run the SQL Migration
Execute the following SQL script in your Supabase SQL Editor:

```bash
# Location: my-app/scripts/011_registration_requests.sql
```

This script creates:
- `registration_requests` table
- RPC functions for approve/reject operations
- Necessary indexes and triggers

### Step 2: Verify Tables
After running the script, verify these tables exist:
- `registration_requests`
- `admin_users` (already exists)
- `timetable_administrators` (already exists)
- `user_sessions` (already exists)

## 🚀 How It Works

### For Regular Users (Homepage)
1. Visit homepage (`http://localhost:3000`)
2. Click **"Request Admin Access"** button
3. Fill out the registration form:
   - Full Name
   - Email
   - Phone (optional)
   - Institution Name (optional)
   - Username
   - Password
   - Confirmation Password
   - Message (optional)
4. Click **"Submit Request"**
5. Wait for approval notification

### For System Administrators
1. Login as System Admin at `/login/admin`
2. Go to Dashboard
3. Click **"Registration Requests"** button in header
4. View pending requests
5. Review request details
6. **Approve**: Creates new Timetable Administrator account
7. **Reject**: Provide rejection reason (user will see this)

## 📋 Features

### Contact Form
- **Location**: Homepage (always visible)
- **Validation**:
  - Email format validation
  - Username format (3-50 alphanumeric + underscore)
  - Password minimum 6 characters
  - Password confirmation match
  - Duplicate check (username/email)

### Admin Dashboard
- **Location**: `/dashboard/admin/registration-requests`
- **Features**:
  - Tabs: Pending, Approved, Rejected
  - Real-time status updates
  - Approve/Reject actions
  - Reason tracking for rejections
  - Reviewer audit trail

### API Endpoints
- `POST /api/registration-request` - Submit request
- `GET /api/registration-request?status=pending` - Get requests
- `POST /api/registration-request/approve` - Approve request
- `POST /api/registration-request/reject` - Reject request

## 🔒 Security Features

1. **Password Hashing**: Passwords hashed using PostgreSQL `hash_password()` RPC
2. **Duplicate Prevention**: Checks for existing usernames/emails
3. **Role-Based Access**: Only system admins can approve/reject
4. **Audit Trail**: Tracks who approved/rejected and when
5. **Input Validation**: Client and server-side validation

## 🎨 UI Components

### Created Files
- `components/registration-request-dialog.tsx` - Contact form dialog
- `app/dashboard/admin/registration-requests/page.tsx` - Admin review page
- `app/api/registration-request/route.ts` - Submit & list API
- `app/api/registration-request/approve/route.ts` - Approve API
- `app/api/registration-request/reject/route.ts` - Reject API

### Modified Files
- `app/page.tsx` - Added registration button to homepage
- `app/dashboard/admin/page.tsx` - Added navigation to requests page

## 📊 Database Schema

### `registration_requests` Table
```sql
- id: UUID (PK)
- full_name: VARCHAR(100)
- email: VARCHAR(100)
- phone: VARCHAR(20)
- institution_name: VARCHAR(200)
- username: VARCHAR(50)
- requested_password: VARCHAR(255) -- Hashed
- message: TEXT
- status: ENUM (pending, approved, rejected)
- reviewed_by: UUID (FK -> admin_users.id)
- reviewed_at: TIMESTAMP
- rejection_reason: TEXT
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

## 🧪 Testing Steps

### Test 1: Submit Registration Request
1. Go to `http://localhost:3000`
2. Click "Request Admin Access"
3. Fill form with valid data
4. Submit
5. ✅ Should see success message

### Test 2: Duplicate Prevention
1. Submit same username again
2. ✅ Should show error: "Username already exists"

### Test 3: Admin Approval
1. Login as system admin
2. Go to Registration Requests
3. Click "Approve" on a pending request
4. ✅ Should create new timetable admin
5. ✅ Check `timetable_administrators` table

### Test 4: Admin Rejection
1. Login as system admin
2. Click "Reject" on a pending request
3. Enter rejection reason
4. ✅ Status should update to rejected
5. ✅ Reason should be saved

### Test 5: Approved User Login
1. Use approved username/password
2. Go to `/login/timetable-admin`
3. ✅ Should login successfully
4. ✅ Should access `/admin` dashboard

## 🐛 Troubleshooting

### Issue: "hash_password function not found"
**Solution**: Ensure you have the `hash_password` RPC function in your database:
```sql
-- Should already exist in your auth schema
-- If not, check scripts/007_authentication_schema.sql
```

### Issue: "Unauthorized" error when approving
**Solution**: Ensure you're logged in as a **system admin**, not timetable admin

### Issue: Form not showing on homepage
**Solution**: 
1. Check browser console for errors
2. Verify `registration-request-dialog.tsx` was created
3. Check `app/page.tsx` imports the component

### Issue: API 500 error
**Solution**:
1. Check Supabase logs
2. Verify all tables exist
3. Check RPC functions are created
4. Verify environment variables in `.env.local`

## 📝 Environment Variables

No new environment variables needed! Uses existing:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## 🎯 Future Enhancements

- Email notifications on approval/rejection
- Bulk approve/reject
- Request expiration (auto-reject after 30 days)
- Analytics dashboard (requests per week)
- Custom rejection templates
- User request history

## ✅ Complete Setup Checklist

- [ ] Run `011_registration_requests.sql` in Supabase
- [ ] Verify all API routes exist in `app/api/registration-request/`
- [ ] Verify component `registration-request-dialog.tsx` exists
- [ ] Verify admin page exists at `app/dashboard/admin/registration-requests/page.tsx`
- [ ] Test form submission on homepage
- [ ] Test admin approval flow
- [ ] Test admin rejection flow
- [ ] Test approved user can login

## 🎉 Success!

Once all steps are complete, you have a fully functional registration request system where:
1. Users can request access from homepage
2. Admins can review and approve/reject
3. Approved users get instant access
4. Full audit trail is maintained
