# Baseline vs Enhanced ILP-GA - Large university (410 faculty, 4 years x 25 sections)

- 100 sections (25 per year); years 1-3: 5 theory + 3 labs, year 4: 5 theory + 1 lab
- 410 faculty (BSH 71, CSE 95, ECE 82, EEE 54, MECH 54, CIVIL 54), load 4-8 periods/week
- Theory rooms: 49 -> 2000 / 2156 periods = 92.8% utilization
- Lab rooms: 24 -> 250 / 264 lab blocks = 94.7% utilization
- 1 runs per mode; departments scheduled in order CSE:1 -> CSE:2 -> CSE:3 -> CSE:4 -> ECE:1 -> ECE:2 -> ECE:3 -> ECE:4 -> EEE:1 -> EEE:2 -> EEE:3 -> EEE:4 -> MECH:1 -> MECH:2 -> MECH:3 -> MECH:4 -> CIVIL:1 -> CIVIL:2 -> CIVIL:3 -> CIVIL:4, each around the previous ones' published timetables


### CSE:1 (1 runs each, mean)

| Metric | Baseline | Enhanced | Better |
|---|---:|---:|:--:|
| Hard violations (final) | 1.000 | 0.000 | enhanced |
|   double bookings | 0.000 | 0.000 | = |
|   availability breaches | 0.000 | 0.000 | = |
|   >2 periods/day of a subject | 1.000 | 0.000 | enhanced |
| Coverage % | 100.000 | 100.000 | = |
| f1 faculty-gap score | 1.000 | 1.000 | = |
| f2 student-gap score | 0.955 | 0.976 | enhanced |
| f3 workload balance | 0.257 | 0.264 | enhanced |
| f4 morning preference | 0.695 | 0.744 | enhanced |
| f5 lab compactness | 0.629 | 0.819 | enhanced |
| Weighted quality Q | 0.757 | 0.790 | enhanced |
| Constraint preservation % (CP) | 32.407 | 100.000 | enhanced |
| Initial diversity (PIE) | 0.204 | 0.786 | enhanced |
| Final diversity (GD) | 0.007 | 0.195 | enhanced |
| Mutation attempts / accepted | 5.298 | 1.251 | enhanced |
| Hypervolume (returned set) | 0.107 | 0.159 | enhanced |
| Hypervolume (final population) | 0.112 | 0.162 | enhanced |
| Pareto front size | 1.000 | 3.000 | enhanced |
| Base stage time ms | 5277.000 | 19025.000 | baseline |
| Optimization time ms | 190.000 | 486.000 | baseline |

### CSE:2 (1 runs each, mean)

| Metric | Baseline | Enhanced | Better |
|---|---:|---:|:--:|
| Hard violations (final) | 2.000 | 0.000 | enhanced |
|   double bookings | 0.000 | 0.000 | = |
|   availability breaches | 2.000 | 0.000 | enhanced |
|   >2 periods/day of a subject | 0.000 | 0.000 | = |
| Coverage % | 100.000 | 100.000 | = |
| f1 faculty-gap score | 1.000 | 0.999 | baseline |
| f2 student-gap score | 0.955 | 0.972 | enhanced |
| f3 workload balance | 0.327 | 0.316 | baseline |
| f4 morning preference | 0.645 | 0.621 | baseline |
| f5 lab compactness | 0.543 | 0.648 | enhanced |
| Weighted quality Q | 0.755 | 0.764 | enhanced |
| Constraint preservation % (CP) | 4.259 | 100.000 | enhanced |
| Initial diversity (PIE) | 0.130 | 0.797 | enhanced |
| Final diversity (GD) | 0.000 | 0.754 | enhanced |
| Mutation attempts / accepted | 9.477 | 1.483 | enhanced |
| Hypervolume (returned set) | 0.109 | 0.142 | enhanced |
| Hypervolume (final population) | 0.111 | 0.147 | enhanced |
| Pareto front size | 1.000 | 3.000 | enhanced |
| Base stage time ms | 3900.000 | 14599.000 | baseline |
| Optimization time ms | 144.000 | 403.000 | baseline |

