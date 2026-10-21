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

### Room reservation at high utilization

When rooms are 90%+ booked, the departments that generate first would otherwise take the
best periods (mostly mornings) and leave the last departments periods their sections cannot
use. Each run therefore keeps, at every period, a share of the free rooms for sections of
the college that are not scheduled yet (their remaining demand spread over the week,
`_shared/capacity.ts`). The ILP solver, the greedy theory pass and both GAs respect it. The
enhanced optimizer's coverage-completion step may borrow a reserved room when a period
fits nowhere else, so the reserve steers departments apart without ever leaving a gap.

Department admins choose freely which sections to generate: one year, several years or
any mix (year buttons plus per-section checkboxes). Sections not selected are simply left
for a later run; published ones are respected as occupancy.

## Before vs after enhancement

The department generate page runs either pipeline on the same sections, or both with
**Run both & compare**. Both pipelines use the same occupancy, the same evaluator
(`_shared/metrics.ts`, `_shared/constraints.ts`) and the same population × generation
budget (`COMPARISON_BUDGET` in `_shared/pipeline.ts`).

| Stage | Before enhancement (`baseline`) | After enhancement (`enhanced`) |
|---|---|---|
| Base | One CP-SAT lab solve + 15-strategy greedy theory (original code) | **Relaxed-ILP diversification**: 4 CP-SAT solutions in one request - solution 0 with the standard capacity-waste objective (proved optimal), then randomized objectives with Hamming-distance exclusion constraints (τ = 0.3), warm-started from the previous solution and time-limited to 2× the first solve; each paired with a different theory ordering; infeasible seeds are dropped |
| Population | Base timetable + random 10% swaps | The diversified seeds, topped up with feasible block mutations |
| Crossover | Slot-level, invalid genes rejected | **SCPX**: exchanges a section's coordinate group (its blocks on every day); faculty/room clashes revert the group → offspring always feasible, no repair |
| Mutation | Random slot move, checks overlaps only | Constraint-safe block mutation: day-block swap, ±1 period / adjacent-day shift, objective-directed relocation. Candidates are first screened with cheap array lookups (section/faculty free, availability, occupancy, 2 periods/day) and only survivors get a room search, so ~1 attempt per accepted move |
| Selection | Weighted-sum fitness, tournament, elitism | **NSGA-II**: constrained non-dominated sorting + crowding distance over five objectives; the best-Q solution is always retained; stops early after 8 generations without improvement |
| Output | One timetable | The **best 3** timetables of the Pareto front: the best weighted-quality one plus the two that add the most hypervolume; the department admin can switch between them before publishing |
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

`npm run experiment` replays the comparison offline with the real CP-SAT solver (5 runs per
mode; each department generates around the timetables the previous ones published).

**SRKR sample college** - 20 sections, each with 5 theory subjects (4 periods/week) and
3 labs (3 continuous periods); 35 faculty sized from demand at <= 18 periods/week (load
15-18, mean utilization 92%); 12 theory rooms and 8 labs shared by CSE (8 sections), IT (6)
and ECE (6). Full table: [`experiments/results/comparison-srkr.md`](../experiments/results/comparison-srkr.md).

| | CSE | IT | ECE |
|---|---|---|---|
| Weighted quality Q (before → after) | 0.838 → 0.874 | 0.854 → 0.863 | 0.801 → 0.834 |
| Hypervolume (before → after) | 0.281 → 0.427 | 0.340 → 0.409 | 0.155 → 0.258 |
| Constraint preservation | 94.6% → 100% | 69.2% → 100% | 61.5% → 100% |
| Hard violations (mean) | 0.2 → 0 | 1.2 → 0 | 1.2 → 0 |
| Initial diversity (PIE) | 0.14 → 0.76 | 0.12 → 0.79 | 0.11 → 0.77 |
| Mutation attempts per accepted move | 8.4 → 1.0 | 9.2 → 1.2 | 11.2 → 1.7 |
| Optimization time (ms) | 144 → 100 | 99 → 87 | 96 → 154 |
| Base stage time (ms) | 1167 → 2419 | 505 → 1035 | 378 → 869 |

The three published timetables together have 0 faculty, room or section double bookings.
Incremental rescheduling (one faculty member on leave for a day) re-placed every affected
period in about 7 ms, against about 2.5 s for a full enhanced regeneration.

**Kaggle-derived college** (`DATASET=kaggle npm run experiment`, results in
[`experiments/results/comparison-kaggle.md`](../experiments/results/comparison-kaggle.md)).
It is built from Kaggle `kathuman/room-assignment-problem` (5 real rooms; 518
participants in 10 teams become 10 sections of 37-72 students; activity preferences
become subjects) and `khhaledahmaad/academic-timetable` (semester calendar, 13 weeks
each). Faculty, availability, lab rooms and labs are synthesized with a fixed seed,
because neither dataset contains them:

| | KC2 | KC57 | KC346 |
|---|---|---|---|
| Weighted quality Q (before → after) | 0.818 → 0.864 | 0.837 → 0.852 | 0.719 → 0.738 |
| Hypervolume (before → after) | 0.187 → 0.370 | 0.260 → 0.390 | 0.045 → 0.098 |
| Constraint preservation | 96.9% → 100% | 96.4% → 100% | 96.9% → 100% |
| Mutation attempts per accepted move | 2.5 → 1.1 | 4.2 → 1.9 | 11.6 → 4.3 |

**Large university** (`DATASET=large npm run experiment`, seed `scripts/024_large_university.sql`):
410 faculty, 4 years x 25 sections (years 1-3: 5 theory + 3 labs; year 4: 5 theory + 1 lab),
49 theory rooms at 92.8% and 24 labs at 94.7% utilization, CSE/ECE/EEE/MECH/CIVIL each
generating year by year (20 runs) around everything published before. With the room
reservation and coverage completion the enhanced pipeline scheduled all 20 runs with 100%
coverage and 0 violations, 0 college-wide double bookings; the baseline left a gap in one
run and broke rules in six. Without the reservation the last departments reached only
70-94% coverage. Because CP-SAT is not deterministic with several workers, a repeat run can
leave the final department a few periods short (<0.4% of 2000); regenerating that run
resolves it.

**Runtime.** The optimization stage now costs about the same as the baseline GA (early
stopping, diversity measured only at the start and end). The base stage stays about 2×
the baseline because Relaxed-ILP computes 4 distinct ILP solutions where the baseline
computes one; each solve is already 0.1-0.4 s. Removing that cost would mean removing
Enhancement 2. These are this dataset's numbers; the paper's tables should be replaced
with values measured on your own data.

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
