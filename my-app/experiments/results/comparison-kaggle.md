# Baseline vs Enhanced ILP-GA - Kaggle-derived college (academic-timetable + room-assignment-problem)

- 518 participants in 10 teams -> 10 sections (37-72 students)
- 5 real rooms (80, 150, 70, 250, 35 seats) + 2 synthesized labs
- 14 subjects from activity preferences, 20 synthesized faculty (4 with a day off)
- Calendar: semester 1 = 13 weeks, semester 2 = 13 weeks
- 5 runs per mode; departments scheduled in order KC2 -> KC57 -> KC346, each around the previous ones' published timetables


### KC2 (5 runs each, mean)

| Metric | Baseline | Enhanced | Better |
|---|---:|---:|:--:|
| Hard violations (final) | 0.000 | 0.000 | = |
|   double bookings | 0.000 | 0.000 | = |
|   availability breaches | 0.000 | 0.000 | = |
|   >2 periods/day of a subject | 0.000 | 0.000 | = |
| Coverage % | 100.000 | 100.000 | = |
| f1 faculty-gap score | 1.000 | 1.000 | = |
| f2 student-gap score | 1.000 | 0.995 | baseline |
| f3 workload balance | 0.366 | 0.366 | = |
| f4 morning preference | 0.938 | 1.000 | enhanced |
| f5 lab compactness | 0.550 | 0.900 | enhanced |
| Weighted quality Q | 0.819 | 0.862 | enhanced |
| Constraint preservation % (CP) | 97.519 | 100.000 | enhanced |
| Initial diversity (PIE) | 0.214 | 0.851 | enhanced |
| Final diversity (GD) | 0.030 | 0.619 | enhanced |
| Mutation attempts / accepted | 2.400 | 4.252 | baseline |
| Hypervolume (returned set) | 0.189 | 0.364 | enhanced |
| Hypervolume (final population) | 0.207 | 0.364 | enhanced |
| Pareto front size | 1.000 | 6.000 | enhanced |
| Base stage time ms | 54.200 | 259.000 | baseline |
| Optimization time ms | 33.600 | 199.400 | baseline |

### KC57 (5 runs each, mean)

| Metric | Baseline | Enhanced | Better |
|---|---:|---:|:--:|
| Hard violations (final) | 0.000 | 0.000 | = |
|   double bookings | 0.000 | 0.000 | = |
|   availability breaches | 0.000 | 0.000 | = |
|   >2 periods/day of a subject | 0.000 | 0.000 | = |
| Coverage % | 100.000 | 100.000 | = |
| f1 faculty-gap score | 1.000 | 1.000 | = |
| f2 student-gap score | 1.000 | 0.999 | baseline |
| f3 workload balance | 0.591 | 0.591 | = |
| f4 morning preference | 0.716 | 0.778 | enhanced |
| f5 lab compactness | 0.333 | 0.867 | enhanced |
| Weighted quality Q | 0.809 | 0.871 | enhanced |
| Constraint preservation % (CP) | 97.889 | 100.000 | enhanced |
| Initial diversity (PIE) | 0.197 | 0.849 | enhanced |
| Final diversity (GD) | 0.035 | 0.654 | enhanced |
| Mutation attempts / accepted | 3.618 | 6.398 | baseline |
| Hypervolume (returned set) | 0.141 | 0.469 | enhanced |
| Hypervolume (final population) | 0.169 | 0.469 | enhanced |
| Pareto front size | 1.000 | 12.000 | enhanced |
| Base stage time ms | 35.000 | 147.000 | baseline |
| Optimization time ms | 19.000 | 129.200 | baseline |

### KC346 (5 runs each, mean)

| Metric | Baseline | Enhanced | Better |
|---|---:|---:|:--:|
| Hard violations (final) | 0.000 | 0.000 | = |
|   double bookings | 0.000 | 0.000 | = |
|   availability breaches | 0.000 | 0.000 | = |
|   >2 periods/day of a subject | 0.000 | 0.000 | = |
| Coverage % | 100.000 | 100.000 | = |
| f1 faculty-gap score | 1.000 | 1.000 | = |
| f2 student-gap score | 0.984 | 0.967 | baseline |
| f3 workload balance | 0.481 | 0.486 | enhanced |
| f4 morning preference | 0.354 | 0.292 | baseline |
| f5 lab compactness | 0.200 | 0.600 | enhanced |
| Weighted quality Q | 0.715 | 0.743 | enhanced |
| Constraint preservation % (CP) | 99.074 | 100.000 | enhanced |
| Initial diversity (PIE) | 0.122 | 0.849 | enhanced |
| Final diversity (GD) | 0.007 | 0.829 | enhanced |
| Mutation attempts / accepted | 10.087 | 10.982 | baseline |
| Hypervolume (returned set) | 0.034 | 0.101 | enhanced |
| Hypervolume (final population) | 0.035 | 0.105 | enhanced |
| Pareto front size | 1.000 | 12.000 | enhanced |
| Base stage time ms | 34.600 | 163.000 | baseline |
| Optimization time ms | 21.000 | 167.600 | baseline |

### College-wide check of the published timetables

Faculty double bookings: 0, room double bookings: 0, section clashes: 0, coverage 100.0%

### Incremental rescheduling (KC2-F01 unavailable on Thursday)

| Metric | Value |
|---|---:|
| Latency ms | 5 |
| Full enhanced regeneration ms (mean) | 458 |
| Speed-up | 91.7x |
| Affected slots | 2/34 |
| SAF | 5.9% |
| Periods re-placed | 2/2 |
| Quality before -> after | 0.862 -> 0.857 (-0.53%) |
| Hard violations after | 0 |