### CSE:3 (1 runs each, mean)

| Metric | Baseline | Enhanced | Better |
|---|---:|---:|:--:|
| Hard violations (final) | 0.000 | 0.000 | = |
|   double bookings | 0.000 | 0.000 | = |
|   availability breaches | 0.000 | 0.000 | = |
|   >2 periods/day of a subject | 0.000 | 0.000 | = |
| Coverage % | 100.000 | 100.000 | = |
| f1 faculty-gap score | 1.000 | 1.000 | = |
| f2 student-gap score | 0.961 | 0.973 | enhanced |
| f3 workload balance | 0.454 | 0.468 | enhanced |
| f4 morning preference | 0.680 | 0.729 | enhanced |
| f5 lab compactness | 0.371 | 0.400 | enhanced |
| Weighted quality Q | 0.770 | 0.786 | enhanced |
| Constraint preservation % (CP) | 94.815 | 100.000 | enhanced |
| Initial diversity (PIE) | 0.161 | 0.774 | enhanced |
| Final diversity (GD) | 0.014 | 0.565 | enhanced |
| Mutation attempts / accepted | 7.630 | 1.464 | enhanced |
| Hypervolume (returned set) | 0.110 | 0.154 | enhanced |
| Hypervolume (final population) | 0.115 | 0.159 | enhanced |
| Pareto front size | 1.000 | 3.000 | enhanced |
| Base stage time ms | 2921.000 | 10068.000 | baseline |
| Optimization time ms | 174.000 | 354.000 | baseline |

### CSE:4 (1 runs each, mean)

| Metric | Baseline | Enhanced | Better |
|---|---:|---:|:--:|
| Hard violations (final) | 0.000 | 0.000 | = |
|   double bookings | 0.000 | 0.000 | = |
|   availability breaches | 0.000 | 0.000 | = |
|   >2 periods/day of a subject | 0.000 | 0.000 | = |
| Coverage % | 100.000 | 100.000 | = |
| f1 faculty-gap score | 1.000 | 1.000 | = |
| f2 student-gap score | 0.971 | 0.980 | enhanced |
| f3 workload balance | 0.401 | 0.401 | = |
| f4 morning preference | 0.646 | 0.634 | baseline |
| f5 lab compactness | 0.600 | 0.743 | enhanced |
| Weighted quality Q | 0.780 | 0.795 | enhanced |
| Constraint preservation % (CP) | 98.148 | 100.000 | enhanced |
| Initial diversity (PIE) | 0.186 | 0.752 | enhanced |
| Final diversity (GD) | 0.000 | 0.713 | enhanced |
| Mutation attempts / accepted | 6.822 | 2.615 | enhanced |
| Hypervolume (returned set) | 0.151 | 0.201 | enhanced |
| Hypervolume (final population) | 0.154 | 0.207 | enhanced |
| Pareto front size | 1.000 | 3.000 | enhanced |
| Base stage time ms | 712.000 | 2040.000 | baseline |
| Optimization time ms | 111.000 | 255.000 | baseline |

### ECE:1 (1 runs each, mean)

| Metric | Baseline | Enhanced | Better |
|---|---:|---:|:--:|
| Hard violations (final) | 2.000 | 0.000 | enhanced |
|   double bookings | 0.000 | 0.000 | = |
|   availability breaches | 0.000 | 0.000 | = |
|   >2 periods/day of a subject | 2.000 | 0.000 | enhanced |
| Coverage % | 100.000 | 100.000 | = |
| f1 faculty-gap score | 1.000 | 1.000 | = |
| f2 student-gap score | 0.971 | 0.965 | baseline |
| f3 workload balance | 0.242 | 0.256 | enhanced |
| f4 morning preference | 0.483 | 0.483 | = |
| f5 lab compactness | 0.533 | 0.622 | enhanced |
| Weighted quality Q | 0.717 | 0.727 | enhanced |
| Constraint preservation % (CP) | 45.741 | 100.000 | enhanced |
| Initial diversity (PIE) | 0.115 | 0.812 | enhanced |
| Final diversity (GD) | 0.002 | 0.666 | enhanced |
| Mutation attempts / accepted | 10.678 | 3.198 | enhanced |
| Hypervolume (returned set) | 0.061 | 0.080 | enhanced |
| Hypervolume (final population) | 0.061 | 0.083 | enhanced |
| Pareto front size | 1.000 | 3.000 | enhanced |
| Base stage time ms | 2693.000 | 11500.000 | baseline |
| Optimization time ms | 116.000 | 161.000 | baseline |

