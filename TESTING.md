# Testing the Integrated System

This guide shows how to test the complete timetable scheduling system end-to-end.

## Prerequisites

✅ ILP Solver is running on `http://localhost:8000`
✅ Next.js dev server is running on `http://localhost:3000`
✅ Supabase is configured and connected

## Step 1: Test ILP Solver Directly

### Health Check
```powershell
$response = Invoke-WebRequest -Uri "http://localhost:8000/" -UseBasicParsing
$response.Content | ConvertFrom-Json | ConvertTo-Json
```

Expected response:
```json
{
  "status": "healthy",
  "service": "ILP Timetable Solver",
  "solver": "OR-Tools CP-SAT"
}
```

### Test Lab Scheduling
```powershell
$payload = @{
    courses = @(
        @{
            sectionId = "s1"
            sectionName = "CS 1A"
            subjectId = "sub1"
            subjectCode = "CS101L"
            facultyId = "f1"
            facultyCode = "DR-01"
            studentCount = 30
            yearLevel = 1
        }
    )
    rooms = @(
        @{
            id = "r1"
            name = "Lab 1"
            capacity = 40
        },
        @{
            id = "r2"
            name = "Lab 2"
            capacity = 40
        }
    )
    facultyAvailability = @(
        @{
            facultyId = "f1"
            slots = @(
                @{
                    dayOfWeek = 0
                    startPeriod = 1
                    endPeriod = 8
                }
            )
        }
    )
    rules = @{
        labPeriods = 4
        daysPerWeek = 6
        periodsPerDay = 8
    }
}

$response = Invoke-WebRequest -Uri "http://localhost:8000/solve-labs" `
  -Method Post `
  -ContentType "application/json" `
  -Body ($payload | ConvertTo-Json) `
  -UseBasicParsing

$response.Content | ConvertFrom-Json | ConvertTo-Json
```

Expected response (success):
```json
{
  "success": true,
  "status": "OPTIMAL",
  "message": "Successfully scheduled 1 labs",
  "assignments": [
    {
      "sectionId": "s1",
      "subjectId": "sub1",
      "day": 0,
      "startPeriod": 1,
      "endPeriod": 4,
      "roomId": "r1"
    }
  ],
  "solveTimeMs": 245
}
```

## Step 2: Test Edge Function with Real Data

### Via Supabase Dashboard

1. Go to: **Supabase Dashboard → Functions → generate-base-timetable**
2. Click **Test**
3. Check **Logs** tab for execution details

### Expected Log Output

```
[Edge Function] Starting timetable generation with ILP microservice
[Edge Function] Total courses to schedule: 10
[Edge Function] ILP Solver URL: http://localhost:8000
[Edge Function] Phase 1: Calling ILP solver service for 5 lab courses
[Solver Service] Sending request to http://localhost:8000/solve-labs
[Solver Service] Payload size: 2845 bytes
[Solver Service] ✅ Solver returned status: OPTIMAL
[Solver Service] Solve time: 245 ms
[Solver Service] Received 5 lab assignments
[Edge Function] ✅ Lab ILP scheduling complete: 5 labs successfully scheduled
[Edge Function] Phase 2: Scheduling 5 theory courses
...
[Edge Function] Generation complete. Total slots: 45
```

## Step 3: Test from Next.js UI

1. Open http://localhost:3000 in browser
2. Navigate to **Generate Timetable** section
3. Click **Generate Base Timetable**
4. Wait for completion
5. Check **Logs** for output:
   - Browser Console (F12)
   - Supabase Dashboard → Edge Function Logs

## Step 4: Verify Database

### Check Generated Timetable
```sql
SELECT * FROM timetable_base WHERE job_id = 'your_job_id' LIMIT 10;
```

### Check for Overlaps
```sql
-- Faculty overlaps
SELECT 
  t1.faculty_id, 
  t1.day_of_week, 
  t1.start_period,
  COUNT(*) as overlap_count
FROM timetable_base t1
JOIN timetable_base t2 
  ON t1.faculty_id = t2.faculty_id 
  AND t1.day_of_week = t2.day_of_week
  AND t1.id < t2.id
  AND (
    (t1.start_period <= t2.start_period AND t2.start_period <= t1.end_period) OR
    (t1.start_period <= t2.end_period AND t2.end_period <= t1.end_period)
  )
GROUP BY t1.faculty_id, t1.day_of_week, t1.start_period;
```

## Step 5: Performance Testing

### Time Tracking

The system logs solve times:
- **Phase 1 (ILP Solver)**: Solve time in milliseconds
- **Phase 2 (Theory Courses)**: Handled sequentially
- **Total**: End-to-end generation time

### Check Logs
```bash
# Terminal with ILP Solver
# Look for timing information like:
# INFO: Solver completed in 245ms
# INFO: Found 5 assignments

# Terminal with Next.js
# Look for:
# [Edge Function] Generation completed in 1234ms
```

## Troubleshooting

### ILP Solver Returns 400 Error
```json
{
  "success": false,
  "status": "INFEASIBLE",
  "message": "No feasible solution exists."
}
```
**Solution**: Problem is infeasible - check constraints
- Faculty availability matches demands?
- Enough lab rooms for all courses?
- Room capacity sufficient for all sections?

### ILP Solver Returns 500 Error
```
{
  "error": "Internal server error"
}
```
**Solution**: Check ILP Solver logs (Terminal 1) for:
- Python errors
- Memory issues
- Invalid input format

### Edge Function Timeout (>60 seconds)
**Solution**: ILP problem too complex
- Reduce number of courses
- Simplify constraints
- Increase server resources

### Connection Refused to localhost:8000
```
[Solver Service] Request failed: fetch failed
```
**Solution**: 
1. Check ILP Solver is running: `netstat -ano | findstr :8000`
2. Verify it's responding: `http://localhost:8000/`
3. Restart if needed

## Next Steps

- ✅ Basic integration working
- 🔄 Run with real production data
- 📊 Monitor performance metrics
- 🚀 Deploy solver to cloud (Render.com, Railway, Fly.io)

See [Deployment Guide](./DEPLOYMENT.md) for cloud deployment steps.
