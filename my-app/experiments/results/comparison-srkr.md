# Baseline vs Enhanced ILP-GA - SRKR sample college (20 sections, 5 theory + 3 labs each)

- 20 sections x (5 theory x 4 + 3 labs x 3 periods) = 29 periods/week each
- 35 faculty sized at <= 18 periods/week: load 15-18 periods, mean utilization 92.1%
- 12 theory rooms + 8 lab rooms shared by all departments
- 5 runs per mode; departments scheduled in order CSE -> IT -> ECE, each around the previous ones' published timetables


### CSE (5 runs each, mean)

| Metric | Baseline | Enhanced | Better |
|---|---:|---:|:--:|
| Hard violations (final) | 0.000 | 0.000 | = |
|   double bookings | 0.000 | 0.000 | = |
|   availability breaches | 0.000 | 0.000 | = |
|   >2 periods/day of a subject | 0.000 | 0.000 | = |
| Coverage % | 100.000 | 100.000 | = |
| f1 faculty-gap score | 0.971 | 0.995 | enhanced |
| f2 student-gap score | 0.943 | 0.966 | enhanced |
| f3 workload balance | 0.722 | 0.797 | enhanced |
| f4 morning preference | 0.699 | 0.727 | enhanced |
| f5 lab compactness | 0.673 | 0.658 | baseline |
| Weighted quality Q | 0.844 | 0.874 | enhanced |
| Constraint preservation % (CP) | 96.815 | 100.000 | enhanced |
| Initial diversity (PIE) | 0.148 | 0.763 | enhanced |
| Final diversity (GD) | 0.005 | 0.677 | enhanced |
| Mutation attempts / accepted | 8.053 | 1.017 | enhanced |
| Hypervolume (returned set) | 0.311 | 0.432 | enhanced |
| Hypervolume (final population) | 0.315 | 0.445 | enhanced |
| Pareto front size | 1.000 | 3.000 | enhanced |
| Base stage time ms | 1166.000 | 2365.000 | baseline |
| Optimization time ms | 151.000 | 114.800 | enhanced |

### IT (5 runs each, mean)

| Metric | Baseline | Enhanced | Better |
|---|---:|---:|:--:|
| Hard violations (final) | 0.200 | 0.000 | enhanced |
|   double bookings | 0.000 | 0.000 | = |
|   availability breaches | 0.000 | 0.000 | = |
|   >2 periods/day of a subject | 0.200 | 0.000 | enhanced |
| Coverage % | 100.000 | 100.000 | = |
| f1 faculty-gap score | 0.986 | 0.987 | enhanced |
| f2 student-gap score | 0.942 | 0.951 | enhanced |
| f3 workload balance | 0.735 | 0.718 | baseline |
| f4 morning preference | 0.690 | 0.694 | enhanced |
| f5 lab compactness | 0.747 | 0.864 | enhanced |
| Weighted quality Q | 0.856 | 0.868 | enhanced |
| Constraint preservation % (CP) | 71.407 | 100.000 | enhanced |
| Initial diversity (PIE) | 0.124 | 0.790 | enhanced |
| Final diversity (GD) | 0.006 | 0.732 | enhanced |
| Mutation attempts / accepted | 8.685 | 1.116 | enhanced |
| Hypervolume (returned set) | 0.351 | 0.434 | enhanced |
| Hypervolume (final population) | 0.353 | 0.446 | enhanced |
| Pareto front size | 1.000 | 3.000 | enhanced |
| Base stage time ms | 512.000 | 1169.600 | baseline |
| Optimization time ms | 90.600 | 74.000 | enhanced |

### ECE (5 runs each, mean)

| Metric | Baseline | Enhanced | Better |
|---|---:|---:|:--:|
| Hard violations (final) | 0.000 | 0.000 | = |
|   double bookings | 0.000 | 0.000 | = |
|   availability breaches | 0.000 | 0.000 | = |
|   >2 periods/day of a subject | 0.000 | 0.000 | = |
| Coverage % | 100.000 | 100.000 | = |
| f1 faculty-gap score | 0.950 | 0.981 | enhanced |
| f2 student-gap score | 0.944 | 0.967 | enhanced |
| f3 workload balance | 0.737 | 0.767 | enhanced |
| f4 morning preference | 0.569 | 0.670 | enhanced |
| f5 lab compactness | 0.438 | 0.340 | baseline |
| Weighted quality Q | 0.797 | 0.824 | enhanced |
| Constraint preservation % (CP) | 97.444 | 100.000 | enhanced |
| Initial diversity (PIE) | 0.108 | 0.778 | enhanced |
| Final diversity (GD) | 0.004 | 0.692 | enhanced |
| Mutation attempts / accepted | 11.283 | 1.952 | enhanced |
| Hypervolume (returned set) | 0.165 | 0.248 | enhanced |
| Hypervolume (final population) | 0.167 | 0.262 | enhanced |
| Pareto front size | 1.000 | 3.000 | enhanced |
| Base stage time ms | 382.000 | 935.400 | baseline |
| Optimization time ms | 89.800 | 173.800 | baseline |

### College-wide check of the published timetables

Faculty double bookings: 0, room double bookings: 0, section clashes: 0, coverage 100.0%

### Incremental rescheduling (CSE-F09 unavailable on Monday)

| Metric | Value |
|---|---:|
| Latency ms | 6 |
| Full enhanced regeneration ms (mean) | 2480 |
| Speed-up | 413.3x |
| Affected slots | 2/104 |
| SAF | 1.9% |
| Periods re-placed | 6/6 |
| Quality before -> after | 0.875 -> 0.867 (-0.97%) |
| Hard violations after | 0 |