### ECE:2 (1 runs each, mean)

| Metric | Baseline | Enhanced | Better |
|---|---:|---:|:--:|
| Hard violations (final) | 0.000 | 0.000 | = |
|   double bookings | 0.000 | 0.000 | = |
|   availability breaches | 0.000 | 0.000 | = |
|   >2 periods/day of a subject | 0.000 | 0.000 | = |
| Coverage % | 100.000 | 100.000 | = |
| f1 faculty-gap score | 1.000 | 1.000 | = |
| f2 student-gap score | 0.931 | 0.958 | enhanced |
| f3 workload balance | 0.338 | 0.337 | baseline |
| f4 morning preference | 0.534 | 0.563 | enhanced |
| f5 lab compactness | 0.422 | 0.389 | baseline |
| Weighted quality Q | 0.723 | 0.730 | enhanced |
| Constraint preservation % (CP) | 98.704 | 100.000 | enhanced |
| Initial diversity (PIE) | 0.077 | 0.758 | enhanced |
| Final diversity (GD) | 0.000 | 0.607 | enhanced |
| Mutation attempts / accepted | 13.660 | 2.818 | enhanced |
| Hypervolume (returned set) | 0.071 | 0.081 | enhanced |
| Hypervolume (final population) | 0.071 | 0.082 | enhanced |
| Pareto front size | 1.000 | 3.000 | enhanced |
| Base stage time ms | 1973.000 | 5812.000 | baseline |
| Optimization time ms | 127.000 | 284.000 | baseline |

### ECE:3 (1 runs each, mean)

| Metric | Baseline | Enhanced | Better |
|---|---:|---:|:--:|
| Hard violations (final) | 2.000 | 0.000 | enhanced |
|   double bookings | 0.000 | 0.000 | = |
|   availability breaches | 0.000 | 0.000 | = |
|   >2 periods/day of a subject | 2.000 | 0.000 | enhanced |
| Coverage % | 100.000 | 100.000 | = |
| f1 faculty-gap score | 0.993 | 1.000 | enhanced |
| f2 student-gap score | 0.983 | 0.962 | baseline |
| f3 workload balance | 0.453 | 0.468 | enhanced |
| f4 morning preference | 0.615 | 0.644 | enhanced |
| f5 lab compactness | 0.589 | 0.644 | enhanced |
| Weighted quality Q | 0.785 | 0.795 | enhanced |
| Constraint preservation % (CP) | 8.889 | 100.000 | enhanced |
| Initial diversity (PIE) | 0.099 | 0.812 | enhanced |
| Final diversity (GD) | 0.016 | 0.431 | enhanced |
| Mutation attempts / accepted | 10.126 | 2.139 | enhanced |
| Hypervolume (returned set) | 0.160 | 0.192 | enhanced |
| Hypervolume (final population) | 0.169 | 0.195 | enhanced |
| Pareto front size | 1.000 | 3.000 | enhanced |
| Base stage time ms | 1912.000 | 3227.000 | baseline |
| Optimization time ms | 103.000 | 312.000 | baseline |

### ECE:4 (1 runs each, mean)

