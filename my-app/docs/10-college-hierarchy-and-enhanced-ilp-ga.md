# 10. College hierarchy and the enhanced ILP-GA pipeline

This chapter describes the multi-department architecture and the four research-paper
enhancements as they are implemented. It supersedes the single-administrator flow in
chapters 01–09 wherever they disagree.

## Roles

| Role | Login | Creates / manages | Portal |
|---|---|---|---|
| System admin | `/login/admin` | College administrator accounts | `/dashboard/admin` |
| College admin | `/login/college-admin` | All faculty + availability, shared classrooms, departments, one department-admin account per department | `/college` |
| Department admin | `/login/department-admin` | The department's subjects and sections; generates, compares, publishes and reschedules timetables for selected sections | `/department` |
| Faculty | `/login/faculty` (code + phone, unchanged) | Views their week across every department | `/faculty` |

A college is a row of `timetable_administrators`; its id is the `college_id` on
departments, faculty, classrooms, sections, subjects and timetable jobs.
`department_admins.department_id` is unique, so each department has exactly one account.

## How departments share faculty and rooms

1. A department admin selects sections and runs a generation (baseline or enhanced).
2. The edge function loads `committed_timetable`: every published slot in the college
   except the selected sections. Those faculty and room periods become **occupancy**
   and are removed from the dynamic availability before anything is scheduled. They are
   also sent to the CP-SAT solver as effective faculty windows and `blockedRoomSlots`.
3. The new timetable is stored as an unpublished run. Nothing changes for anyone else yet.
4. **Publish** (`publish_timetable_job`) makes it binding:
   - refuses if a shared faculty member/room was booked by another department after the
     run was generated (the admin regenerates);
   - removes the selected sections from any older published run, so each section has
     exactly one committed timetable;
   - from now on these periods are occupancy for every other department, and faculty see
     the classes in their portal.

The college admin sees the result of all of this in **Faculty → availability**: a weekly
grid of declared availability and the periods departments have booked.

```
generate (dept A) ──► publish ──► committed_timetable ──► occupancy for dept B ──► generate (dept B) ──► publish
```

## Before vs after enhancement

The department generate page runs either pipeline on the same sections, or both with
**Run both & compare**. Both pipelines use the same occupancy, the same evaluator
(`_shared/metrics.ts`, `_shared/constraints.ts`) and the same population × generation
budget (`COMPARISON_BUDGET` in `_shared/pipeline.ts`).

| Stage | Before enhancement (`baseline`) | After enhancement (`enhanced`) |
|---|---|---|
| Base | One CP-SAT lab solve + 15-strategy greedy theory (original code) | **Relaxed-ILP diversification**: standard solution + N randomized-objective CP-SAT solutions with Hamming-distance exclusion constraints (`/solve-labs-diverse`, τ = 0.3), each paired with a different theory ordering; infeasible seeds are dropped |
| Population | Base timetable + random 10% swaps | The diversified seeds, topped up with feasible block mutations |
| Crossover | Slot-level, invalid genes rejected | **SCPX**: exchanges a section's coordinate group (its blocks on every day); faculty/room clashes revert the group → offspring always feasible, no repair |
| Mutation | Random slot move, checks overlaps only | Constraint-safe block mutation: day-block swap, ±1 period / adjacent-day shift, objective-directed relocation; every move validated on a `FeasibilityGrid` (overlaps, availability, occupancy, 2 periods/day, lunch, Saturday, room type/capacity) |
| Selection | Weighted-sum fitness, tournament, elitism | **NSGA-II**: constrained non-dominated sorting + crowding distance over five objectives; the best-Q solution is always retained |
| Output | One timetable | Pareto front (≤ 12 alternatives); the department admin can switch to any of them before publishing |
| Disruptions | Full regeneration | **Incremental rescheduling**: lock every unaffected slot, re-place only the disrupted periods, local refinement |

**Design note on SCPX.** The paper exchanges single `Block(d, s)` day-blocks. That
cannot guarantee course coverage (HC1): two parents almost always place a course on
different days, so swapping one day duplicates or drops its periods. The implementation
exchanges a section's whole set of day-blocks instead, which preserves HC1, HC3 and HC10
by construction. Single day-blocks remain the unit of mutation.

The baseline code is the original algorithm. The only addition is that its validity
check also respects other departments' committed periods; without it, a baseline run
could double-book shared faculty. Instrumentation counters do not change its search.

