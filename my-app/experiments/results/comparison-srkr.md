# Baseline vs Enhanced ILP-GA - SRKR sample college (20 sections, 5 theory + 3 labs each)

- 20 sections x (5 theory x 4 + 3 labs x 3 periods) = 29 periods/week each
- 35 faculty sized at <= 18 periods/week: load 15-18 periods, mean utilization 92.1%
- 12 theory rooms + 8 lab rooms shared by all departments
- 3 runs per mode; departments scheduled in order CSE -> IT -> ECE, each around the previous ones' published timetables


### CSE (3 runs each, mean)

| Metric | Baseline | Enhanced | Better |
|---|---:|---:|:--:|
| Hard violations (final) | 0.000 | 0.000 | = |
|   double bookings | 0.000 | 0.000 | = |
|   availability breaches | 0.000 | 0.000 | = |
|   >2 periods/day of a subject | 0.000 | 0.000 | = |
| Coverage % | 100.000 | 100.000 | = |
| f1 faculty-gap score | 0.969 | 0.997 | enhanced |
| f2 student-gap score | 0.932 | 0.946 | enhanced |
| f3 workload balance | 0.719 | 0.836 | enhanced |
| f4 morning preference | 0.698 | 0.710 | enhanced |
| f5 lab compactness | 0.675 | 0.547 | baseline |
| Weighted quality Q | 0.840 | 0.864 | enhanced |
| Constraint preservation % (CP) | 94.568 | 100.000 | enhanced |
| Initial diversity (PIE) | 0.138 | 0.789 | enhanced |
| Final diversity (GD) | 0.004 | 0.643 | enhanced |
| Mutation attempts / accepted | 8.922 | 1.017 | enhanced |
| Hypervolume (returned set) | 0.306 | 0.387 | enhanced |
| Hypervolume (final population) | 0.310 | 0.395 | enhanced |
| Pareto front size | 1.000 | 3.000 | enhanced |
| Base stage time ms | 2696.333 | 6989.000 | baseline |
| Optimization time ms | 295.667 | 237.333 | enhanced |

### IT (3 runs each, mean)

| Metric | Baseline | Enhanced | Better |
|---|---:|---:|:--:|
| Hard violations (final) | 1.000 | 0.000 | enhanced |
|   double bookings | 0.000 | 0.000 | = |
|   availability breaches | 0.667 | 0.000 | enhanced |
|   >2 periods/day of a subject | 0.333 | 0.000 | enhanced |
| Coverage % | 100.000 | 100.000 | = |
| f1 faculty-gap score | 0.981 | 0.983 | enhanced |
| f2 student-gap score | 0.962 | 0.979 | enhanced |
| f3 workload balance | 0.723 | 0.719 | baseline |
| f4 morning preference | 0.686 | 0.699 | enhanced |
| f5 lab compactness | 0.763 | 0.863 | enhanced |
| Weighted quality Q | 0.859 | 0.875 | enhanced |
| Constraint preservation % (CP) | 65.185 | 100.000 | enhanced |
| Initial diversity (PIE) | 0.138 | 0.813 | enhanced |
| Final diversity (GD) | 0.011 | 0.756 | enhanced |
| Mutation attempts / accepted | 7.793 | 1.109 | enhanced |
| Hypervolume (returned set) | 0.357 | 0.444 | enhanced |
| Hypervolume (final population) | 0.365 | 0.458 | enhanced |
| Pareto front size | 1.000 | 3.000 | enhanced |
| Base stage time ms | 1207.000 | 2736.667 | baseline |
| Optimization time ms | 197.667 | 181.667 | enhanced |

### ECE (3 runs each, mean)

| Metric | Baseline | Enhanced | Better |
|---|---:|---:|:--:|
| Hard violations (final) | 0.333 | 0.000 | enhanced |
|   double bookings | 0.000 | 0.000 | = |
|   availability breaches | 0.000 | 0.000 | = |
|   >2 periods/day of a subject | 0.333 | 0.000 | enhanced |
| Coverage % | 100.000 | 100.000 | = |
| f1 faculty-gap score | 0.971 | 0.985 | enhanced |
| f2 student-gap score | 0.952 | 0.957 | enhanced |
| f3 workload balance | 0.730 | 0.766 | enhanced |
| f4 morning preference | 0.548 | 0.619 | enhanced |
| f5 lab compactness | 0.422 | 0.370 | baseline |
| Weighted quality Q | 0.800 | 0.818 | enhanced |
| Constraint preservation % (CP) | 68.272 | 100.000 | enhanced |
| Initial diversity (PIE) | 0.114 | 0.790 | enhanced |
| Final diversity (GD) | 0.008 | 0.687 | enhanced |
| Mutation attempts / accepted | 11.525 | 1.802 | enhanced |
| Hypervolume (returned set) | 0.156 | 0.224 | enhanced |
| Hypervolume (final population) | 0.158 | 0.235 | enhanced |
| Pareto front size | 1.000 | 3.000 | enhanced |
| Base stage time ms | 927.667 | 2037.000 | baseline |
| Optimization time ms | 211.333 | 296.667 | baseline |

### College-wide check of the published timetables

Faculty double bookings: 0, room double bookings: 0, section clashes: 0, coverage 100.0%

### Incremental rescheduling (CSE-F10 unavailable on Thursday)

| Metric | Value |
|---|---:|
| Latency ms | 17 |
| Full enhanced regeneration ms (mean) | 7226 |
| Speed-up | 425.1x |
| Affected slots | 2/104 |
| SAF | 1.9% |
| Periods re-placed | 6/6 |
| Quality before -> after | 0.866 -> 0.862 (-0.36%) |
| Hard violations after | 0 |