| Metric | Baseline | Enhanced | Better |
|---|---:|---:|:--:|
| Hard violations (final) | 0.000 | 0.000 | = |
|   double bookings | 0.000 | 0.000 | = |
|   availability breaches | 0.000 | 0.000 | = |
|   >2 periods/day of a subject | 0.000 | 0.000 | = |
| Coverage % | 100.000 | 100.000 | = |
| f1 faculty-gap score | 1.000 | 1.000 | = |
| f2 student-gap score | 0.917 | 0.943 | enhanced |
| f3 workload balance | 0.401 | 0.401 | = |
| f4 morning preference | 0.565 | 0.630 | enhanced |
| f5 lab compactness | 0.733 | 0.667 | baseline |
| Weighted quality Q | 0.767 | 0.777 | enhanced |
| Constraint preservation % (CP) | 98.704 | 100.000 | enhanced |
| Initial diversity (PIE) | 0.169 | 0.807 | enhanced |
| Final diversity (GD) | 0.000 | 0.720 | enhanced |
| Mutation attempts / accepted | 8.444 | 2.836 | enhanced |
| Hypervolume (returned set) | 0.152 | 0.186 | enhanced |
| Hypervolume (final population) | 0.155 | 0.190 | enhanced |
| Pareto front size | 1.000 | 3.000 | enhanced |
| Base stage time ms | 379.000 | 974.000 | baseline |
| Optimization time ms | 82.000 | 159.000 | baseline |

### EEE:1 (1 runs each, mean)

| Metric | Baseline | Enhanced | Better |
|---|---:|---:|:--:|
| Hard violations (final) | 0.000 | 0.000 | = |
|   double bookings | 0.000 | 0.000 | = |
|   availability breaches | 0.000 | 0.000 | = |
|   >2 periods/day of a subject | 0.000 | 0.000 | = |
| Coverage % | 100.000 | 100.000 | = |
| f1 faculty-gap score | 1.000 | 1.000 | = |
| f2 student-gap score | 0.917 | 0.932 | enhanced |
| f3 workload balance | 0.242 | 0.238 | baseline |
| f4 morning preference | 0.371 | 0.371 | = |
| f5 lab compactness | 0.600 | 0.600 | = |
| Weighted quality Q | 0.693 | 0.696 | enhanced |
| Constraint preservation % (CP) | 100.000 | 100.000 | = |
| Initial diversity (PIE) | 0.053 | 0.621 | enhanced |
| Final diversity (GD) | 0.000 | 0.672 | enhanced |
| Mutation attempts / accepted | 20.237 | 5.933 | enhanced |
| Hypervolume (returned set) | 0.049 | 0.057 | enhanced |
| Hypervolume (final population) | 0.050 | 0.059 | enhanced |
| Pareto front size | 1.000 | 3.000 | enhanced |
| Base stage time ms | 921.000 | 3091.000 | baseline |
| Optimization time ms | 74.000 | 227.000 | baseline |

### EEE:2 (1 runs each, mean)

| Metric | Baseline | Enhanced | Better |
|---|---:|---:|:--:|
| Hard violations (final) | 0.000 | 0.000 | = |
|   double bookings | 0.000 | 0.000 | = |
|   availability breaches | 0.000 | 0.000 | = |
|   >2 periods/day of a subject | 0.000 | 0.000 | = |
| Coverage % | 100.000 | 100.000 | = |
| f1 faculty-gap score | 1.000 | 1.000 | = |
| f2 student-gap score | 0.969 | 0.990 | enhanced |
| f3 workload balance | 0.323 | 0.318 | baseline |
| f4 morning preference | 0.578 | 0.578 | = |
| f5 lab compactness | 0.450 | 0.467 | enhanced |
| Weighted quality Q | 0.739 | 0.744 | enhanced |
| Constraint preservation % (CP) | 99.074 | 100.000 | enhanced |
| Initial diversity (PIE) | 0.116 | 0.725 | enhanced |
| Final diversity (GD) | 0.003 | 0.663 | enhanced |
| Mutation attempts / accepted | 9.714 | 3.561 | enhanced |
| Hypervolume (returned set) | 0.081 | 0.100 | enhanced |
| Hypervolume (final population) | 0.083 | 0.103 | enhanced |
| Pareto front size | 1.000 | 3.000 | enhanced |
| Base stage time ms | 678.000 | 1897.000 | baseline |
| Optimization time ms | 58.000 | 269.000 | baseline |