## Evaluation metrics

Stored per run in `timetable_jobs.metrics` (`base`, `final`, `process`, `reschedule`) and
shown side by side with CSV/JSON export:

- **Hard constraints:** total violations, double bookings (incl. other departments),
  availability breaches, >2 periods/day, coverage %.
- **Quality:** f1 faculty gaps, f2 student gaps, f3 workload balance, f4 morning
  preference, f5 lab compactness, weighted quality Q (the baseline's own weights).
- **Search process:** constraint preservation (CP), crossover acceptance, initial (PIE)
  and final (GD) population diversity, mutation attempts per accepted move,
  convergence generation.
- **Multi-objective:** hypervolume of the offered set and of the final population,
  Pareto front size.
- **Rescheduling:** latency, schedule-affected fraction (SAF), lock ratio, quality change,
  speed-up over the parent run's full generation time.

## Measured results

`npm run experiment` replays the comparison offline on the sample college
(`experiments/dataset.ts`) with the real CP-SAT solver. See
[`experiments/results/comparison-srkr.md`](../experiments/results/comparison-srkr.md) for the full
table. Five runs per mode, CSE published first, then IT and ECE scheduled around it:

| | CSE | IT | ECE |
|---|---|---|---|
| Weighted quality Q (before → after) | 0.881 → 0.896 | 0.788 → 0.850 | 0.776 → 0.818 |
| Hypervolume (before → after) | 0.434 → 0.559 | 0.153 → 0.380 | 0.103 → 0.275 |
| Constraint preservation | 95.4% → 100% | 58.0% → 100% | 97.1% → 100% |
| Hard violations (mean) | 0 → 0 | 1.0 → 0 | 0 → 0 |
| Initial diversity (PIE) | 0.19 → 0.84 | ≈0.16 → 0.80 | ≈0.12 → 0.85 |
| Runtime (base + GA, ms) | 250 → 1035 | 92 → 432 | 87 → 468 |

Across the three published timetables there were 0 faculty, room or section double
bookings. Incremental rescheduling (one faculty member on leave for a day) re-placed
every affected period in about 8 ms, against roughly 1 s for a full enhanced
regeneration, touching 3.4% of the timetable.

**Kaggle-derived college** (`DATASET=kaggle npm run experiment`, results in
[`experiments/results/comparison-kaggle.md`](../experiments/results/comparison-kaggle.md)).
It is built from Kaggle `kathuman/room-assignment-problem` (5 real rooms; 518
participants in 10 teams become 10 sections of 37-72 students; activity preferences
become subjects) and `khhaledahmaad/academic-timetable` (semester calendar, 13 weeks
each). Faculty, availability, lab rooms and labs are synthesized with a fixed seed,
because neither dataset contains them:

| | KC2 | KC57 | KC346 |
|---|---|---|---|
| Weighted quality Q (before -> after) | 0.819 -> 0.862 | 0.809 -> 0.871 | 0.715 -> 0.743 |
| Hypervolume (before -> after) | 0.189 -> 0.364 | 0.141 -> 0.469 | 0.034 -> 0.101 |
| Constraint preservation | 97.5% -> 100% | 97.9% -> 100% | 99.1% -> 100% |

Again 0 college-wide double bookings, and rescheduling a day of leave took 5 ms versus
about 460 ms for full regeneration.

The baseline is faster and needs fewer attempts per accepted mutation. The enhanced
pipeline spends that time on seeding and Pareto search. These are this dataset's
numbers; the paper's tables should be replaced with values measured on your own data.

## Deployment checklist

1. Run `scripts/021_college_department_hierarchy.sql` (after `000_complete_setup.sql`).
2. Optional sample college: `scripts/022_sample_college_hierarchy.sql`
   (generated by `npm run experiment:sql`).
3. Deploy both edge functions. They import `supabase/functions/_shared/*`:
   `supabase functions deploy generate-base-timetable` and
   `supabase functions deploy optimize-timetable`.
4. Redeploy the ILP solver (`ilp-solver/app.py`) for `/solve-labs-diverse` and
   `blockedRoomSlots`. An older solver still works: the enhanced mode falls back to
   greedy seed variations and the generator re-places any lab that clashes with a room
   committed elsewhere.
5. Old `timetable_admin` sessions are no longer recognised; users sign in again through
   `/login/college-admin`.
