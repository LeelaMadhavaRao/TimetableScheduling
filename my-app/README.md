# Timetable Scheduling Application

A comprehensive timetable scheduling system using **Integer Linear Programming (ILP)** for constraint satisfaction and **Genetic Algorithm (GA)** for optimization.

## Features

- **Faculty Management**: Create faculty profiles with availability timings
- **Subject Setup**: Define subjects with faculty mappings (e.g., JAVA - KSR) and periods per week
- **Classroom Configuration**: Set up classrooms with capacity and type (lab/theory)
- **Section Management**: Create sections with student counts and assign subjects
- **ILP-Based Generation**: Generate valid base timetable satisfying all hard constraints
- **GA Optimization**: Optimize timetable for quality metrics (minimize gaps, balance workload)
- **Real-time Updates**: Live progress tracking via Supabase subscriptions
- **Timetable Viewer**: Browse timetables by section or faculty

## Scheduling Constraints

### Hard Constraints (ILP Phase)
- Section size must be less than classroom capacity
- Labs assigned first (4 consecutive periods = 3 hours)
- Theory classes distributed (max 1.5 hours/day per section)
- Saturday half-day for all years
- Saturday afternoon labs only for first year if needed
- Faculty consecutive rule: If teaching P1-2, next slot from P5-8
- No faculty double-booking or room conflicts
- Faculty availability windows respected

### Soft Constraints (GA Phase)
- Minimize faculty gaps between classes
- Balance workload across the week
- Minimize student idle periods
- Prefer morning slots over afternoon
- Compact lab scheduling

## Period Timings

**Morning Session**: 9:00-12:00
- Period 1: 9:00-9:45
- Period 2: 9:45-10:30
- Period 3: 10:30-11:15
- Period 4: 11:15-12:00

**Lunch Break**: 12:00-1:30

**Afternoon Session**: 1:30-4:30
- Period 5: 1:30-2:15
- Period 6: 2:15-3:00
- Period 7: 3:00-3:45
- Period 8: 3:45-4:30

## Getting Started

1. **Setup Database**: Run SQL scripts in `/scripts` folder to create schema
2. **Add Faculty**: Create faculty members with codes and availability
3. **Create Subjects**: Define subjects and link to faculty
4. **Configure Classrooms**: Add rooms with capacity and type
5. **Setup Sections**: Create sections and assign subjects
6. **Generate Timetable**: Run ILP-based generation
7. **Optimize**: Apply GA optimization for improved quality

## Technology Stack

- **Framework**: Next.js 16 with App Router
- **Database**: Supabase (PostgreSQL)
- **UI**: shadcn/ui with Tailwind CSS v4
- **Algorithms**: Custom ILP solver and GA optimizer
- **Real-time**: Supabase subscriptions

## Architecture

### Two-Phase Optimization

1. **ILP Phase**: Generates conflict-free base timetable
   - Guarantees all hard constraints satisfied
   - Uses greedy constraint-satisfaction approach
   - Prioritizes labs, then theory classes

2. **GA Phase**: Optimizes base timetable
   - Population size: 50
   - Generations: 100
   - Tournament selection with elitism
   - Fitness based on gaps, balance, and preferences

## Database Schema

Key tables:
- `faculty` + `faculty_availability`
- `subjects` + `subject_faculty`
- `classrooms`
- `sections` + `section_subjects`
- `timetable_jobs`
- `timetable_base` (ILP output)
- `timetable_optimized` (GA output)

## Backend Architecture

### Supabase Edge Functions

The application uses **Supabase Edge Functions** for all backend operations:

- **`generate-base-timetable`** - ILP-based base timetable generation
- **`optimize-timetable`** - GA-based timetable optimization

See [SUPABASE_EDGE_FUNCTIONS_SETUP.md](./SUPABASE_EDGE_FUNCTIONS_SETUP.md) for detailed setup instructions.

### Deployment

```bash
# Deploy edge functions
supabase functions deploy generate-base-timetable
supabase functions deploy optimize-timetable

# View logs
supabase functions logs generate-base-timetable --follow
```

### Edge Function Advantages

- ✅ Serverless & auto-scaling
- ✅ Global edge deployment
- ✅ Direct Supabase database access
- ✅ Cost-effective (free tier: 500K invocations/month)
- ✅ Modern Deno runtime with TypeScript support

## License

MIT