### EEE:3 (1 runs each, mean)

| Metric | Baseline | Enhanced | Better |
|---|---:|---:|:--:|
| Hard violations (final) | 0.000 | 0.000 | = |
|   double bookings | 0.000 | 0.000 | = |
|   availability breaches | 0.000 | 0.000 | = |
|   >2 periods/day of a subject | 0.000 | 0.000 | = |
| Coverage % | 100.000 | 100.000 | = |
| f1 faculty-gap score | 1.000 | 1.000 | = |
| f2 student-gap score | 0.943 | 0.953 | enhanced |
| f3 workload balance | 0.471 | 0.471 | = |
| f4 morning preference | 0.578 | 0.595 | enhanced |
| f5 lab compactness | 0.533 | 0.533 | = |
| Weighted quality Q | 0.770 | 0.775 | enhanced |
| Constraint preservation % (CP) | 97.222 | 100.000 | enhanced |
| Initial diversity (PIE) | 0.084 | 0.764 | enhanced |
| Final diversity (GD) | 0.006 | 0.630 | enhanced |
| Mutation attempts / accepted | 12.688 | 2.774 | enhanced |
| Hypervolume (returned set) | 0.137 | 0.158 | enhanced |
| Hypervolume (final population) | 0.139 | 0.159 | enhanced |
| Pareto front size | 1.000 | 3.000 | enhanced |
| Base stage time ms | 581.000 | 1717.000 | baseline |
| Optimization time ms | 57.000 | 205.000 | baseline |

### EEE:4 (1 runs each, mean)

| Metric | Baseline | Enhanced | Better |
|---|---:|---:|:--:|
| Hard violations (final) | 0.000 | 0.000 | = |
|   double bookings | 0.000 | 0.000 | = |
|   availability breaches | 0.000 | 0.000 | = |
|   >2 periods/day of a subject | 0.000 | 0.000 | = |
| Coverage % | 100.000 | 100.000 | = |
| f1 faculty-gap score | 1.000 | 1.000 | = |
| f2 student-gap score | 0.990 | 1.000 | enhanced |
| f3 workload balance | 0.401 | 0.401 | = |
| f4 morning preference | 0.554 | 0.576 | enhanced |
| f5 lab compactness | 0.300 | 0.300 | = |
| Weighted quality Q | 0.741 | 0.747 | enhanced |
| Constraint preservation % (CP) | 98.333 | 100.000 | enhanced |
| Initial diversity (PIE) | 0.145 | 0.751 | enhanced |
| Final diversity (GD) | 0.008 | 0.749 | enhanced |
| Mutation attempts / accepted | 8.578 | 3.573 | enhanced |
| Hypervolume (returned set) | 0.066 | 0.090 | enhanced |
| Hypervolume (final population) | 0.067 | 0.092 | enhanced |
| Pareto front size | 1.000 | 3.000 | enhanced |
| Base stage time ms | 148.000 | 225.000 | baseline |
| Optimization time ms | 49.000 | 129.000 | baseline |

### MECH:1 (1 runs each, mean)

