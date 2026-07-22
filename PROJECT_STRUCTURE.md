# Project Structure & File Guide

This document explains the complete project structure and what each file does.

## 📂 Root Directory: `D:\TimetableScheduling\`

```
TimetableScheduling/
├── 📄 README_START_HERE.md              ⭐ START HERE - Overview & quick setup
├── 📄 DEVELOPMENT.md                    How to run services during development
├── 📄 TESTING.md                        Step-by-step testing procedures
├── 📄 VIVA_ANSWERS.md                   Defense talking points & Q&A
├── 📄 INTEGRATION_COMPLETE.md           Architecture explanation
├── 📄 SETUP_VERIFICATION.md             Checklist to verify setup
├── 📄 QUICK-START.ps1                   Command reference (PowerShell)
├── 📄 run-dev.bat                       One-click startup (Windows batch)
├── 📄 run-dev.ps1                       Startup script (PowerShell)
│
├── 📁 ilp-solver/                       🔧 MAIN SOLVER SERVICE
│   ├── 📄 app.py                        Core solver using OR-Tools CP-SAT
│   ├── 📄 requirements.txt               Python dependencies
│   └── 📄 README.md                      Solver service documentation
│
└── 📁 my-app/                           💻 NEXT.JS FRONTEND + BACKEND
    ├── 📄 package.json                  Node dependencies & scripts
    ├── 📄 tsconfig.json                 TypeScript config
    ├── 📄 next.config.ts                Next.js config
    ├── 📄 .env.local                    Environment variables (local)
    │
    ├── 📁 app/                          Next.js App Router
    │   ├── 📄 layout.tsx                Root layout with navbar
    │   ├── 📄 page.tsx                  Home page
    │   ├── 📄 globals.css               Global styles
    │   │
    │   ├── 📁 admin/                    Admin section
    │   │   ├── 📄 layout.tsx
    │   │   ├── 📄 page.tsx              Admin dashboard
    │   │   ├── 📁 classrooms/           Manage rooms
    │   │   ├── 📁 faculty/              Manage teachers
    │   │   ├── 📁 generate/             Generate timetable form
    │   │   ├── 📁 sections/             Manage classes
    │   │   └── 📁 subjects/             Manage courses
    │   │
    │   ├── 📁 api/                      Backend API routes
    │   │   └── 📁 timetable/
    │   │       ├── 📁 generate-base/    Generate base timetable (calls solver)
    │   │       └── 📁 optimize/         Optimize with GA
    │   │
    │   └── 📁 timetable/                Public timetable viewer
    │       └── 📄 page.tsx              Display generated timetable
    │
    ├── 📁 components/                   React Components
    │   ├── 📄 generate-timetable.tsx     ← Calls Edge Function
    │   ├── 📄 timetable-viewer.tsx       Display results
    │   ├── 📄 progress.tsx               Progress indicator
    │   ├── 📄 stats-card.tsx             Statistics display
    │   ├── 📄 classroom-dialog.tsx       Add/edit rooms
    │   ├── 📄 faculty-dialog.tsx         Add/edit teachers
    │   ├── 📄 section-dialog.tsx         Add/edit classes
    │   ├── 📄 subject-dialog.tsx         Add/edit courses
    │   ├── 📄 availability-dialog.tsx    Set faculty availability
    │   ├── 📄 section-subjects-dialog.tsx Assign courses to classes
    │   ├── 📄 *-list.tsx                 List components (5 files)
    │   ├── 📄 tabs.tsx                   Tab navigation
    │   └── 📁 ui/                       shadcn UI components
    │       ├── 📄 button.tsx
    │       ├── 📄 dialog.tsx
    │       ├── 📄 input.tsx
    │       ├── 📄 select.tsx
    │       ├── 📄 table.tsx
    │       └── ...
    │
    ├── 📁 lib/                          TypeScript utilities
    │   ├── 📄 client.ts                 Supabase client (browser)
    │   ├── 📄 server.ts                 Supabase client (server)
    │   ├── 📄 database.ts               Database queries
    │   ├── 📄 timetable.ts              Timetable logic
    │   ├── 📄 ga-optimizer.ts           Genetic Algorithm code
    │   ├── 📄 ilp-generator.ts          ILP utility functions
    │   └── 📄 utils.ts                  General utilities
    │
    ├── 📁 supabase/                     ⭐ EDGE FUNCTIONS
    │   ├── 📄 config.toml               Supabase CLI config
    │   ├── 📁 functions/
    │   │   └── 📁 generate-base-timetable/
    │   │       ├── 📄 index.ts          ← MAIN ORCHESTRATOR (calls ILP solver)
    │   │       └── deno.json            Deno config
    │   │
    │   └── 📁 migrations/               Database migrations
    │       ├── 📄 001_create_tables.sql
    │       └── ...
    │
    ├── 📁 public/                       Static assets
    │   └── (images, fonts, etc.)
    │
    └── 📁 scripts/                      Database setup scripts
        ├── 📄 001_create_database_schema.sql
        └── 📄 002_seed_initial_data.sql
```

---

## 📋 File Purpose Guide

### 🔥 CRITICAL FILES (Don't modify without understanding!)

| File | Purpose | Language |
|------|---------|----------|
| `ilp-solver/app.py` | **THE SOLVER** - Solves lab scheduling constraints | Python |
| `supabase/functions/generate-base-timetable/index.ts` | **THE ORCHESTRATOR** - Coordinates solver & database | TypeScript |
| `my-app/lib/database.ts` | Database queries (fetches input data) | TypeScript |

