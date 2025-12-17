#!/usr/bin/env pwsh
<#
.SYNOPSIS
Quick Reference: ILP Timetable Scheduler - Development Commands

.DESCRIPTION
Essential commands for running and testing the Timetable Scheduling system
#>

# ========================================
# QUICK START
# ========================================

Write-Host "
╔════════════════════════════════════════════════════════════════╗
║     Timetable Scheduler - Quick Command Reference             ║
╚════════════════════════════════════════════════════════════════╝
" -ForegroundColor Cyan

# Display menu
Write-Host @"

CHOOSE ONE:

  1. START BOTH SERVICES (Easiest)
     C:\run-dev.bat
     -- or --
     D:\TimetableScheduling\run-dev.ps1

  2. MANUAL SETUP (Two Windows)
  
     Terminal 1 - ILP Solver:
     cd D:\TimetableScheduling\ilp-solver
     & "C:\Users\Leela Madhava Rao\AppData\Local\Programs\Python\Python313\python.exe" app.py
     
     Terminal 2 - Next.js:
     cd D:\TimetableScheduling\my-app
     npm run dev

  3. TEST SOLVER DIRECTLY
     `$response = Invoke-WebRequest -Uri http://localhost:8000/ -UseBasicParsing
     `$response.Content

  4. VIEW LOGS
     
     Edge Function:
     - Supabase Dashboard → Functions → generate-base-timetable → Logs
     
     ILP Solver (Terminal output):
     - Look for "[Solver Service]" messages
     
     Browser Console:
     - Press F12 in browser

" -ForegroundColor Green

# ========================================
# STOP SERVICES
# ========================================

Write-Host @"

STOP SERVICES:

  Kill ILP Solver (Port 8000):
  netstat -ano | findstr :8000
  taskkill /PID <PID> /F

  Stop Next.js:
  - Press Ctrl+C in Next.js terminal

" -ForegroundColor Yellow

# ========================================
# TROUBLESHOOTING
# ========================================

Write-Host @"

TROUBLESHOOTING:

  Port 8000 Already in Use?
  netstat -ano | findstr :8000
  taskkill /PID <PID> /F

  Python Not Found?
  Test-Path "C:\Users\Leela Madhava Rao\AppData\Local\Programs\Python\Python313\python.exe"

  Reinstall Python Dependencies?
  cd D:\TimetableScheduling\ilp-solver
  & "C:\Users\Leela Madhava Rao\AppData\Local\Programs\Python\Python313\python.exe" -m pip install -r requirements.txt

  Clear Next.js Cache?
  rm -r D:\TimetableScheduling\my-app\.next

" -ForegroundColor Magenta

# ========================================
# IMPORTANT URLS & PORTS
# ========================================

Write-Host @"

IMPORTANT SERVICES:

  🌐 Next.js App:        http://localhost:3000
  🔧 ILP Solver:          http://localhost:8000
  📊 Supabase Studio:     http://localhost:54321

" -ForegroundColor Cyan

# ========================================
# VIVA ANSWER (FOR YOU!)
# ========================================

Write-Host @"

FOR YOUR VIVA - SAY THIS:

"The system uses a microservices architecture. The ILP solver is 
a dedicated Python service using Google OR-Tools CP-SAT. The 
Supabase Edge Function acts as an orchestrator - it fetches data, 
serializes the problem as JSON, calls the solver API, and 
persists results. This separation of concerns allows us to use 
industrial-strength constraint programming while keeping the 
edge function lightweight. This is the standard approach used by 
real SaaS systems."

" -ForegroundColor Green

Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
