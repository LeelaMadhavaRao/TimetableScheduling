# Baseline vs Enhanced ILP-GA - offline comparison


### CSE (5 runs each, mean)

| Metric | Baseline | Enhanced | Better |
|---|---:|---:|:--:|
| Hard violations (final) | 0.000 | 0.000 | = |
|   double bookings | 0.000 | 0.000 | = |
|   availability breaches | 0.000 | 0.000 | = |
|   >2 periods/day of a subject | 0.000 | 0.000 | = |
| Coverage % | 100.000 | 100.000 | = |
| f1 faculty-gap score | 0.997 | 0.995 | baseline |
| f2 student-gap score | 0.973 | 0.992 | enhanced |
| f3 workload balance | 0.673 | 0.668 | baseline |
| f4 morning preference | 0.821 | 0.829 | enhanced |
| f5 lab compactness | 0.808 | 0.920 | enhanced |
| Weighted quality Q | 0.881 | 0.896 | enhanced |
| Constraint preservation % (CP) | 95.407 | 100.000 | enhanced |
| Initial diversity (PIE) | 0.192 | 0.841 | enhanced |
| Final diversity (GD) | 0.004 | 0.758 | enhanced |
| Mutation attempts / accepted | 4.170 | 7.333 | baseline |
| Hypervolume (returned set) | 0.434 | 0.559 | enhanced |
| Hypervolume (final population) | 0.437 | 0.562 | enhanced |
| Pareto front size | 1.000 | 12.000 | enhanced |
| Base stage time ms | 181.400 | 790.800 | baseline |
| Optimization time ms | 68.600 | 243.800 | baseline |

### IT (5 runs each, mean)

| Metric | Baseline | Enhanced | Better |
|---|---:|---:|:--:|
| Hard violations (final) | 1.000 | 0.000 | enhanced |
|   double bookings | 0.000 | 0.000 | = |
|   availability breaches | 0.800 | 0.000 | enhanced |
|   >2 periods/day of a subject | 0.200 | 0.000 | enhanced |
| Coverage % | 100.000 | 100.000 | = |
| f1 faculty-gap score | 1.000 | 1.000 | = |
| f2 student-gap score | 0.976 | 0.993 | enhanced |
| f3 workload balance | 0.460 | 0.468 | enhanced |
| f4 morning preference | 0.674 | 0.855 | enhanced |
| f5 lab compactness | 0.504 | 0.800 | enhanced |
| Weighted quality Q | 0.788 | 0.850 | enhanced |
| Constraint preservation % (CP) | 58.000 | 100.000 | enhanced |
| Initial diversity (PIE) | 0.151 | 0.795 | enhanced |
| Final diversity (GD) | 0.032 | 0.743 | enhanced |
| Mutation attempts / accepted | 4.667 | 5.472 | baseline |
| Hypervolume (returned set) | 0.153 | 0.380 | enhanced |
| Hypervolume (final population) | 0.157 | 0.387 | enhanced |
| Pareto front size | 1.000 | 12.000 | enhanced |
| Base stage time ms | 64.800 | 320.400 | baseline |
| Optimization time ms | 26.800 | 111.600 | baseline |

### ECE (5 runs each, mean)

| Metric | Baseline | Enhanced | Better |
|---|---:|---:|:--:|
| Hard violations (final) | 0.000 | 0.000 | = |
|   double bookings | 0.000 | 0.000 | = |
|   availability breaches | 0.000 | 0.000 | = |
|   >2 periods/day of a subject | 0.000 | 0.000 | = |
| Coverage % | 100.000 | 100.000 | = |
| f1 faculty-gap score | 1.000 | 0.996 | baseline |
| f2 student-gap score | 0.997 | 0.977 | baseline |
| f3 workload balance | 0.548 | 0.603 | enhanced |
| f4 morning preference | 0.552 | 0.710 | enhanced |
| f5 lab compactness | 0.344 | 0.480 | enhanced |
| Weighted quality Q | 0.776 | 0.818 | enhanced |
| Constraint preservation % (CP) | 97.148 | 100.000 | enhanced |
| Initial diversity (PIE) | 0.114 | 0.845 | enhanced |
| Final diversity (GD) | 0.018 | 0.829 | enhanced |
| Mutation attempts / accepted | 7.323 | 10.175 | baseline |
| Hypervolume (returned set) | 0.103 | 0.275 | enhanced |
| Hypervolume (final population) | 0.119 | 0.283 | enhanced |
| Pareto front size | 1.000 | 12.000 | enhanced |
| Base stage time ms | 60.800 | 326.000 | baseline |
| Optimization time ms | 26.600 | 142.200 | baseline |

### College-wide check of the published timetables

Faculty double bookings: 0, room double bookings: 0, section clashes: 0, coverage 100.0%

### Incremental rescheduling (CSE-F05 unavailable on Tuesday)

| Metric | Value |
|---|---:|
| Latency ms | 8 |
| Full enhanced regeneration ms (mean) | 1035 |
| Speed-up | 129.3x |
| Affected slots | 2/59 |
| SAF | 3.4% |
| Periods re-placed | 5/5 |
| Quality before -> after | 0.896 -> 0.888 (-0.92%) |
| Hard violations after | 0 |