### 📄 DOCUMENTATION FILES (Read for understanding)

| File | Read When... |
|------|---------|
| `README_START_HERE.md` | First time setting up |
| `DEVELOPMENT.md` | Need to run services |
| `TESTING.md` | Need to test features |
| `VIVA_ANSWERS.md` | Preparing for defense |
| `INTEGRATION_COMPLETE.md` | Understanding architecture |
| `SETUP_VERIFICATION.md` | Verifying everything works |

### 🎯 STARTUP FILES (Run to start development)

| File | What it does | Platform |
|------|---------|----------|
| `run-dev.bat` | Starts both solver & Next.js | Windows (Batch) |
| `run-dev.ps1` | Starts both services | Windows (PowerShell) |
| `QUICK-START.ps1` | Shows command reference | Windows (PowerShell) |

### 🧩 COMPONENT FILES (UI Components)

```
Components are in my-app/components/
├── generate-timetable.tsx     ← Main UI for generation
├── timetable-viewer.tsx        Display results
├── progress.tsx                Show progress bar
├── stats-card.tsx              Display statistics
├── *-dialog.tsx                Forms for data entry (4 files)
├── *-list.tsx                  List views (5 files)
└── ui/                         shadcn UI library components
```

### 🔄 DATA FLOW

```
1. UI Component (generate-timetable.tsx)
   ↓ onClick event
2. Fetch Edge Function (lib/database.ts)
   ↓ GET /api/timetable/generate-base
3. Edge Function (index.ts)
   ↓ Calls ILP solver HTTP
4. ILP Solver (app.py)
   ↓ Returns JSON solution
5. Edge Function processes & saves
   ↓ INSERT into database
6. UI polls for status
   ↓ Displays results
7. Viewer Component (timetable-viewer.tsx)
   ↓ Shows timetable grid
```

---

## 🗂️ By Feature

### For **Lab Scheduling**:
- `ilp-solver/app.py` - The solver
- `supabase/functions/generate-base-timetable/index.ts` - Orchestrator
- `components/generate-timetable.tsx` - UI trigger
- `lib/database.ts` - Data fetching

### For **Faculty Management**:
- `app/admin/faculty/page.tsx` - Faculty page
- `components/faculty-dialog.tsx` - Add/edit dialog
- `components/faculty-list.tsx` - List view
- `lib/database.ts` - Queries

### For **Display**:
- `app/timetable/page.tsx` - Public view
- `components/timetable-viewer.tsx` - Timetable display
- `components/tabs.tsx` - Tab navigation

### For **Database**:
- `supabase/migrations/` - Schema creation
- `scripts/` - Initial data seeding
- `lib/database.ts` - All queries

---

## 🚀 Deployment Files

When deploying to production:

1. **ILP Solver** → Deploy to Render.com, Railway, or Fly.io
2. **Edge Function** → Push to Supabase (auto-deploy on git push)
3. **Next.js App** → Deploy to Vercel (auto-deploy on git push)
4. **Database** → Already on Supabase (no deployment needed)

### Deployment Steps:

```bash
# 1. Deploy ILP solver to Render.com
#    (See ilp-solver/README.md)

# 2. Update Edge Function environment variable
#    ILP_SOLVER_URL=https://your-solver-service.com

# 3. Deploy Edge Function
npx supabase functions deploy generate-base-timetable --no-verify-jwt

# 4. Deploy Next.js
npx vercel deploy --prod
```

---

## 📝 Configuration Files

| File | Purpose |
|------|---------|
| `my-app/.env.local` | Local environment variables |
| `my-app/next.config.ts` | Next.js configuration |
| `my-app/tsconfig.json` | TypeScript configuration |
| `my-app/package.json` | Dependencies & scripts |
| `ilp-solver/requirements.txt` | Python dependencies |
| `supabase/config.json` | Supabase CLI config |

---

## 🔑 Key Concepts

### **ILP Solver (app.py)**
- Reads problem from HTTP POST request
- Creates constraint model using OR-Tools
- Solves using CP-SAT solver
- Returns JSON solution

### **Edge Function (index.ts)**
- Fetches data from Supabase
- Calls ILP solver via HTTP
- Validates solution
- Saves to database
- Returns status to frontend

### **Frontend (Next.js)**
- Provides UI for data management
- Calls Edge Function to generate
- Polls for status updates
- Displays results via timetable viewer

### **Database (PostgreSQL)**
- Stores all input data
- Persists generated timetables
- Tracks job status
- Enforces CHECK constraints

---

## 📊 File Size Summary

```
ILP Solver:                 ~300 lines
Edge Function:              ~900 lines
Next.js Components:         ~2000 lines
Database Queries:           ~400 lines
Configuration:              ~200 lines
Documentation:              ~5000 lines
────────────────────────────
TOTAL CODE:                 ~4000 lines (excluding docs)
```

---

## ✅ Next Steps

1. Read `README_START_HERE.md`
2. Run `run-dev.bat` or `run-dev.ps1`
3. Follow `DEVELOPMENT.md`
4. Test with `TESTING.md`
5. For defense, review `VIVA_ANSWERS.md`

---

**This structure is production-ready and follows industry best practices!** 🚀
