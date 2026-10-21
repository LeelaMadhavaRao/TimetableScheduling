# Offline experiments

Reproduces the "before vs after enhancement" comparison outside Supabase, using the exact
modules the edge functions run (`supabase/functions/_shared/`).

```bash
# 1. Start the CP-SAT solver (from ilp-solver/)
pip install -r requirements.txt
PYTHONUTF8=1 uvicorn app:app --port 8000     # PYTHONUTF8 avoids emoji log errors on Windows consoles

# 2. From my-app/
ILP_SOLVER_URL=http://localhost:8000 RUNS=5 npm run experiment
```

Results are written to `experiments/results/comparison-<dataset>.md` and `.json`.

**Kaggle-derived instance.** The two datasets from the project presentation declare no
license, so they are not committed. Download them (needs `~/.kaggle/kaggle.json`):

```bash
kaggle datasets download -d khhaledahmaad/academic-timetable -p experiments/data/kaggle --unzip
kaggle datasets download -d kathuman/room-assignment-problem -p experiments/data/kaggle --unzip
DATASET=kaggle RUNS=5 npm run experiment
DATASET=kaggle npm run experiment:sql      # regenerates scripts/023_kaggle_derived_college.sql
```

`kaggle-dataset.ts` documents the mapping. The academic-timetable set is only a semester
calendar and the room-assignment set is an event room-allocation problem, so the faculty,
availability, labs and lab rooms are synthesized with a fixed seed.

Without a reachable solver, both pipelines fall back to greedy lab placement. That
fallback is useful for smoke tests, but the baseline's greedy path can place labs across
lunch, so use the solver for reportable numbers.

What the script does:

1. For each department in turn (CSE, IT, ECE for the 20-section SRKR college), run the
   baseline and the enhanced pipeline `RUNS` times
   each on all of the department's sections, against the timetables already published by
   the departments before it.
2. Publish the best enhanced CSE run, then IT, then ECE, and check that the combined
   college timetable has no faculty, room or section double bookings.
3. Put the first department's busiest faculty member on leave for their busiest day and measure
   incremental rescheduling against a full regeneration.

`dataset.ts` is the sample college: 20 sections x (5 theory x 4 periods + 3 labs x 3
continuous periods), with the faculty pool sized from demand at <= 18 periods/week and
courses packed so every faculty member carries 15-18 periods. `npm run experiment:sql` regenerates
`scripts/022_sample_college_hierarchy.sql` from it, so the database seed and the
experiment describe the same college.
