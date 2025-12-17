# ILP Timetable Solver Service

This is a dedicated microservice for solving the lab timetable scheduling problem using **OR-Tools CP-SAT** (Constraint Programming).

## Architecture

```
Next.js Frontend
   ↓
Supabase Edge Function (Orchestrator)
   ↓ HTTP
ILP Solver Service (Python + OR-Tools)
   ↓
Supabase Database
```

## Why This Approach?

✅ **Real ILP Solver**: Uses Google OR-Tools, a production-grade constraint solver  
✅ **Handles Complex Constraints**: Labs, continuity, blocks, faculty availability  
✅ **Deterministic & Provably Correct**: Guaranteed optimal or feasible solution  
✅ **Industry Standard**: This is how real SaaS systems work (microservices)  
✅ **Edge Function Stays Lightweight**: Just orchestration, not computation

## Installation

### 1. Install Python Dependencies

```bash
cd ilp-solver
pip install -r requirements.txt
```

### 2. Run the Solver Service

```bash
python app.py
```

The service will start on `http://localhost:8000`

### 3. Configure Supabase Edge Function

Set the environment variable in Supabase:

```bash
# In Supabase Dashboard → Project Settings → Edge Functions
ILP_SOLVER_URL=http://your-solver-service-url:8000
```

For local development:
```bash
# In .env.local or supabase/functions/.env
ILP_SOLVER_URL=http://host.docker.internal:8000
```

## API Endpoints

### `GET /`
Health check endpoint

**Response:**
```json
{
  "status": "healthy",
  "service": "ILP Timetable Solver",
  "solver": "OR-Tools CP-SAT"
}
```

### `POST /solve-labs`
Solve the lab scheduling problem

**Request Body:**
```json
{
  "courses": [
    {
      "sectionId": "...",
      "subjectId": "...",
      "subjectCode": "CS101L",
      "facultyId": "...",
      "studentCount": 30,
      "yearLevel": 1
    }
  ],
  "rooms": [
    {
      "id": "...",
      "name": "Lab 1",
      "capacity": 40
    }
  ],
  "facultyAvailability": [
    {
      "facultyId": "...",
      "slots": [
        {
          "dayOfWeek": 0,
          "startPeriod": 1,
          "endPeriod": 8
        }
      ]
    }
  ],
  "rules": {
    "labPeriods": 4,
    "daysPerWeek": 6,
    "periodsPerDay": 8
  }
}
```

**Response (Success):**
```json
{
  "success": true,
  "status": "OPTIMAL",
  "message": "Successfully scheduled 10 labs",
  "assignments": [
    {
      "sectionId": "...",
      "subjectId": "...",
      "day": 0,
      "startPeriod": 1,
      "endPeriod": 4,
      "roomId": "..."
    }
  ],
  "solveTimeMs": 245
}
```

**Response (Infeasible):**
```json
{
  "success": false,
  "status": "INFEASIBLE",
  "message": "No feasible solution exists. Check constraints.",
  "assignments": [],
  "solveTimeMs": 180
}
```

## Constraints Implemented

1. **Each lab scheduled exactly once** - Every lab course gets one 4-period block
2. **Room capacity** - Only rooms with sufficient capacity are considered
3. **Room non-overlap** - No double-booking of rooms per period
4. **Section non-overlap** - Students can't be in two places at once
5. **Faculty non-overlap** - Faculty can't teach two classes simultaneously
6. **Faculty availability** - Respects declared availability windows
7. **Saturday afternoon rule** - Only Year 1 students can have Saturday afternoon labs

## Deployment Options

### Option 1: Render.com (Free Tier)
```bash
# Deploy as Web Service
# Set Build Command: pip install -r requirements.txt
# Set Start Command: python app.py
```

### Option 2: Railway.app
```bash
railway login
railway init
railway up
```

### Option 3: Fly.io
```bash
fly launch
fly deploy
```

### Option 4: Self-Hosted (Cloud VM)
```bash
# On any Linux server
nohup python app.py > solver.log 2>&1 &
```

## For Your Viva/Defense

**Question:** "How does your timetable generation work?"

**Answer:** "The system uses a microservices architecture where the ILP solver is a dedicated Python service using Google OR-Tools CP-SAT. The Supabase Edge Function acts as an orchestrator - it fetches data, serializes the problem as JSON, calls the solver API, and persists results. This separation of concerns allows us to use industrial-strength constraint programming while keeping the edge function lightweight."

This is the **correct industry approach** for optimization problems in cloud applications.
