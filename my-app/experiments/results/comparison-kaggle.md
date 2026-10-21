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
| f2 student-gap score | 1.000 | 1.000 | = |
| f3 workload balance | 0.366 | 0.376 | enhanced |
| f4 morning preference | 0.929 | 0.956 | enhanced |
| f5 lab compactness | 0.550 | 0.950 | enhanced |
| Weighted quality Q | 0.818 | 0.864 | enhanced |
| Constraint preservation % (CP) | 96.889 | 100.000 | enhanced |
| Initial diversity (PIE) | 0.206 | 0.730 | enhanced |
| Final diversity (GD) | 0.018 | 0.672 | enhanced |
| Mutation attempts / accepted | 2.518 | 1.101 | enhanced |
| Hypervolume (returned set) | 0.187 | 0.370 | enhanced |
| Hypervolume (final population) | 0.189 | 0.370 | enhanced |
| Pareto front size | 1.000 | 3.000 | enhanced |
| Base stage time ms | 53.000 | 116.800 | baseline |
| Optimization time ms | 44.000 | 54.400 | baseline |

### KC57 (5 runs each, mean)

| Metric | Baseline | Enhanced | Better |
|---|---:|---:|:--:|
| Hard violations (final) | 0.400 | 0.000 | enhanced |
|   double bookings | 0.000 | 0.000 | = |
|   availability breaches | 0.400 | 0.000 | enhanced |
|   >2 periods/day of a subject | 0.000 | 0.000 | = |
| Coverage % | 100.000 | 100.000 | = |
| f1 faculty-gap score | 0.997 | 1.000 | enhanced |
| f2 student-gap score | 0.997 | 1.000 | enhanced |
| f3 workload balance | 0.583 | 0.560 | baseline |
| f4 morning preference | 0.747 | 0.911 | enhanced |
| f5 lab compactness | 0.600 | 0.533 | baseline |
| Weighted quality Q | 0.837 | 0.852 | enhanced |
| Constraint preservation % (CP) | 96.407 | 100.000 | enhanced |
| Initial diversity (PIE) | 0.179 | 0.784 | enhanced |
| Final diversity (GD) | 0.007 | 0.769 | enhanced |
| Mutation attempts / accepted | 4.225 | 1.938 | enhanced |
| Hypervolume (returned set) | 0.260 | 0.390 | enhanced |
| Hypervolume (final population) | 0.264 | 0.417 | enhanced |
| Pareto front size | 1.000 | 3.000 | enhanced |
| Base stage time ms | 28.000 | 79.200 | baseline |
| Optimization time ms | 18.800 | 35.600 | baseline |

### KC346 (5 runs each, mean)

| Metric | Baseline | Enhanced | Better |
|---|---:|---:|:--:|
| Hard violations (final) | 0.000 | 0.000 | = |
|   double bookings | 0.000 | 0.000 | = |
|   availability breaches | 0.000 | 0.000 | = |
|   >2 periods/day of a subject | 0.000 | 0.000 | = |
| Coverage % | 100.000 | 100.000 | = |
| f1 faculty-gap score | 0.994 | 0.994 | baseline |
| f2 student-gap score | 0.994 | 0.992 | baseline |
| f3 workload balance | 0.481 | 0.451 | baseline |
| f4 morning preference | 0.287 | 0.188 | baseline |
| f5 lab compactness | 0.333 | 0.733 | enhanced |
| Weighted quality Q | 0.719 | 0.738 | enhanced |
| Constraint preservation % (CP) | 96.889 | 100.000 | enhanced |
| Initial diversity (PIE) | 0.075 | 0.713 | enhanced |
| Final diversity (GD) | 0.029 | 0.775 | enhanced |
| Mutation attempts / accepted | 11.587 | 4.304 | enhanced |
| Hypervolume (returned set) | 0.045 | 0.098 | enhanced |
| Hypervolume (final population) | 0.047 | 0.105 | enhanced |
| Pareto front size | 1.000 | 3.000 | enhanced |
| Base stage time ms | 29.600 | 79.400 | baseline |
| Optimization time ms | 17.800 | 60.000 | baseline |

### College-wide check of the published timetables

Faculty double bookings: 0, room double bookings: 0, section clashes: 0, coverage 100.0%

### Incremental rescheduling (KC2-F01 unavailable on Wednesday)

| Metric | Value |
|---|---:|
| Latency ms | 5 |
| Full enhanced regeneration ms (mean) | 171 |
| Speed-up | 34.2x |
| Affected slots | 2/34 |
| SAF | 5.9% |
| Periods re-placed | 2/2 |
| Quality before -> after | 0.864 -> 0.860 (-0.40%) |
| Hard violations after | 0 |
