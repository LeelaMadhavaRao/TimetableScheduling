# ✅ Setup Verification Checklist

Use this checklist to verify everything is correctly configured before testing.

## Prerequisites

- [ ] Python 3.13 installed at `C:\Users\Leela Madhava Rao\AppData\Local\Programs\Python\Python313\python.exe`
- [ ] Node.js/npm installed
- [ ] Supabase project configured with database
- [ ] Internet connection (to download solver dependencies)

## Python Environment

- [ ] Dependencies installed: `pip install -r requirements.txt`
  ```powershell
  cd D:\TimetableScheduling\ilp-solver
  & "C:\Users\Leela Madhava Rao\AppData\Local\Programs\Python\Python313\python.exe" -m pip install -r requirements.txt
  ```

- [ ] OR-Tools installed: `python -c "from ortools.sat.python import cp_model"`
- [ ] FastAPI installed: `python -c "import fastapi"`
- [ ] Uvicorn installed: `python -c "import uvicorn"`

## Node.js Environment

- [ ] npm packages installed:
  ```powershell
  cd D:\TimetableScheduling\my-app
  npm install
  ```

- [ ] Environment variables configured (`.env.local`):
  ```
  NEXT_PUBLIC_SUPABASE_URL=your_url
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
  SUPABASE_SERVICE_ROLE_KEY=your_key
  ```

## ILP Solver Service

- [ ] Service code exists: `D:\TimetableScheduling\ilp-solver\app.py`
- [ ] Service has no syntax errors: `python -m py_compile app.py`
- [ ] Service can start (test): 
  ```powershell
  cd D:\TimetableScheduling\ilp-solver
  & "C:\Users\Leela Madhava Rao\AppData\Local\Programs\Python\Python313\python.exe" app.py
  # Should see: "Uvicorn running on http://0.0.0.0:8000"
  ```

## Edge Function

- [ ] Function code exists: `generate-base-timetable/index.ts`
- [ ] ILP_SOLVER_URL configured: `http://localhost:8000`
- [ ] Function can be deployed:
  ```bash
  npx supabase functions deploy generate-base-timetable --no-verify-jwt
  ```

## Supabase Database

- [ ] Tables exist:
  - [ ] `sections`
  - [ ] `subjects`
  - [ ] `faculty`
  - [ ] `section_subjects`
  - [ ] `classrooms`
  - [ ] `faculty_availability`
  - [ ] `timetable_jobs`
  - [ ] `timetable_base`

- [ ] Sample data populated:
  ```sql
  SELECT COUNT(*) as section_count FROM sections;
  SELECT COUNT(*) as faculty_count FROM faculty;
  SELECT COUNT(*) as classroom_count FROM classrooms;
  ```

## Ports Available

- [ ] Port 8000 available for ILP Solver
  ```powershell
  # Check if port is free
  netstat -ano | findstr :8000
  # Should show nothing if free
  ```

- [ ] Port 3000 available for Next.js
  ```powershell
  netstat -ano | findstr :3000
  ```

- [ ] Port 54321 available for Supabase
  ```powershell
  netstat -ano | findstr :54321
  ```

## File Structure

```
D:\TimetableScheduling\
├── ilp-solver\
│   ├── app.py                  ✓
│   ├── requirements.txt         ✓
│   └── README.md               ✓
├── my-app\
│   ├── app\
│   ├── components\
│   ├── lib\
│   ├── supabase\
│   │   └── functions\
│   │       └── generate-base-timetable\
│   │           └── index.ts    ✓
│   ├── package.json            ✓
│   └── .env.local              ✓
├── DEVELOPMENT.md              ✓
├── TESTING.md                  ✓
├── VIVA_ANSWERS.md             ✓
├── INTEGRATION_COMPLETE.md     ✓
├── README_START_HERE.md        ✓
├── run-dev.bat                 ✓
└── run-dev.ps1                 ✓
```

## Startup Tests

### Test 1: Solver Health Check
```powershell
$response = Invoke-WebRequest -Uri "http://localhost:8000/" -UseBasicParsing
$response.Content
# Should return: {"status":"healthy","service":"ILP Timetable Solver","solver":"OR-Tools CP-SAT"}
```
- [ ] Solver responds with healthy status

### Test 2: Next.js Loads
```powershell
# In terminal with Next.js running
# Open browser to http://localhost:3000
# Check console for errors (F12)
```
- [ ] Page loads without 500 errors
- [ ] UI is interactive

### Test 3: Edge Function Exists
```bash
# In my-app directory
npx supabase functions list
# Should show: generate-base-timetable
```
- [ ] Function appears in list

### Test 4: Database Connected
```sql
-- In Supabase SQL Editor
SELECT COUNT(*) as total_sections FROM sections;
```
- [ ] Returns a number > 0

### Test 5: Full Integration Test
```
1. Click "Generate Timetable" in UI
2. Click "Generate Base Timetable"
3. Wait for completion
4. Check browser console (F12) for errors
5. Check Supabase logs for edge function output
```
- [ ] Timetable generates without error
- [ ] Edge Function logs show "✅ Solver returned status: OPTIMAL"
- [ ] Results visible in database

## Final Checks

- [ ] **ILP Solver**: Responses within 500ms
- [ ] **Validation**: No overlaps detected
- [ ] **Logs**: Clear and informative
- [ ] **Error Handling**: Graceful errors with messages
- [ ] **Database**: Results persisted correctly

## Troubleshooting Checklist

If something fails, check:

| Issue | Check |
|-------|-------|
| Solver won't start | Python path correct? Dependencies installed? |
| Can't reach solver | Is port 8000 free? Firewall blocking? |
| Next.js won't start | Are dependencies installed? npm install done? |
| Edge Function fails | Is ILP_SOLVER_URL env var set? Solver reachable? |
| Timetable has overlaps | Check solver logs for errors. ILP shouldn't generate overlaps. |
| Slow generation | Problem too complex? Check constraints. OR-Tools config? |

## Sign-Off

Once all checks pass:

- [ ] Initial setup complete
- [ ] Services running
- [ ] Integration verified
- [ ] Ready for testing with real data
- [ ] Ready for viva/defense

**Date Completed**: _______________

**Notes/Issues Found**:
```


```

---

**Next Step**: Follow `DEVELOPMENT.md` to start developing!
