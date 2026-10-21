# Timetable Scheduling System - Documentation

## 📚 Documentation Index

This documentation explains how the timetable scheduling system generates and optimizes class schedules using a combination of **Integer Linear Programming (ILP)** and **Genetic Algorithm (GA)**.

### Documents

| # | Document | Description |
|---|----------|-------------|
| 01 | [Architecture Overview](./01-architecture-overview.md) | High-level system architecture, components, and data flow |
| 02 | [Base Timetable Generation](./02-base-timetable-generation.md) | How the initial valid timetable is created |
| 03 | [ILP Solver (OR-Tools)](./03-ilp-solver-constraint-programming.md) | Python constraint programming solver for optimal scheduling |
| 04 | [Genetic Algorithm Optimizer](./04-genetic-algorithm-optimizer.md) | GA-based optimization for soft constraints |
| 05 | [Edge Function Advanced Scheduling](./05-edge-function-advanced-scheduling.md) | Supabase edge function with multi-start and ILP fallback |
| 06 | [Slot Assignment Mechanism](./06-slot-assignment-mechanism.md) | How time slots are assigned and tracked |
| 07 | [Scheduling Rules & Constraints](./07-scheduling-rules-constraints.md) | Hard and soft constraints enforced |
| 08 | [Database Schema](./08-database-schema.md) | Tables, relationships, and queries |
| 09 | [Complete Generation Flow](./09-complete-generation-flow.md) | End-to-end walkthrough from click to display |
| 10 | [College Hierarchy & Enhanced ILP-GA](./10-college-hierarchy-and-enhanced-ilp-ga.md) | College/department roles, publishing & occupancy, baseline vs enhanced pipelines, measured results |
| 11 | [User Guide & Complete Flow](./11-user-guide-and-complete-flow.md) | Every page explained, generating with and without enhancement, comparing, publishing, rescheduling, full architecture |

## 🎯 Quick Start

### Understanding the System

0. New users: start with the **[User Guide & Complete Flow](./11-user-guide-and-complete-flow.md)**
1. Start with **[Architecture Overview](./01-architecture-overview.md)** for the big picture
2. Read **[Base Timetable Generation](./02-base-timetable-generation.md)** for core logic
3. Explore **[ILP Solver](./03-ilp-solver-constraint-programming.md)** for constraint programming
4. Learn **[GA Optimizer](./04-genetic-algorithm-optimizer.md)** for quality improvement

### Deep Dive

- **[Slot Assignment](./06-slot-assignment-mechanism.md)**: How resources are tracked
- **[Rules & Constraints](./07-scheduling-rules-constraints.md)**: What rules are enforced
- **[Database Schema](./08-database-schema.md)**: Data model details

### End-to-End

- **[Complete Flow](./09-complete-generation-flow.md)**: Step-by-step with code

## 🔑 Key Concepts

### Two-Phase Approach

```
Phase 1: Base Generation (ILP/Greedy)
├── Schedule Labs (4 consecutive periods)
│   └── Using OR-Tools CP-SAT or Greedy search
└── Schedule Theory (distributed periods)
    └── Multi-start greedy with ILP fallback

Phase 2: Optimization (Genetic Algorithm)
├── Initialize population (50 variations)
├── Evaluate fitness (gaps, balance, preferences)
├── Evolve (selection, crossover, mutation)
└── Return best solution after 100 generations
```

### Hard vs Soft Constraints

| Hard Constraints | Soft Constraints |
|------------------|------------------|
| No double-booking | Minimize gaps |
| Room capacity | Balance workload |
| Faculty availability | Prefer morning |
| Lab = 4 periods | Labs early in week |

### Algorithm Comparison

| Algorithm | Purpose | Guarantee |
|-----------|---------|-----------|
| ILP (OR-Tools) | Find valid schedule | Optimal or infeasible |
| Greedy | Fast fallback | Valid but may miss slots |
| GA | Improve quality | Local optimum |

## 📊 System Performance

| Metric | Typical Value |
|--------|---------------|
| Lab scheduling | 1-5 seconds |
| Theory scheduling | <1 second |
| GA optimization | 2-10 seconds |
| Total generation | 5-15 seconds |

## 🛠️ Technology Stack

- **Frontend**: Next.js 16, React, TypeScript
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **ILP Solver**: Python OR-Tools (FastAPI on Render)
- **Optimization**: TypeScript GA implementation

## 📁 Code Locations

```
my-app/
├── app/api/timetable/
│   ├── generate-base/route.ts    # Base generation API
│   └── optimize/route.ts         # GA optimization API
├── lib/
│   ├── ilp-generator.ts          # Local greedy scheduler
│   ├── ga-optimizer.ts           # Genetic algorithm
│   └── timetable.ts              # Constants and rules
├── supabase/functions/
│   └── generate-base-timetable/  # Edge function (advanced)
│       └── index.ts
└── docs/                         # This documentation

ilp-solver/
└── app.py                        # Python OR-Tools solver
```

## ❓ Common Questions

### Why two phases?

1. **Base generation** ensures a valid schedule (satisfies hard constraints)
2. **Optimization** improves quality (minimizes soft constraint violations)

Combining them gives both correctness and quality.

### Why ILP for labs?

Labs have stricter requirements (4 consecutive periods, specific rooms). ILP guarantees finding a valid assignment if one exists, while greedy might fail on complex problems.

### Why GA instead of ILP for optimization?

GA handles soft constraints better (gaps, balance, preferences) while ILP is optimized for hard binary decisions. GA also runs faster for the "improve quality" task.

### Why multi-start greedy?

Different course orderings can lead to different schedules. By trying multiple orderings (priority-based, reverse, random), we increase the chance of finding a good solution without the complexity of full ILP.

## 🔗 Related Resources

- [OR-Tools Documentation](https://developers.google.com/optimization)
- [Constraint Programming](https://en.wikipedia.org/wiki/Constraint_programming)
- [Genetic Algorithms](https://en.wikipedia.org/wiki/Genetic_algorithm)
- [University Timetabling Problem](https://en.wikipedia.org/wiki/University_timetabling)
