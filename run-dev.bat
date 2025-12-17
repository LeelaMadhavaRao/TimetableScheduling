@echo off
REM Development helper script to run ILP Solver + Next.js app

echo.
echo ========================================
echo TimetableScheduling Development Setup
echo ========================================
echo.

REM Python executable path
set PYTHON_PATH=C:\Users\Leela Madhava Rao\AppData\Local\Programs\Python\Python313\python.exe

REM Check if Python exists
if not exist "%PYTHON_PATH%" (
    echo ERROR: Python not found at %PYTHON_PATH%
    echo Please update PYTHON_PATH in this script.
    pause
    exit /b 1
)

echo [1/2] Starting ILP Solver Service...
echo.
cd /d D:\TimetableScheduling\ilp-solver
start "ILP Solver (Port 8000)" "%PYTHON_PATH%" app.py

echo [1/2] Waiting for ILP Solver to start (5 seconds)...
timeout /t 5 /nobreak

echo.
echo [2/2] Starting Next.js Development Server...
echo.
cd /d D:\TimetableScheduling\my-app
call npm run dev

pause
