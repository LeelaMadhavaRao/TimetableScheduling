# Timetable Scheduling System - Architecture Overview

## Introduction

The Timetable Scheduling System is a comprehensive solution for generating optimal class schedules for educational institutions. It uses a hybrid approach combining **Integer Linear Programming (ILP)** for constraint satisfaction and **Genetic Algorithm (GA)** for optimization.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT (Next.js Frontend)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Admin     │  │  Faculty    │  │  Generate   │  │  Timetable Viewer   │ │
│  │   Panel     │  │  Dashboard  │  │  Timetable  │  │                     │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      NEXT.JS API ROUTES (Edge Functions)                     │
│  ┌──────────────────────────┐     ┌──────────────────────────┐              │
│  │   /api/timetable/        │     │   /api/timetable/        │              │
│  │   generate-base          │     │   optimize               │              │
│  │   (Base Generation)      │     │   (GA Optimization)      │              │
│  └────────────┬─────────────┘     └────────────┬─────────────┘              │
└───────────────┼────────────────────────────────┼────────────────────────────┘
                │                                │
                ▼                                ▼
┌───────────────────────────────┐  ┌───────────────────────────────────────────┐
│     LOCAL ILP GENERATOR       │  │            GA OPTIMIZER                    │
│   (lib/ilp-generator.ts)      │  │        (lib/ga-optimizer.ts)              │
│   Greedy Constraint Solver    │  │   Population-based Optimization           │
└───────────────────────────────┘  └───────────────────────────────────────────┘
                │
                ▼ (Fallback for complex problems)
┌─────────────────────────────────────────────────────────────────────────────┐
│                     SUPABASE EDGE FUNCTION                                   │
│              (generate-base-timetable/index.ts)                              │
│       Advanced Scheduling with External ILP Solver Support                   │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   EXTERNAL ILP SOLVER SERVICE                                │
│              (Python OR-Tools CP-SAT on Render)                              │
│   URL: https://timetablescheduling.onrender.com                              │
│   ┌───────────────────┐    ┌───────────────────┐                            │
│   │   /solve-labs     │    │   /solve-theory   │                            │
│   │   (Lab Scheduling)│    │(Theory Scheduling)│                            │
│   └───────────────────┘    └───────────────────┘                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SUPABASE DATABASE                                     │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐│
│   │  faculty    │  │  subjects   │  │  sections   │  │  timetable_base     ││
│   │  classrooms │  │  section_   │  │  timetable  │  │  timetable_optimized││
│   │  departments│  │  subjects   │  │  _jobs      │  │                     ││
│   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Frontend (Next.js App Router)
- **Admin Panel**: Manage faculty, subjects, classrooms, sections
- **Generate Page**: Trigger timetable generation with progress tracking
- **Timetable Viewer**: Display generated schedules by section/faculty

### 2. API Routes
- **`/api/timetable/generate-base`**: Generates initial valid timetable
- **`/api/timetable/optimize`**: Optimizes timetable using GA

### 3. Local Schedulers (lib/)
- **`ilp-generator.ts`**: Greedy constraint-based scheduler
- **`ga-optimizer.ts`**: Genetic algorithm for optimization

### 4. Supabase Edge Function
- **`generate-base-timetable/index.ts`**: Advanced scheduler with:
  - Multi-start greedy algorithm
  - External ILP solver integration
  - Intelligent course prioritization

### 5. External ILP Solver (Python)
- **`ilp-solver/app.py`**: OR-Tools CP-SAT solver
- Hosted on Render as microservice
- Endpoints: `/solve-labs`, `/solve-theory`

## Data Flow

### Phase 1: Base Timetable Generation
```
1. User clicks "Generate Timetable"
2. Frontend calls /api/timetable/generate-base
3. API fetches courses, rooms, faculty from Supabase
4. ILP Generator schedules:
   a. Labs first (4 consecutive periods, morning preferred)
   b. Theory courses (distributed across days)
5. Results saved to timetable_base table
```

### Phase 2: Optimization
```
1. After base generation, user clicks "Optimize"
2. Frontend calls /api/timetable/optimize
3. GA Optimizer runs for 100 generations:
   a. Initialize population from base schedule
   b. Evaluate fitness (gaps, balance, preferences)
   c. Selection, crossover, mutation
   d. Keep best solution
4. Optimized schedule saved to timetable_optimized table
```

## Technology Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 16, React, TypeScript, Tailwind CSS |
| Backend API | Next.js API Routes |
| Database | Supabase (PostgreSQL) |
| Authentication | Custom auth with bcrypt |
| Local Scheduler | TypeScript (Greedy/Constraint-based) |
| External Solver | Python, FastAPI, OR-Tools CP-SAT |
| Hosting | Vercel (Frontend), Render (Solver), Supabase (DB) |

## Key Data Types

```typescript
// Day representation (0 = Monday, 5 = Saturday)
type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5

// Period representation (1-8 periods per day)
type Period = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

// Subject types
type SubjectType = "theory" | "lab"

// Room types
type RoomType = "lab" | "theory"

// Timetable slot structure
interface TimetableSlot {
  sectionId: string
  subjectId: string
  facultyId: string
  classroomId: string
  day: DayOfWeek
  startPeriod: Period
  endPeriod: Period
}
```

## Scheduling Rules

| Rule | Description |
|------|-------------|
| Lab Duration | 4 consecutive periods (3 hours) |
| Theory Max/Day | 2 periods per subject per day |
| Saturday | Morning only (except Year 1 labs) |
| Period Duration | 45 minutes each |
| Lunch Break | 12:00 PM - 1:30 PM (between P4 and P5) |
| Room Capacity | Must be ≥ 85% of student count |

## Multi-Tenant Support

The system supports multiple administrators (institutions) with data isolation:
- All tables have `created_by` column
- Row Level Security (RLS) enforces tenant isolation
- Each admin sees only their data

## Performance Characteristics

| Operation | Typical Time |
|-----------|--------------|
| Lab Scheduling (ILP) | 1-5 seconds |
| Theory Scheduling (Greedy) | <1 second |
| GA Optimization (100 generations) | 2-10 seconds |
| Total Generation | 5-15 seconds |