| Metric | Baseline | Enhanced | Better |
|---|---:|---:|:--:|
| Hard violations (final) | 0.000 | 0.000 | = |
|   double bookings | 0.000 | 0.000 | = |
|   availability breaches | 0.000 | 0.000 | = |
|   >2 periods/day of a subject | 0.000 | 0.000 | = |
| Coverage % | 100.000 | 100.000 | = |
| f1 faculty-gap score | 1.000 | 1.000 | = |
| f2 student-gap score | 0.958 | 0.938 | baseline |
| f3 workload balance | 0.234 | 0.230 | baseline |
| f4 morning preference | 0.526 | 0.595 | enhanced |
| f5 lab compactness | 0.450 | 0.517 | enhanced |
| Weighted quality Q | 0.710 | 0.721 | enhanced |
| Constraint preservation % (CP) | 96.852 | 100.000 | enhanced |
| Initial diversity (PIE) | 0.153 | 0.793 | enhanced |
| Final diversity (GD) | 0.003 | 0.717 | enhanced |
| Mutation attempts / accepted | 9.794 | 2.618 | enhanced |
| Hypervolume (returned set) | 0.053 | 0.074 | enhanced |
| Hypervolume (final population) | 0.054 | 0.077 | enhanced |
| Pareto front size | 1.000 | 3.000 | enhanced |
| Base stage time ms | 665.000 | 1964.000 | baseline |
| Optimization time ms | 56.000 | 86.000 | baseline |

### MECH:2 (1 runs each, mean)

| Metric | Baseline | Enhanced | Better |
|---|---:|---:|:--:|
| Hard violations (final) | 0.000 | 0.000 | = |
|   double bookings | 0.000 | 0.000 | = |
|   availability breaches | 0.000 | 0.000 | = |
|   >2 periods/day of a subject | 0.000 | 0.000 | = |
| Coverage % | 100.000 | 100.000 | = |
| f1 faculty-gap score | 1.000 | 1.000 | = |
| f2 student-gap score | 0.940 | 1.000 | enhanced |
| f3 workload balance | 0.321 | 0.326 | enhanced |
| f4 morning preference | 0.552 | 0.552 | = |
| f5 lab compactness | 0.533 | 0.533 | = |
| Weighted quality Q | 0.735 | 0.751 | enhanced |
| Constraint preservation % (CP) | 99.074 | 100.000 | enhanced |
| Initial diversity (PIE) | 0.084 | 0.798 | enhanced |
| Final diversity (GD) | 0.009 | 0.538 | enhanced |
| Mutation attempts / accepted | 13.420 | 3.092 | enhanced |
| Hypervolume (returned set) | 0.089 | 0.103 | enhanced |
| Hypervolume (final population) | 0.091 | 0.103 | enhanced |
| Pareto front size | 1.000 | 3.000 | enhanced |
| Base stage time ms | 466.000 | 1141.000 | baseline |
| Optimization time ms | 57.000 | 219.000 | baseline |

### MECH:3 (1 runs each, mean)

| Metric | Baseline | Enhanced | Better |
|---|---:|---:|:--:|
| Hard violations (final) | 3.000 | 0.000 | enhanced |
|   double bookings | 0.000 | 0.000 | = |
|   availability breaches | 0.000 | 0.000 | = |
|   >2 periods/day of a subject | 0.000 | 0.000 | = |
| Coverage % | 97.414 | 100.000 | enhanced |
| f1 faculty-gap score | 1.000 | 1.000 | = |
| f2 student-gap score | 0.875 | 0.922 | enhanced |
| f3 workload balance | 0.463 | 0.487 | enhanced |
| f4 morning preference | 0.416 | 0.405 | baseline |
| f5 lab compactness | 0.500 | 0.500 | = |
| Weighted quality Q | 0.724 | 0.739 | enhanced |
| Constraint preservation % (CP) | 100.000 | 100.000 | = |
| Initial diversity (PIE) | 0.031 | 0.189 | enhanced |
| Final diversity (GD) | 0.000 | 0.207 | enhanced |
| Mutation attempts / accepted | 24.037 | 18.930 | enhanced |
| Hypervolume (returned set) | 0.084 | 0.093 | enhanced |
| Hypervolume (final population) | 0.084 | 0.093 | enhanced |
| Pareto front size | 1.000 | 3.000 | enhanced |
| Base stage time ms | 398.000 | 1101.000 | baseline |
| Optimization time ms | 66.000 | 370.000 | baseline |

### MECH:4 (1 runs each, mean)

