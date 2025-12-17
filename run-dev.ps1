# PowerShell script to run ILP Solver + Next.js app in parallel

Write-Host "========================================"
Write-Host "TimetableScheduling Development Setup"
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$PYTHON_PATH = "C:\Users\Leela Madhava Rao\AppData\Local\Programs\Python\Python313\python.exe"

# Check if Python exists
if (-not (Test-Path $PYTHON_PATH)) {
    Write-Host "ERROR: Python not found at $PYTHON_PATH" -ForegroundColor Red
    Write-Host "Please update PYTHON_PATH in this script."
    exit 1
}

Write-Host "[1/2] Starting ILP Solver Service on http://localhost:8000" -ForegroundColor Yellow
Write-Host ""

# Start ILP Solver in a new PowerShell window
$solverJob = Start-Job -ScriptBlock {
    Set-Location "D:\TimetableScheduling\ilp-solver"
    & "C:\Users\Leela Madhava Rao\AppData\Local\Programs\Python\Python313\python.exe" app.py
}

Write-Host "[1/2] ILP Solver job started (Job ID: $($solverJob.Id))" -ForegroundColor Green
Write-Host "[1/2] Waiting for solver to initialize (3 seconds)..." -ForegroundColor Gray
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "[2/2] Starting Next.js Development Server" -ForegroundColor Yellow
Write-Host ""

# Start Next.js
Set-Location "D:\TimetableScheduling\my-app"
Write-Host "Starting: npm run dev" -ForegroundColor Gray
npm run dev

# Cleanup when user exits
Write-Host ""
Write-Host "Stopping ILP Solver..." -ForegroundColor Yellow
Stop-Job -Job $solverJob
Remove-Job -Job $solverJob
Write-Host "Done!" -ForegroundColor Green
