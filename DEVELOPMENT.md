# Development Setup Guide

This guide explains how to run the Timetable Scheduling system during development.

## System Architecture

```
Your Browser
    ↓
Next.js Development Server (http://localhost:3000)
    ↓
Supabase Edge Function (Orchestrator)
    ↓ HTTP (localhost:8000)
ILP Solver Service (Python + OR-Tools)
    ↓
Supabase Database
```

## Quick Start (Windows)

### Option 1: Batch Script (Easiest)
```powershell
D:\TimetableScheduling\run-dev.bat
```

This will:
1. Start the ILP Solver Service on `http://localhost:8000`
2. Start the Next.js dev server on `http://localhost:3000`
3. Open browser automatically

### Option 2: PowerShell Script
```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
D:\TimetableScheduling\run-dev.ps1
```

### Option 3: Manual Setup (Two Terminal Windows)

**Terminal 1 - ILP Solver Service:**
```powershell
cd D:\TimetableScheduling\ilp-solver
& "C:\Users\Leela Madhava Rao\AppData\Local\Programs\Python\Python313\python.exe" app.py
```

**Terminal 2 - Next.js App:**
```powershell
cd D:\TimetableScheduling\my-app
npm run dev
```

## Verify Services Are Running

### ILP Solver Health Check
```powershell
Invoke-WebRequest -Uri "http://localhost:8000/" -UseBasicParsing | ConvertTo-Json
```

Expected output:
```json
{
  "status": "healthy",
  "service": "ILP Timetable Solver",
  "solver": "OR-Tools CP-SAT"
}
```

### Next.js Application
Open browser to `http://localhost:3000`

## Environment Variables

### For Local Development
The Edge Function automatically uses: `ILP_SOLVER_URL=http://localhost:8000`

### For Production Deployment
Set in Supabase Dashboard → Project Settings → Environment Variables:
```
ILP_SOLVER_URL=https://your-solver-service-url.com
```

## Ports Used

| Service | Port | URL |
|---------|------|-----|
| ILP Solver | 8000 | http://localhost:8000 |
| Next.js | 3000 | http://localhost:3000 |
| Supabase (local) | 54321 | http://localhost:54321 |

## Troubleshooting

### Port 8000 Already in Use
```powershell
# Find process using port 8000
netstat -ano | findstr :8000

# Kill process by PID (replace XXXX with PID)
taskkill /PID XXXX /F

# Or use a different port (modify app.py, line 254)
```

### Python Not Found
Make sure Python is installed at:
```
C:\Users\Leela Madhava Rao\AppData\Local\Programs\Python\Python313\python.exe
```

To check:
```powershell
Test-Path "C:\Users\Leela Madhava Rao\AppData\Local\Programs\Python\Python313\python.exe"
```

### ILP Solver Crashes
Check logs for:
```powershell
# Look for errors in Terminal 1 (where solver is running)
# Common issues:
# - Missing dependencies: pip install -r requirements.txt
# - Port conflict: change port in app.py
# - Memory issues: check available RAM for constraint solver
```

### Next.js App Can't Connect to Solver
1. Verify solver is running: http://localhost:8000/
2. Check Edge Function logs in Supabase Dashboard
3. Verify ILP_SOLVER_URL environment variable is set

## Development Workflow

1. **Make changes** to app code or Edge Function
2. **Next.js auto-reloads** on file changes
3. **Test** in browser at http://localhost:3000
4. **View logs**:
   - Browser Console: F12
   - Terminal 1: ILP Solver logs
   - Terminal 2: Next.js dev server logs
   - Supabase Dashboard → Edge Functions → Logs

## For Supabase Edge Function Debugging

When running locally:
1. The Edge Function runs in Deno
2. Set environment variable for local testing:
   ```bash
   export ILP_SOLVER_URL="http://host.docker.internal:8000"  # macOS/Linux with Docker
   export ILP_SOLVER_URL="http://localhost:8000"  # Windows
   ```

## Next Steps

See [ILP Solver README](./ilp-solver/README.md) for solver-specific documentation.