| Metric | Baseline | Enhanced | Better |
|---|---:|---:|:--:|
| Hard violations (final) | 0.000 | 0.000 | = |
|   double bookings | 0.000 | 0.000 | = |
|   availability breaches | 0.000 | 0.000 | = |
|   >2 periods/day of a subject | 0.000 | 0.000 | = |
| Coverage % | 100.000 | 100.000 | = |
| f1 faculty-gap score | 1.000 | 0.994 | baseline |
| f2 student-gap score | 0.967 | 0.966 | baseline |
| f3 workload balance | 0.401 | 0.389 | baseline |
| f4 morning preference | 0.565 | 0.598 | enhanced |
| f5 lab compactness | 0.500 | 0.850 | enhanced |
| Weighted quality Q | 0.757 | 0.792 | enhanced |
| Constraint preservation % (CP) | 98.519 | 100.000 | enhanced |
| Initial diversity (PIE) | 0.138 | 0.720 | enhanced |
| Final diversity (GD) | 0.053 | 0.718 | enhanced |
| Mutation attempts / accepted | 9.400 | 3.538 | enhanced |
| Hypervolume (returned set) | 0.110 | 0.224 | enhanced |
| Hypervolume (final population) | 0.113 | 0.233 | enhanced |
| Pareto front size | 1.000 | 3.000 | enhanced |
| Base stage time ms | 92.000 | 180.000 | baseline |
| Optimization time ms | 41.000 | 114.000 | baseline |

### CIVIL:1 (1 runs each, mean)

| Metric | Baseline | Enhanced | Better |
|---|---:|---:|:--:|
| Hard violations (final) | 0.000 | 0.000 | = |
|   double bookings | 0.000 | 0.000 | = |
|   availability breaches | 0.000 | 0.000 | = |
|   >2 periods/day of a subject | 0.000 | 0.000 | = |
| Coverage % | 100.000 | 100.000 | = |
| f1 faculty-gap score | 1.000 | 1.000 | = |
| f2 student-gap score | 0.948 | 0.979 | enhanced |
| f3 workload balance | 0.230 | 0.230 | = |
| f4 morning preference | 0.595 | 0.569 | baseline |
| f5 lab compactness | 0.583 | 0.600 | enhanced |
| Weighted quality Q | 0.730 | 0.736 | enhanced |
| Constraint preservation % (CP) | 98.333 | 100.000 | enhanced |
| Initial diversity (PIE) | 0.120 | 0.775 | enhanced |
| Final diversity (GD) | 0.008 | 0.713 | enhanced |
| Mutation attempts / accepted | 10.698 | 2.343 | enhanced |
| Hypervolume (returned set) | 0.076 | 0.091 | enhanced |
| Hypervolume (final population) | 0.077 | 0.094 | enhanced |
| Pareto front size | 1.000 | 3.000 | enhanced |
| Base stage time ms | 463.000 | 1050.000 | baseline |
| Optimization time ms | 64.000 | 138.000 | baseline |

### CIVIL:2 (1 runs each, mean)

| Metric | Baseline | Enhanced | Better |
|---|---:|---:|:--:|
| Hard violations (final) | 1.000 | 0.000 | enhanced |
|   double bookings | 0.000 | 0.000 | = |
|   availability breaches | 0.000 | 0.000 | = |
|   >2 periods/day of a subject | 1.000 | 0.000 | enhanced |
| Coverage % | 100.000 | 100.000 | = |
| f1 faculty-gap score | 0.995 | 1.000 | enhanced |
| f2 student-gap score | 0.973 | 0.951 | baseline |
| f3 workload balance | 0.299 | 0.323 | enhanced |
| f4 morning preference | 0.560 | 0.578 | enhanced |
| f5 lab compactness | 0.467 | 0.550 | enhanced |
| Weighted quality Q | 0.732 | 0.744 | enhanced |
| Constraint preservation % (CP) | 45.000 | 100.000 | enhanced |
| Initial diversity (PIE) | 0.096 | 0.771 | enhanced |
| Final diversity (GD) | 0.003 | 0.646 | enhanced |
| Mutation attempts / accepted | 13.271 | 2.663 | enhanced |
| Hypervolume (returned set) | 0.076 | 0.111 | enhanced |
| Hypervolume (final population) | 0.078 | 0.117 | enhanced |
| Pareto front size | 1.000 | 3.000 | enhanced |
| Base stage time ms | 234.000 | 961.000 | baseline |
| Optimization time ms | 65.000 | 121.000 | baseline |

### CIVIL:3 (1 runs each, mean)

| Metric | Baseline | Enhanced | Better |
|---|---:|---:|:--:|
| Hard violations (final) | 0.000 | 0.000 | = |
|   double bookings | 0.000 | 0.000 | = |
|   availability breaches | 0.000 | 0.000 | = |
|   >2 periods/day of a subject | 0.000 | 0.000 | = |
| Coverage % | 100.000 | 100.000 | = |
| f1 faculty-gap score | 1.000 | 1.000 | = |
| f2 student-gap score | 0.962 | 0.962 | = |
| f3 workload balance | 0.468 | 0.468 | = |
| f4 morning preference | 0.552 | 0.586 | enhanced |
| f5 lab compactness | 0.533 | 0.533 | = |
| Weighted quality Q | 0.770 | 0.775 | enhanced |
| Constraint preservation % (CP) | 99.630 | 100.000 | enhanced |
| Initial diversity (PIE) | 0.087 | 0.684 | enhanced |
| Final diversity (GD) | 0.009 | 0.577 | enhanced |
| Mutation attempts / accepted | 12.852 | 2.569 | enhanced |
| Hypervolume (returned set) | 0.132 | 0.147 | enhanced |
| Hypervolume (final population) | 0.135 | 0.147 | enhanced |
| Pareto front size | 1.000 | 3.000 | enhanced |
| Base stage time ms | 168.000 | 920.000 | baseline |
| Optimization time ms | 50.000 | 122.000 | baseline |

### CIVIL:4 (1 runs each, mean)

| Metric | Baseline | Enhanced | Better |
|---|---:|---:|:--:|
| Hard violations (final) | 0.000 | 0.000 | = |
|   double bookings | 0.000 | 0.000 | = |
|   availability breaches | 0.000 | 0.000 | = |
|   >2 periods/day of a subject | 0.000 | 0.000 | = |
| Coverage % | 100.000 | 100.000 | = |
| f1 faculty-gap score | 1.000 | 1.000 | = |
| f2 student-gap score | 0.859 | 0.864 | enhanced |
| f3 workload balance | 0.410 | 0.410 | = |
| f4 morning preference | 0.348 | 0.348 | = |
| f5 lab compactness | 0.100 | 0.100 | = |
| Weighted quality Q | 0.659 | 0.660 | enhanced |
| Constraint preservation % (CP) | 100.000 | 100.000 | = |
| Initial diversity (PIE) | 0.008 | 0.096 | enhanced |
| Final diversity (GD) | 0.008 | 0.160 | enhanced |
| Mutation attempts / accepted | 34.667 | 40.716 | baseline |
| Hypervolume (returned set) | 0.012 | 0.012 | enhanced |
| Hypervolume (final population) | 0.013 | 0.012 | baseline |
| Pareto front size | 1.000 | 2.000 | enhanced |
| Base stage time ms | 44.000 | 143.000 | baseline |
| Optimization time ms | 56.000 | 192.000 | baseline |

### College-wide check of the published timetables

Faculty double bookings: 0, room double bookings: 0, section clashes: 0, coverage 100.0%

### Incremental rescheduling (U-BSH-F035 unavailable on Tuesday)

| Metric | Value |
|---|---:|
| Latency ms | 12 |
| Full enhanced regeneration ms (mean) | 19511 |
| Speed-up | 1625.9x |
| Affected slots | 1/91 |
| SAF | 1.1% |
| Periods re-placed | 3/3 |
| Quality before -> after | 0.790 -> 0.784 (-0.76%) |
| Hard violations after | 0 |
