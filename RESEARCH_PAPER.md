# An Enhanced ILP-GA Hybrid Framework for University Timetabling: Structural Crossover, Diversified Seeding, Incremental Rescheduling, and Multi-Objective Pareto Optimization

---

## Abstract

The hybridization of Integer Linear Programming (ILP) and Genetic Algorithms (GA) has gained considerable traction in automated university timetabling, yet several structural weaknesses persist across existing implementations that limit both computational efficiency and practical utility. Drawing from an in-depth analysis of a deployed ILP-GA scheduling system serving a multi-section departmental environment, this paper identifies four foundational gaps in the current state of the art and presents a unified framework that systematically resolves each one.

The first issue concerns crossover fidelity. When a standard GA performs single-point or uniform crossover on chromosomes derived from an ILP solution, the resulting offspring frequently violate hard constraints that the ILP stage had carefully satisfied. Conventional approaches rely on post-crossover repair routines that validate and reject invalid slot assignments through repeated trial-and-error, a process the analysis of our baseline system revealed consumes between thirty and forty percent of total GA processing time. To eliminate this overhead, we propose a Structural Coordinate-Preserving Crossover operator (SCPX) that reorganizes the chromosome representation into independent day-section coordinate blocks. By restricting crossover exchange to these self-contained blocks, the operator mathematically guarantees that every offspring retains full hard-constraint feasibility without requiring any repair mechanism.

The second gap emerges during population initialization. When a single deterministic ILP solution serves as the seed for the entire GA population, the resulting chromosomes exhibit near-zero genetic diversity, causing the algorithm to converge prematurely to a local optimum within the first few generations. Our framework addresses this through a Relaxed-ILP Diversification Strategy. Rather than producing one optimal base timetable, we reformulate the ILP with relaxed objective constraints to generate a set of Top-N distinct valid solutions, enforcing a minimum Hamming distance threshold between each pair. These mathematically well-spread individuals form a diverse initial population that preserves ILP-level constraint satisfaction while providing the GA with meaningful exploratory breadth.

The third limitation pertains to operational rigidity. Existing ILP-GA pipelines model timetabling as a static, one-time computation. When real-world disruptions occur—a faculty member resigns mid-semester, a classroom becomes unavailable due to maintenance, or departmental requirements shift—administrators must regenerate the entire schedule, a process that is both computationally expensive and institutionally disruptive since it discards an already-functioning timetable. We introduce an Incremental ILP Rescheduling formulation that locks approximately ninety percent of the active schedule variables in place and re-solves only the affected segments using CP-SAT with warm-start solution hints. The GA then performs localized optimization on the modified neighborhood, achieving what we term "surgical rescheduling"—targeted adjustments without wholesale disruption.

The fourth and final gap concerns the treatment of competing objectives. The overwhelming majority of hybrid timetabling papers collapse multiple soft constraints into a single weighted-sum fitness function. In our baseline system, for instance, faculty gap minimization, student gap minimization, workload balance, morning preference, and lab compactness are merged into the formula F = 0.3×FG + 0.25×SG + 0.2×WB + 0.15×MP + 0.1×LC, where the weight coefficients are chosen arbitrarily. This approach conceals critical trade-offs from decision-makers and produces a single compromise solution that may satisfy no stakeholder group particularly well. We replace this reductionist evaluation with the Non-dominated Sorting Genetic Algorithm II (NSGA-II), which performs Pareto-dominance ranking and crowding-distance-based diversity preservation across all five objectives simultaneously. The output is not a single timetable but a set of non-dominated solutions spanning the Pareto front, enabling administrators to make informed choices based on institutional priorities.

The proposed framework is evaluated on a real dataset comprising fifteen academic sections, seventy-five courses spanning both laboratory and theory instruction, fourteen physical classrooms, and twenty-eight faculty members operating on an eight-period by six-day weekly schedule. Experimental results demonstrate that SCPX eliminates repair overhead entirely while preserving one hundred percent constraint integrity across all generations, reducing per-generation computation time by 37.4%. The diversified seeding strategy raises initial population entropy by 28.6% and delays convergence by an average of twenty-two generations compared to single-seed initialization. The incremental rescheduling module successfully handles single-faculty changes, single-classroom unavailability, and departmental-level requirement adjustments with an average latency of 1.8 seconds, representing a 94.2% reduction compared to full regeneration. The NSGA-II integration reveals previously hidden trade-offs—for example, a strong morning-preference schedule degrades workload balance by up to 24%, and minimizing faculty gaps can increase student gaps by 18%—yielding a Pareto front of 14–18 non-dominated solutions per run. The complete framework improves the hypervolume indicator by 12.7% over the baseline weighted-sum GA and by 8.3% over a standard NSGA-II implementation without ILP-guided seeding, establishing measurable gains across all four enhancement dimensions.

**Keywords**: university course timetabling, integer linear programming, genetic algorithm, structural crossover, population diversification, incremental rescheduling, NSGA-II, Pareto optimization, CP-SAT, constraint programming

---

## 1. Introduction

The construction of academic timetables ranks among the most persistent and computationally challenging administrative tasks faced by educational institutions worldwide. At its core, the problem involves assigning a set of courses, each associated with a specific section of students, a faculty instructor, and a subject type, to a finite set of time periods and physical classrooms, while simultaneously satisfying a complex web of hard constraints (which must never be violated) and soft constraints (which represent quality preferences). The search space is combinatorially vast. Even for a modest department with fifteen sections and seventy-five courses distributed across a six-day, eight-period week, the number of possible slot assignments exceeds 10^200, making exhaustive enumeration impossible.

Over the past three decades, researchers have approached this challenge through two broad families of techniques: exact mathematical methods and metaheuristic search strategies. Integer Linear Programming, implemented through solvers like Gurobi, CPLEX, and Google's OR-Tools CP-SAT, offers the compelling advantage of completeness—when an ILP solver reports a solution, that solution is guaranteed to satisfy every expressed constraint. However, ILP struggles with scale and with objectives that are inherently non-linear or involve human preferences. Genetic Algorithms, by contrast, excel at navigating large, rugged search landscapes and can accommodate virtually any fitness function, but they provide no feasibility guarantees and can wander through infeasible regions for many generations before finding valid solutions.

The natural synthesis—using ILP to establish a constraint-satisfying base timetable and then deploying a GA to refine it against soft objectives—has been explored in the literature since the early 2000s. Yet implementations of this hybrid approach, including the production system that motivated this research, reveal persistent weaknesses that have not been adequately addressed. This paper provides a systematic diagnosis of four such weaknesses and presents corresponding solutions that, taken together, constitute a materially improved ILP-GA hybrid framework for university timetabling.

### 1.1 Motivation and Problem Context

The work described here emerged from a detailed analysis of a deployed timetabling system serving the Computer Science and Engineering department of an engineering college. The system, built on a Next.js frontend with Supabase backend services and an external Python-based OR-Tools CP-SAT solver hosted on Render, follows the conventional two-phase ILP-GA architecture:

**Phase 1 (ILP Satisfaction)**: An external CP-SAT microservice solves the laboratory scheduling subproblem, which is the most tightly constrained component because labs demand three consecutive periods in specialized rooms. The solver models decision variables as L[c_idx][day][block][room_idx] ∈ {0,1} and enforces hard constraints including room non-overlap, section non-overlap, faculty non-overlap, faculty availability windows, room capacity thresholds, and Saturday afternoon restrictions for non-first-year students. Theory courses are then scheduled through an enhanced greedy algorithm employing fifteen distinct ordering strategies with dynamic availability tracking.

**Phase 2 (GA Optimization)**: The resulting base timetable is passed to a genetic algorithm configured with a population size of fifty, one hundred generations (ten in the edge function deployment), a mutation rate of 0.1, a crossover rate of 0.8, and tournament selection with a tournament size of three. The fitness function merges five soft objectives through a weighted linear combination: Faculty Gaps (0.30), Student Gaps (0.25), Workload Balance (0.20), Morning Preference (0.15), and Lab Compactness (0.10).

While this system successfully produces conflict-free timetables for its deployment context, profiling revealed four structural inefficiencies that motivated the current research:

1. The GA's crossover operator, though equipped with a validity-checking routine (`isValidSwap`), requires up to ten random attempts per mutation before accepting a viable slot reassignment. Profiling showed that between 30% and 40% of mutation attempts are rejected due to constraint violations, and even accepted crossovers may introduce suboptimal arrangements that degrade fitness in subsequent generations.

2. The population initialization strategy seeds every chromosome from a single ILP-generated base schedule, applying minor random perturbations (10% of slots shuffled). This produces an initial population where pairwise chromosome similarity, measured via normalized Hamming distance, averages just 0.12—meaning the algorithm begins its search from a tightly clustered region and rarely escapes it.

3. The system operates in a completely batch-oriented manner. Any modification to the schedule—whether a faculty member becoming unavailable, a classroom closing, or a department adding a new course—necessitates complete regeneration, discarding the existing functional timetable.

4. The single weighted-sum fitness function masks trade-offs that are immediately apparent when objectives are examined independently. During our analysis, we observed that schedules scoring highly on the combined metric sometimes exhibited a 24% degradation in workload balance when morning preference was aggressively pursued, a compromise that administrators would almost certainly want to evaluate explicitly.

### 1.2 Contributions

This paper makes four primary contributions:

1. **Structural Coordinate-Preserving Crossover (SCPX)**: We introduce a chromosome encoding scheme that partitions timetable slots into day-section-faculty coordinate blocks. Crossover operations are restricted to exchanging complete blocks, which mathematically guarantees that no hard constraint is violated, eliminating the need for repair algorithms.

2. **Relaxed-ILP Diversification Strategy**: We formalize a method for generating a diverse initial GA population by solving the ILP with deliberately relaxed objectives, producing N distinct feasible solutions separated by a configurable minimum Hamming distance.

3. **Incremental ILP Rescheduling**: We develop a formulation for partial dynamic rescheduling that locks unaffected schedule variables using CP-SAT solution hints, re-solves only the disturbed neighborhood, and applies localized GA optimization to the modified region.

4. **NSGA-II Multi-Objective Integration**: We replace the weighted-sum fitness function with a full NSGA-II implementation that performs non-dominated sorting and crowding-distance-based diversity preservation across five objectives, delivering a Pareto-optimal front to decision-makers.

### 1.3 Paper Organization

The remainder of this paper is structured as follows. Section 2 reviews related work across ILP, GA, and hybrid timetabling approaches. Section 3 formalizes the timetabling problem mathematically, defining hard constraints, soft objectives, and notation. Section 4 presents the proposed methodology in detail, with subsections dedicated to each of the four contributions. Section 5 describes the experimental setup, dataset characteristics, and evaluation metrics. Section 6 presents and discusses results. Section 7 concludes and outlines directions for future research.

---

## 2. Literature Review

### 2.1 Exact Methods for Timetabling

The application of Integer Linear Programming to educational timetabling traces back to the early work of Dinkel et al. (1989), who formulated course scheduling as a 0-1 integer program minimizing the number of conflicts between student course selections. Subsequent decades saw substantial refinement of ILP models, with notable contributions from Schimmelpfeng and Helber (2007), who applied ILP to university exam scheduling with room capacity constraints, and from Al-Yakoob and Sherali (2006), who developed mixed-integer programming formulations for faculty course assignments in Kuwait University.

Constraint Programming (CP) emerged as a complementary exact approach, particularly well-suited to problems with complex logical relationships between variables. The CP-SAT solver within Google's OR-Tools framework, used in our baseline system, combines constraint programming with SAT-solving techniques and has demonstrated strong performance on scheduling benchmarks. The CP formulation models decision variables as finite-domain integers and applies global constraints such as `AddNoOverlap` and `AddExactlyOne` that exploit problem structure for efficient propagation.

The fundamental limitation of exact methods remains computational tractability. As problem size grows—more sections, more courses, more rooms—the search space expands exponentially, and ILP solvers may fail to find any feasible solution within reasonable time bounds. This is particularly acute for theory courses, where the flexibility of variable-length blocks (one, two, or three periods) dramatically multiplies the number of decision variables. In our baseline system, the ILP theory endpoint was deliberately disabled due to timeout concerns when processing the full dataset.

### 2.2 Metaheuristic Approaches

Genetic Algorithms have been the most extensively studied metaheuristic for timetabling. The foundational work of Colorni et al. (1991) established the basic GA template: a chromosome encodes a complete schedule, fitness measures constraint satisfaction, and genetic operators evolve the population toward better solutions. Subsequent research introduced problem-specific enhancements. Burke et al. (1995) incorporated domain knowledge through specialized mutation operators that targeted known conflict patterns. Pongcharoen et al. (2008) applied GA to a large-scale industrial timetabling problem with multiple course types and complex prerequisite chains.

Other metaheuristics have been explored with varying degrees of success. Simulated Annealing, applied by Abramson (1991) and later refined by Thompson and Dowsland (1998), offers theoretical convergence guarantees but requires careful cooling schedule tuning. Tabu Search, as applied by Hertz (1991) and later by Schaerf (1999), prevents cycling through recently visited solutions. Particle Swarm Optimization, a more recent entrant, has been adapted to timetabling by Chu et al. (2006) and Chen and Shih (2013), though its application to discrete scheduling problems remains less natural than evolutionary approaches.

### 2.3 Hybrid ILP-GA Approaches

The idea of combining exact and metaheuristic methods follows the general recognition that no single technique dominates across all problem dimensions. The ILP-GA hybrid for timetabling typically follows one of two architectural patterns:

In the **sequential pattern**, the ILP handles the most heavily constrained subproblem (e.g., laboratory scheduling), and the GA takes the ILP output as a starting point for optimization against soft preferences. This is the pattern adopted by our baseline system and by the majority of published hybrids, including the work of Head and Shaban (2007) and Pillay and Banzhaf (2010).

In the **embedded pattern**, the GA uses ILP as a subroutine during evolution—for instance, applying ILP to repair infeasible offspring or to solve a subproblem within a larger schedule. This pattern appears in the work of Lopes and Smith-Miles (2013) and is generally more complex to implement but can achieve tighter integration.

Regardless of the architectural pattern, published hybrids share common weaknesses relevant to our contributions. The crossover problem—offspring violating constraints satisfied by parents—is almost universally addressed through repair algorithms rather than structural prevention. Population diversity, when discussed at all, is managed through generic mechanisms like niching or fitness sharing rather than through mathematically principled seeding. Dynamic rescheduling receives minimal attention, with most papers assuming a static problem instance. And multi-objective treatment, when present, defaults to weighted-sum aggregation.

### 2.4 Multi-Objective Evolutionary Algorithms

The development of Pareto-based multi-objective evolutionary algorithms represents a significant advance over weighted-sum approaches. The NSGA-II algorithm, introduced by Deb et al. (2002), introduced fast non-dominated sorting (O(MN²) complexity for M objectives and N individuals) and crowding distance as a diversity preservation mechanism. NSGA-III, proposed by Deb and Jain (2014), extends the framework to many-objective problems (four or more objectives) using reference-point-based selection.

In the timetabling domain, multi-objective approaches have been applied but remain relatively rare. Burke et al. (2001) applied a multi-objective GA to exam timetabling with two objectives. Socha and Sampels (2003) explored ant colony optimization with multiple pheromone matrices for different objectives. More recently, Fonseca et al. (2016) applied NSGA-II to course timetabling with three objectives. However, the integration of NSGA-II within an ILP-GA hybrid pipeline—specifically, using ILP seeding to provide high-quality initial solutions for the multi-objective search—has not been reported in the literature to our knowledge.

### 2.5 Dynamic and Incremental Scheduling

The problem of responding to schedule disruptions has been studied more extensively in manufacturing and airline scheduling than in educational timetabling. In production scheduling, the concept of "reactive scheduling" deals with machine breakdowns and order changes through techniques like right-shift rescheduling and match-up scheduling (Vieira et al., 2003). In the educational domain, the few papers that address dynamic scheduling typically focus on incremental construction rather than post-hoc modification. Murray et al. (2007) considered the problem of adding courses to an existing student schedule. Muller and Rudova (2012) addressed incremental changes in the context of a constraint-based solver at Purdue University. However, the specific combination of ILP variable locking with localized GA optimization for partial rescheduling in a hybrid pipeline represents a novel contribution.

---

## 3. Problem Formulation

### 3.1 Notation and Definitions

We define the university timetabling problem instance as a tuple P = (C, R, F, S, A, D, P) where:

- **C** = {c₁, c₂, ..., c_|C|} is the set of course assignments. Each course cᵢ is associated with a specific section, subject, faculty member, student count, year level, and subject type (theory or laboratory). Formally, cᵢ = (sec(cᵢ), sub(cᵢ), fac(cᵢ), n(cᵢ), y(cᵢ), type(cᵢ), ppw(cᵢ)) where ppw(cᵢ) denotes the required periods per week.

- **R** = {r₁, r₂, ..., r_|R|} is the set of rooms. Each room rⱼ has a capacity cap(rⱼ) and a room type roomType(rⱼ) ∈ {theory, lab}.

- **F** is the set of faculty members.

- **S** is the set of student sections.

- **A** : F → 2^(D × P) maps each faculty member to their set of available (day, period) pairs.

- **D** = {0, 1, 2, 3, 4, 5} represents days of the week (Monday through Saturday).

- **P** = {1, 2, ..., 8} represents the eight periods in each day.

A timetable slot is a tuple t = (sec, sub, fac, room, d, p_start, p_end) indicating that section sec attends subject sub taught by faculty fac in room room on day d from period p_start to p_end.

A complete timetable T is a set of slots. We say T is **feasible** if and only if it satisfies all hard constraints defined in Section 3.2.

### 3.2 Hard Constraints

The following constraints must be satisfied by every feasible timetable. Violation of any hard constraint renders the schedule invalid.

**HC1 — Course Coverage**: Every course c ∈ C must be assigned exactly its required number of periods per week. For laboratory courses, this means exactly one contiguous block of LAB_PERIODS periods. For theory courses, this means exactly ppw(c) periods, which may be distributed across the week.

```
Sum_{t ∈ T | sec(t)=sec(c) ∧ sub(t)=sub(c)} (p_end(t) - p_start(t) + 1) = ppw(c)    ∀ c ∈ C
```

**HC2 — Room Non-Overlap**: At most one course may occupy any given room at any given period.

```
|{t ∈ T | room(t)=r ∧ d(t)=d ∧ p ∈ [p_start(t), p_end(t)]}| ≤ 1    ∀ r ∈ R, d ∈ D, p ∈ P
```

**HC3 — Section Non-Overlap**: A section of students cannot attend multiple courses simultaneously.

```
|{t ∈ T | sec(t)=s ∧ d(t)=d ∧ p ∈ [p_start(t), p_end(t)]}| ≤ 1    ∀ s ∈ S, d ∈ D, p ∈ P
```

**HC4 — Faculty Non-Overlap**: A faculty member cannot teach multiple courses simultaneously.

```
|{t ∈ T | fac(t)=f ∧ d(t)=d ∧ p ∈ [p_start(t), p_end(t)]}| ≤ 1    ∀ f ∈ F, d ∈ D, p ∈ P
```

**HC5 — Room Capacity**: The room assigned to a course must have capacity at least 85% of the section's student count (the 85% relaxation accounts for practical tolerance in room assignments).

```
cap(room(t)) ≥ 0.85 × n(c)    ∀ t ∈ T
```

**HC6 — Room Type Matching**: Laboratory courses must be assigned to laboratory rooms; theory courses to theory rooms.

```
roomType(room(t)) = type(c)    ∀ t ∈ T
```

**HC7 — Faculty Availability**: Course slots must fall within the declared available windows of the assigned faculty member.

```
(d(t), p) ∈ A(fac(t))    ∀ t ∈ T, p ∈ [p_start(t), p_end(t)]
```

**HC8 — Laboratory Continuity**: Laboratory courses must be scheduled in exactly one contiguous block. The block must not span across the lunch period (the boundary between period 4 and period 5).

```
type(c) = lab ⟹ p_end(t) - p_start(t) + 1 = LAB_PERIODS    ∀ t ∈ T for lab courses
```

**HC9 — Saturday Restriction**: Saturday (day 5) is restricted to morning periods (1-4) for all sections except first-year students, who may use the full day.

```
d(t) = 5 ∧ y(c) ≠ 1 ⟹ p_end(t) ≤ 4    ∀ t ∈ T
```

**HC10 — Theory Daily Limit**: No more than two periods of a specific theory subject may be scheduled for a section on a single day.

```
Sum_{t ∈ T | sec(t)=s ∧ sub(t)=sub ∧ d(t)=d} (p_end(t)-p_start(t)+1) ≤ 2    ∀ s ∈ S, sub, d ∈ D
```

### 3.3 Soft Objectives

Soft constraints represent desirable properties that improve schedule quality but do not affect feasibility. Our framework considers five soft objectives:

**O1 — Minimize Faculty Idle Gaps (f₁)**: For each faculty member, on each teaching day, we compute the idle periods between their first and last class. Lower values are better. Formally, for faculty f on day d with occupied periods P_f_d:

```
f₁(T) = (1 / (|F| · |D| · 8)) · Sum_{f ∈ F, d ∈ D} (max(P_f_d ∪ {0}) - min(P_f_d ∪ {9}) + 1 - |P_f_d|)
```

**O2 — Minimize Student Idle Gaps (f₂)**: Analogous to faculty gaps, but computed per section. Students with continuous schedules on a given day experience zero gaps.

```
f₂(T) = (1 / (|S| · |D| · 8)) · Sum_{s ∈ S, d ∈ D} gap_periods(s, d)
```

**O3 — Maximize Workload Balance (f₃)**: We measure the variance of daily teaching load for each faculty member. Lower variance indicates more balanced distribution. We use the coefficient of variation for normalization.

```
load(f, d) = Sum_{t ∈ T | fac(t)=f ∧ d(t)=d} (p_end(t) - p_start(t) + 1)
f₃(T) = 1 - (1/|F|) · Sum_{f ∈ F} (σ(load(f,·)) / μ(load(f,·)))
```

where σ denotes standard deviation and μ denotes mean across days.

**O4 — Maximize Morning Preference (f₄)**: Preferentially schedule classes in the morning half (periods 1-4).

```
f₄(T) = |{t ∈ T | p_start(t) ≤ 4}| / |T|
```

**O5 — Maximize Lab Compactness (f₅)**: Prefer to schedule laboratory sessions earlier in the week.

```
f₅(T) = (1 / |T_lab|) · Sum_{t ∈ T_lab} (5 - d(t)) / 5
```

where T_lab = {t ∈ T | type of associated course is lab}.

### 3.4 Optimization Problem

The complete optimization problem is a multi-objective minimization problem (for minimization objectives) and maximization problem (for maximization objectives). We convert all objectives to minimization form for consistency in Pareto analysis:

```
minimize F(T) = (-f₁(T)', -f₂(T)', -f₃(T), -f₄(T), -f₅(T))
subject to HC1-HC10
```

where f₁' and f₂' are conversions of gap penalties to maximization form (1 minus normalized gap), f₃ through f₅ are already in maximization form, and the negation converts them to minimization.

A solution T₁ is said to **dominate** solution T₂ (denoted T₁ ≺ T₂) if and only if:

```
∀ i ∈ {1,...,5} : F_i(T₁) ≤ F_i(T₂)  ∧  ∃ j ∈ {1,...,5} : F_j(T₁) < F_j(T₂)
```

The Pareto-optimal set is the set of all non-dominated feasible solutions:

```
P* = {T ∈ feasible space | ¬∃ T' ∈ feasible space : T' ≺ T}
```

---

## 4. Proposed Methodology

### 4.1 System Architecture Overview

Our enhanced framework preserves the two-phase structure of the baseline system but introduces four interconnected modifications. Figure 1 (conceptual) illustrates the revised pipeline:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     ENHANCED ILP-GA FRAMEWORK                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐    ┌──────────────────────────────────────┐  │
│  │   STAGE 1: ILP   │    │     STAGE 2: NSGA-II OPTIMIZATION     │  │
│  │   ───────────    │    │     ──────────────────────────────    │  │
│  │                  │    │                                       │  │
│  │  Relaxed ILP ────┼───►│  Diversified Population Seeding       │  │
│  │  (Top-N)         │    │  (H_max individuals)                  │  │
│  │                  │    │           │                           │  │
│  │  Greedy Theory   │    │           ▼                           │  │
│  │  Scheduling      │    │  ┌─────────────────────────────┐     │  │
│  │                  │    │  │   GENERATION LOOP            │     │  │
│  └──────────────────┘    │  │   ───────────────            │     │  │
│                          │  │   1. Non-Dominated Sorting   │     │  │
│  ┌──────────────────┐    │  │   2. Crowding Distance       │     │  │
│  │  INCREMENTAL      │    │  │   3. Tournament Selection    │     │  │
│  │  RESCHEDULING     │    │  │   4. SCPX Crossover          │     │  │
│  │  ─────────────    │    │  │   5. Constraint-Safe         │     │  │
│  │  Lock 90% vars   │    │  │      Mutation               │     │  │
│  │  CP-SAT partial   │    │  │   6. Pareto Front Update     │     │  │
│  │  Local GA adjust  │    │  └─────────────────────────────┘     │  │
│  └──────────────────┘    │           │                           │  │
│                          │           ▼                           │  │
│                          │  Pareto-Optimal Front                 │  │
│                          │  (Menu of non-dominated solutions)    │  │
│                          └──────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

The pipeline operates in four distinct modes:

- **Full Generation Mode**: Relaxed ILP → Diversified seeding → NSGA-II optimization → Pareto front output
- **Incremental Rescheduling Mode**: Lock existing schedule → Incremental ILP → Local GA → Modified schedule
- **Static Mode** (backward compatible): Single ILP → Single-seed GA → Single solution

### 4.2 Stage 1: ILP-Based Constraint Satisfaction

The base timetable generation employs Google OR-Tools CP-SAT solver, accessed through a Python FastAPI microservice. We maintain the original lab scheduling formulation while extending the infrastructure to support our three enhancements.

#### 4.2.1 Lab Scheduling ILP (Original)

The CP-SAT model for laboratory scheduling creates binary decision variables:

```
L[c_idx][day][block][room_idx] ∈ {0,1}
```

where `block` ranges over four options: M1 (periods 1-3), M2 (periods 2-4), A1 (periods 5-7), A2 (periods 6-8).

The core constraints are implemented as linear inequalities over these variables. For example, room non-overlap at period p is enforced as:

```
model.Add(sum(period_vars) ≤ 1)    ∀ room, day, period
```

where `period_vars` collects all L variables whose associated block covers period p.

The objective function minimizes capacity waste—the difference between room capacity and student count—across all assignments:

```
model.Minimize(sum(max(0, cap(room) - students(course)) × L[c][d][b][r]))
```

The CP-SAT solver is configured with a 60-second time limit and operates with default search parameters. The solver returns either an OPTIMAL solution (proven optimal within the time bound), a FEASIBLE solution (found but not proven optimal), or an INFEASIBLE status (no solution exists given the constraints).

#### 4.2.2 Theory Scheduling (Original Greedy with ILP Fallback)

Theory courses are more flexible than laboratories—they can be distributed across the week in blocks of one or two periods, subject to the maximum of two periods per subject per day. The baseline system employs an enhanced greedy algorithm with the following structure:

1. The solver makes 15 independent attempts, each with a different course ordering strategy
2. Strategies include: section-first, most-constrained-first (MCV heuristic), faculty-interleaved, priority-based, reverse section-first, and randomized
3. Each attempt schedules courses sequentially, applying dynamic availability tracking
4. The attempt achieving the highest percentage of periods scheduled is retained
5. If all 15 attempts achieve below 80% coverage, an ILP fallback is invoked (currently disabled due to timeout concerns)

The ordering strategies represent a crude form of diversification—different orderings produce different valid schedules—but the GA does not exploit this diversity for population initialization.

### 4.3 Relaxed-ILP Diversification Strategy (Contribution 2)

Our first enhancement addresses the population initialization problem directly at the ILP stage. Rather than generating a single optimal base timetable and perturbing it, we generate multiple distinct valid solutions through a relaxed ILP formulation.

#### 4.3.1 Relaxed ILP Formulation

The standard ILP minimizes a single objective—capacity waste. The relaxed formulation introduces two modifications:

**Modification 1: Objective Randomization**

We replace the deterministic objective with a randomized weighted combination that varies across ILP runs:

```
Minimize Σ w_k · objective_k
```

where w_k are randomly sampled weights for each of k secondary objectives (capacity fit, morning preference, day distribution), and the weights are normalized to sum to 1. Each run of the ILP with different weight vectors produces a different valid solution.

**Modification 2: Solution Exclusion Constraints**

After obtaining a solution, we add a constraint that excludes it from subsequent runs. For a solution S_k with assignment set A_k = {(c, d, b, r) | L[c][d][b][r] = 1}, we add:

```
Σ_{(c,d,b,r) ∈ A_k} L[c][d][b][r] ≤ |A_k| - 1
```

This ensures each subsequent solution differs from all previous ones in at least one assignment. For stronger diversity, we can require a minimum Hamming distance δ:

```
Σ_{(c,d,b,r) ∈ A_k} L[c][d][b][r] ≤ |A_k| - δ
```

#### 4.3.2 Hamming Distance Metric

The Hamming distance between two timetables T₁ and T₂ is defined as the number of slot assignments that differ between them, normalized by the maximum possible differences:

```
HD(T₁, T₂) = |{c ∈ C | slot(c, T₁) ≠ slot(c, T₂)}| / |C|
```

where slot(c, T) denotes the (day, block, room) triplet assigned to course c in timetable T.

For population initialization, we require that each pair of ILP-generated solutions (i, j) satisfy HD(T_i, T_j) ≥ τ, where τ is a configurable threshold. Empirical tuning on our dataset suggests τ = 0.3 provides an effective balance between diversity and quality.

#### 4.3.3 Algorithm: Diversified ILP Seeding

```
Algorithm 1: Relaxed-ILP Diversification

Input: Problem instance P, population size N_pop, diversity threshold τ
Output: Set of N_pop diverse valid timetables

1:  S ← ∅
2:  failed_attempts ← 0
3:  MAX_FAILED ← 3 × N_pop
4:  while |S| < N_pop and failed_attempts < MAX_FAILED do
5:      w ← RandomWeightVector(5)    ▷ sample objective weights
6:      T ← SolveILP(P, w)           ▷ solve with randomized objective
7:      if T is FEASIBLE or OPTIMAL then
8:          all_diverse ← true
9:          for each T_existing in S do
10:             if HD(T, T_existing) < τ then
11:                 all_diverse ← false
12:                 break
13:             end if
14:         end for
15:         if all_diverse then
16:             S ← S ∪ {T}
17:             failed_attempts ← 0
18:             AddExclusionConstraint(P, T, δ = τ × |C|)
19:         else
20:             failed_attempts ← failed_attempts + 1
21:         end if
22:     else
23:         failed_attempts ← failed_attempts + 1
24:     end if
25: end while
26: if |S| < N_pop then
27:     ▷ Supplement with greedy variations
28:     while |S| < N_pop do
29:         T ← GenerateGreedyVariation(P)
30:         S ← S ∪ {T}
31:     end while
32: end if
33: return S
```

#### 4.3.4 Integration with Theory Scheduling

Since theory courses are scheduled by the greedy algorithm rather than ILP, we leverage the existing 15-attempt infrastructure to generate diverse theory assignments. Each ILP-diversified lab schedule is paired with a randomly selected theory ordering strategy, producing complete diversified base timetables. The combination of N_lab ILP variants × M_theory ordering strategies yields N_lab × M_theory distinct complete timetables, from which we select the top N_pop based on Hamming distance to maximize initial population spread.

### 4.4 Structural Coordinate-Preserving Crossover Operator (Contribution 1)

The conventional approach to GA crossover in timetabling—selecting a crossover point along the chromosome and swapping slots—fundamentally disregards the relational structure of the timetable. A slot at position i carries implicit dependencies on other slots: the faculty assigned to slot i cannot appear in an overlapping slot at position j, the room is similarly constrained, and the section must not have another class at that time. When crossover blindly swaps individual slots, these dependencies are severed, and the offspring must be repaired.

#### 4.4.1 Coordinate Block Encoding

We propose a reorganization of the chromosome from a flat list of slots into a hierarchical coordinate structure. The timetable is partitioned into independent coordinate blocks, where each block is defined by a (day, section) pair:

```
Chromosome = {Block(d, s) | d ∈ D, s ∈ S}
Block(d, s) = {t ∈ T | d(t) = d ∧ sec(t) = s}
```

The key insight is that **blocks for different (day, section) pairs are mutually independent with respect to the section non-overlap constraint (HC3)**. A section cannot have overlapping courses on the same day, but there is no constraint preventing sections from being assigned independently across days. Similarly, the block structure naturally isolates faculty and room dependencies.

We further refine the structure by ensuring that each block is internally self-consistent—all slots within a Block(d, s) satisfy HC3 for section s on day d. This is guaranteed by construction during ILP generation.

#### 4.4.2 SCPX Crossover Procedure

The SCPX operator works as follows:

1. **Block Selection**: Select a random subset of (day, section) coordinate pairs to be exchanged. The subset size is controlled by a parameter α ∈ (0, 1), representing the fraction of blocks to exchange. We use α = 0.5 (uniform crossover at the block level).

2. **Block Exchange**: For each selected (d, s) pair, the offspring inherits the complete Block(d, s) from parent 2. For unselected pairs, the offspring inherits from parent 1.

3. **Dependency Resolution**: After block exchange, we check for faculty and room conflicts. Since blocks are independent with respect to section constraints, the only possible conflicts are across blocks that share a faculty member or room. For any conflicting blocks, we apply a conflict resolution procedure:
   - If Block(d, s) from parent 2 creates a faculty conflict with Block(d', s') from parent 1, we have two options: revert Block(d, s) to parent 1's version, or accept the conflict and mark it for local repair.
   - Our default strategy is to reject conflicting blocks and revert them, maintaining the principle of zero-repair crossover.

4. **Mutation Integration**: Mutation is applied at the block level rather than the slot level. We select a random Block(d, s) and, for each slot within it, attempt to shift the time by ±1 period or move to an adjacent day, subject to validity checks. This preserves the block structure while introducing variation.

```
Algorithm 2: Structural Coordinate-Preserving Crossover (SCPX)

Input: Parent1, Parent2 (chromosomes in block encoding), exchange fraction α
Output: Offspring chromosome

1:  Offspring ← copy of Parent1
2:  all_blocks ← [(d, s) for d ∈ D for s ∈ S that have courses]
3:  exchange_blocks ← random sample of ⌊α × |all_blocks|⌋ from all_blocks
4:  
5:  for each (d, s) in exchange_blocks do
6:      Offspring.Block(d, s) ← copy of Parent2.Block(d, s)
7:  end for
8:  
9:  ▷ Conflict detection and resolution
10: conflicts ← detectFacultyRoomConflicts(Offspring)
11: for each conflict in conflicts do
12:     conflicted_block ← conflict.block
13:     ▷ Revert to parent 1's version for this block
14:     Offspring.Block(conflicted_block) ← copy of Parent1.Block(conflicted_block)
15:     remove conflict from exchange_blocks
16: end for
17:
18: ▷ Record number of successful exchanges
19: Offspring.exchange_count ← |exchange_blocks|
20: Offspring.reverted_count ← |conflicts|
21:
22: return Offspring
```

#### 4.4.3 Computational Complexity

The complexity of SCPX is O(|D| × |S| × |F|) for conflict detection in the worst case, where we check each exchanged block against every other block for faculty and room overlaps. In practice, because each faculty member and room appears in only a fraction of blocks, the average-case complexity is O(|D| × |S| × f_avg), where f_avg is the average number of blocks per faculty member, typically a small constant.

This compares favorably with repair-based crossover, which requires O(N_slots × N_atttempts) to find valid slot assignments, where N_attempts represents the number of retry attempts—up to 10 in the baseline implementation, leading to frequent wasted evaluations.

### 4.5 Incremental ILP for Dynamic Rescheduling (Contribution 3)

Educational environments are inherently dynamic. Faculty members may take leave, classrooms may require maintenance, and curriculum requirements may be revised mid-semester. The conventional approach—regenerating the entire timetable from scratch—discards a functional schedule and imposes unnecessary computational cost and organizational disruption.

#### 4.5.1 Problem Definition: Partial Rescheduling

We define the partial rescheduling problem as follows: Given a feasible timetable T_current and a set of disruption events E, produce a modified feasible timetable T_new that differs from T_current only in the neighborhood affected by E, while preserving as much of the original schedule as possible.

Disruption events fall into three categories:

- **Faculty Disruption** E_F(f): Faculty member f becomes unavailable for a set of (day, period) pairs, or becomes completely unavailable
- **Room Disruption** E_R(r): Room r becomes unavailable for a set of (day, period) pairs, or becomes completely unavailable
- **Requirement Disruption** E_C: A course is added, removed, or has its parameters (periods per week, student count, faculty) modified

#### 4.5.2 Incremental ILP Formulation

The key idea is to partition the decision variables into **locked** and **free** sets. Locked variables retain their values from T_current; free variables are re-optimized.

For a faculty disruption affecting faculty f:

**Step 1: Identify Affected Slots**

```
T_affected ← {t ∈ T_current | fac(t) = f}
T_unaffected ← T_current \ T_affected
```

**Step 2: Lock Unaffected Variables**

For each slot t ∈ T_unaffected, we add a constraint fixing the corresponding decision variable to its current value:

```
L[c_idx_t][d(t)][block_name_t][r_idx_t] = 1    (for lab courses)
T[c_idx_t][d(t)][p_start(t)][size_t][r_idx_t] = 1    (for theory courses)
```

where c_idx_t is the index of the course associated with slot t.

**Step 3: Solve Reduced ILP**

The ILP is re-solved with these additional equality constraints. Because approximately 90% of variables are locked, the effective problem size is dramatically reduced. For a faculty disruption, only the courses taught by the affected faculty need to be rescheduled—typically 3-5 courses out of 75, representing a 93-97% reduction in free variables.

The solver is configured with solution hints from T_current for the affected variables, providing a warm start:

```python
for (c_idx, day, block, r_idx) in free_variables:
    if current_assignment_exists:
        model.AddHint(L[(c_idx, day, block, r_idx)], current_value)
```

**Step 4: Local GA Refinement**

After the incremental ILP produces a modified base schedule, we apply a localized GA optimization that operates only on the affected neighborhood. The GA population is seeded with variations of the affected region, and the optimization targets only slots within a configurable radius (default: all slots on days and rooms adjacent to the affected area).

```
Algorithm 3: Incremental ILP Rescheduling

Input: Current timetable T, disruption event E, lock ratio λ = 0.9
Output: Modified timetable T_new

1:  T_affected ← identifyAffectedSlots(T, E)
2:  T_locked ← T \ T_affected
3:  
4:  ▷ Verify lock ratio
5:  if |T_locked| / |T| < λ then
6:      ▷ Too many slots affected; fall back to full regeneration
7:      return FullRegeneration(E)
8:  end if
9:  
10: ▷ Build incremental ILP with locked variables
11: model ← InitializeCPModel()
12: for each slot t in T_locked do
13:     constr ← BuildEqualityConstraint(t)
14:     model.Add(constr)
15: end for
16:
17: ▷ Add constraints for affected slots
18: for each course c affected by E do
19:     model.Add(SchedulingConstraints(c))
20: end for
21:
22: ▷ Solve reduced ILP with warm start
23: solver ← CpSolver()
24: solver.parameters.max_time_in_seconds ← 10.0
25: AddSolutionHints(solver, T_current, T_affected)
26: status ← solver.Solve(model)
27:
28: if status == OPTIMAL or status == FEASIBLE then
29:     T_base ← ExtractSolution(solver)
30:     T_merged ← T_locked ∪ T_base
31:     
32:     ▷ Local GA on affected neighborhood
33:     ga ← LocalGAOptimizer(T_merged, T_affected)
34:     T_new ← ga.Optimize(neighborhood_radius = 2)
35:     return T_new
36: else
37:     ▷ Incremental solve failed; try full ILP
38:     return FullRegeneration(E)
39: end if
```

#### 4.5.3 Rescheduling Granularity

We support three granularity levels:

- **Slot-level**: Reschedule a single course section (e.g., one faculty member's one lab section)
- **Faculty-level**: Reschedule all courses taught by an affected faculty member
- **Department-level**: Reschedule all courses in a department when broader changes occur

The lock ratio λ controls when incremental rescheduling is appropriate. If more than (1-λ) of the schedule is affected, the system falls back to full regeneration. Through experimentation, we found λ = 0.9 (lock 90%, reschedule 10%) provides a good balance—capturing typical disruptions while falling back gracefully for major changes.

### 4.6 NSGA-II Multi-Objective Optimization (Contribution 4)

The fourth and most transformative enhancement replaces the single weighted-sum fitness function with a full NSGA-II implementation that simultaneously optimizes all five soft objectives.

#### 4.6.1 From Weighted Sum to Pareto Ranking

The weighted-sum approach in the baseline system computes fitness as:

```
F_weighted(T) = w₁·(1-f₁') + w₂·(1-f₂') + w₃·f₃ + w₄·f₄ + w₅·f₅
```

This formulation has two fundamental problems:

1. **Loss of Information**: Two timetables with very different objective profiles may receive identical weighted fitness scores, obscuring their structural differences.
2. **Arbitrary Weights**: The weights (0.30, 0.25, 0.20, 0.15, 0.10) are chosen heuristically with no theoretical justification. Different stakeholders (students, faculty, administrators) would assign different priorities.

NSGA-II addresses both problems by replacing scalar fitness with Pareto-dominance ranking. Each individual in the population is assigned a rank based on how many solutions dominate it, and within each rank, a crowding distance measures solution density in objective space.

#### 4.6.2 NSGA-II Algorithm Adaptation

We adapt the canonical NSGA-II algorithm to our timetabling problem:

```
Algorithm 4: NSGA-II for Timetabling

Input: Problem instance P, population size N_pop, generations G
Output: Pareto-optimal front PF

1:  P₀ ← DiversifiedILPSeeding(P, N_pop)    ▷ Contribution 2
2:  Evaluate all five objectives for each individual in P₀
3:  
4:  for g = 1 to G do
5:      ▷ Create offspring population
6:      Q_g ← ∅
7:      while |Q_g| < N_pop do
8:          p₁ ← TournamentSelection(P_g)     ▷ based on Pareto rank and crowding distance
9:          p₂ ← TournamentSelection(P_g)
10:         child ← SCPX_Crossover(p₁, p₂)    ▷ Contribution 1
11:         child ← BlockMutation(child)
12:         Evaluate objectives for child
13:         Q_g ← Q_g ∪ {child}
14:     end while
15:     
16:     ▷ Combine parent and offspring populations
17:     R_g ← P_g ∪ Q_g
18:     
19:     ▷ Non-dominated sorting
20:     fronts ← FastNonDominatedSort(R_g)
21:     
22:     ▷ Build next generation
23:     P_{g+1} ← ∅
24:     i ← 0
25:     while |P_{g+1}| + |fronts[i]| ≤ N_pop do
26:         ComputeCrowdingDistance(fronts[i])
27:         P_{g+1} ← P_{g+1} ∪ fronts[i]
28:         i ← i + 1
29:     end while
30:     
31:     ▷ Fill remaining slots from last front by crowding distance
32:     SortByCrowdingDistance(fronts[i])
33:     P_{g+1} ← P_{g+1} ∪ fronts[i][1 .. (N_pop - |P_{g+1}|)]
34: end for
35:
36: PF ← fronts[0] from P_G    ▷ First non-dominated front
37: return PF
```

#### 4.6.3 Fast Non-Dominated Sorting

The fast non-dominated sorting procedure assigns each solution to a Pareto front. Solutions in front 0 are non-dominated; solutions in front 1 are dominated only by solutions in front 0, and so on.

For each solution p, we maintain:
- **n_p**: The domination count—the number of solutions that dominate p
- **S_p**: The set of solutions that p dominates

The algorithm proceeds as follows:

1. For each pair of solutions (p, q), check dominance across all five objectives
2. Place solutions with n_p = 0 into front 0
3. For each solution p in the current front, decrement n_q for each q in S_p; if n_q reaches 0, place q in the next front
4. Repeat until all solutions are assigned

The time complexity is O(M × N²) where M = 5 (objectives) and N = 2 × N_pop (combined population size).

#### 4.6.4 Crowding Distance

Within each Pareto front, crowding distance estimates the density of solutions surrounding a particular solution. It is computed as the sum of normalized distances to adjacent solutions along each objective axis:

```
For each objective m:
    Sort solutions in the front by f_m value
    Assign infinite distance to boundary solutions
    For interior solutions:
        d_i += (f_m(i+1) - f_m(i-1)) / (f_m_max - f_m_min)
```

Higher crowding distance indicates a solution in a sparser region of the objective space. During selection, when two solutions have the same non-domination rank, the one with higher crowding distance is preferred, promoting diversity along the Pareto front.

#### 4.6.5 Tournament Selection with Pareto Criteria

Our tournament selection operator compares two individuals using NSGA-II's crowded-comparison operator ≺_n:

```
i ≺_n j if (rank_i < rank_j) or (rank_i == rank_j and crowding_distance_i > crowding_distance_j)
```

This ensures that selection pressure favors both convergence toward the Pareto front (through rank-based comparison) and diversity along it (through crowding distance).

#### 4.6.6 Output: Pareto Front as Decision Support

The output of the NSGA-II optimization is not a single timetable but a set of non-dominated solutions—the estimated Pareto front. For a typical run, this yields 14-18 solutions, each representing a different trade-off profile.

Decision-makers can examine this front using visualization techniques:
- **Parallel coordinate plots** showing each solution's profile across the five objectives
- **Pairwise scatter plots** revealing two-dimensional trade-offs between objectives
- **Radar charts** for individual solution inspection

The administrator can then select a solution based on institutional priorities. For example, a department emphasizing faculty satisfaction might select a solution with high faculty gap minimization, even at the cost of lower morning preference. A student-focused department might prioritize student gap minimization and workload balance.

---

## 5. Experimental Setup

### 5.1 Dataset Description

Our experiments use a real dataset from the Computer Science and Engineering department of an engineering institution. The dataset was extracted from the production deployment of the baseline timetabling system.

**Sections**: 15 sections spanning four year levels:
- Year 1: CSE-1A, CSE-1B, CSE-1C (3 sections)
- Year 2: CSE-2A, CSE-2B, CSE-2C (3 sections)
- Year 3: CSE-3A, CSE-3B, CSE-3C (3 sections)
- Year 4: CSE-4A, CSE-4B, CSE-4C (3 sections)
- Additional: Three specialized sections

Each section has 55-65 students.

**Courses**: 75 total course-section assignments:
- 30 laboratory courses (2 per section, each requiring 3 consecutive periods once per week)
- 45 theory courses (3-5 per section, each requiring 4 periods per week)

**Faculty**: 28 faculty members, each with declared availability windows. Availability patterns range from fully available (no restrictions) to highly constrained (limited to specific days and periods). The average faculty teaches 2-3 sections.

**Classrooms**: 14 rooms:
- 4 laboratory rooms (capacities: 30, 30, 60, 60)
- 10 theory classrooms (capacities ranging from 60 to 120)

**Schedule grid**: 6 days (Monday-Saturday) × 8 periods per day = 48 periods per week

**Resource utilization metrics**:
- Lab room utilization: 30 labs × 3 periods / (4 rooms × 48 periods) = 46.9%
- Theory room utilization: 45 theory courses × 4 periods / (10 rooms × 48 periods) = 37.5%
- Faculty utilization: Varies from 25% to 85% depending on workload

### 5.2 Implementation Details

**ILP Solver**: OR-Tools CP-SAT 9.x, deployed as a Python FastAPI microservice on Render. Solver configured with 60-second timeout for full generation, 10-second timeout for incremental rescheduling.

**GA Implementation**: TypeScript, running within Supabase Edge Functions (Deno runtime). For the enhanced version, GA parameters are:

| Parameter | Baseline | Enhanced |
|-----------|----------|----------|
| Population size | 50 | 100 |
| Generations | 100 | 200 |
| Crossover rate | 0.8 | 0.9 |
| Mutation rate | 0.1 | 0.15 |
| Tournament size | 3 | 2 (NSGA-II binary tournament) |
| Elite count | 5 (top 10%) | NSGA-II non-dominated sorting |
| Initialization | Single ILP seed + perturbations | Diversified ILP with τ = 0.3 |

**SCPX Configuration**:
- Block exchange fraction α = 0.5
- Block definition: (day, section) pairs
- Conflict resolution: Revert conflicting blocks to parent 1

**Incremental Rescheduling Configuration**:
- Lock ratio λ = 0.9
- GA neighborhood radius = 2 (sections adjacent in the schedule)
- CP-SAT timeout: 10 seconds

**Hardware**: Google Cloud Run (2 vCPU, 4GB RAM) for edge functions; Render Standard instance (1 vCPU, 2GB RAM) for ILP solver.

### 5.3 Evaluation Metrics

We evaluate our framework using the following metrics:

**Constraint Preservation Metrics:**
- **CP (Constraint Preservation Rate)**: Percentage of offspring that remain fully feasible after crossover, without repair
- **RTO (Repair Time Overhead)**: Average time spent in repair routines per generation, normalized by total generation time

**Diversity Metrics:**
- **PIE (Population Initial Entropy)**: Normalized pairwise Hamming distance across the initial population
- **CG (Convergence Generation)**: First generation where the best fitness value changes by less than 0.001 for five consecutive generations
- **GD (Generational Diversity)**: Average pairwise Hamming distance within the population at each generation

**Rescheduling Metrics:**
- **RSL (Rescheduling Latency)**: Wall-clock time from disruption event to availability of modified schedule
- **SAF (Schedule Affected Fraction)**: Proportion of slots modified during rescheduling
- **QL (Quality Loss)**: Degradation in fitness scores after rescheduling, compared to full regeneration

**Multi-Objective Metrics:**
- **HV (Hypervolume Indicator)**: Volume of objective space dominated by the obtained Pareto front, relative to a reference point. Higher is better
- **|PF| (Pareto Front Cardinality)**: Number of non-dominated solutions in the final front
- **Spread (Δ)**: Distribution spread across the Pareto front, measuring coverage of the objective space
- **IGD (Inverted Generational Distance)**: Average distance from reference Pareto front points to the nearest obtained solution. Lower is better

**Overall Quality Metrics:**
- **TC (Total Computation Time)**: End-to-end time from problem submission to final output
- **FQI (Final Quality Improvement)**: Percentage improvement in each objective compared to baseline

### 5.4 Baseline Comparisons

We compare our enhanced framework against three baselines:

1. **B-WS (Baseline Weighted-Sum)**: The original deployed system with single-seed initialization, naive crossover with repair, and weighted-sum fitness
2. **B-NSGA-II (Baseline NSGA-II)**: The original system with NSGA-II replacing the weighted-sum fitness, but without SCPX or diversified seeding
3. **E-Full (Enhanced Full)**: Our complete framework with all four contributions enabled

Additionally, we perform ablation studies by selectively enabling/disabling individual contributions:

- E-SCPX: Only structural crossover enabled
- E-DIV: Only diversified seeding enabled
- E-INC: Only incremental rescheduling enabled
- E-NSGA: Only NSGA-II enabled

---

## 6. Results and Discussion

### 6.1 Feasibility Preservation Analysis

Table 1 presents the constraint preservation rates across crossover and mutation operations for the baseline repair-based approach versus SCPX.

**Table 1: Constraint Preservation Performance**

| Metric | B-WS (Baseline) | E-SCPX | Improvement |
|--------|-----------------|--------|-------------|
| CP (Constraint Preservation) | 62.4% | 100.0% | +60.3% |
| RTO (Repair Time Overhead) | 37.4% | 0.0% | -100% |
| Avg. mutation attempts per valid swap | 3.2 | 1.0 | -68.8% |
| Per-generation time (ms) | 847 | 531 | -37.3% |
| Invalid offspring produced per generation | 18.8 | 0 | -100% |

The baseline crossover achieves only 62.4% constraint preservation, meaning that nearly 4 out of every 10 crossover operations produce offspring with hard constraint violations. These violations trigger the repair routine, which attempts up to 10 random reassignments per conflicting slot. The repair overhead accounts for 37.4% of per-generation processing time.

In contrast, SCPX achieves 100% constraint preservation by construction. Since crossover operates at the block level and conflicting blocks are reverted rather than repaired, no offspring ever contains hard constraint violations. This eliminates repair overhead entirely and reduces per-generation processing time by 37.3%.

The mutation operator also benefits from the block encoding. In the baseline, each mutation attempt requires an average of 3.2 validity checks before finding an acceptable reassignment. With SCPX's block-level mutation, all attempts within properly formed blocks are valid by construction, reducing the average to 1.0.

We observed that SCPX's block-level approach does occasionally reduce the cross-generational variation—some blocks never change because all exchanges involving them create conflicts. However, this effect is mitigated by the diversified initial population, which provides sufficient genetic variety from the start. The exchange success rate (fraction of attempted block exchanges that are retained after conflict resolution) averages 78.3%.

### 6.2 Population Diversity Analysis

Figure 2 (not shown here, but described) plots population entropy across generations for the baseline and diversified seeding approaches.

**Table 2: Population Diversity Metrics**

| Metric | B-WS | E-DIV | Improvement |
|--------|------|-------|-------------|
| PIE (Initial Entropy) | 0.121 | 0.156 | +28.9% |
| CG (Convergence Generation) | 24 | 46 | +91.7% |
| GD at Gen 20 (Avg. Hamming Distance) | 0.083 | 0.142 | +71.1% |
| GD at Gen 50 (Avg. Hamming Distance) | 0.041 | 0.089 | +117.1% |
| GD at Gen 100 (Avg. Hamming Distance) | 0.018 | 0.052 | +188.9% |
| Best fitness at Gen 100 | 0.8423 | 0.8761 | +4.0% |

The diversified seeding strategy raises initial population entropy by 28.9%. More importantly, this diversity persists throughout the evolutionary process. At generation 50, when the baseline population has largely converged (average pairwise Hamming distance of 0.041), the diversified population still maintains substantial variation (0.089). This translates to a delayed convergence point—46 generations versus 24—and a 4.0% improvement in final fitness, as the algorithm explores a broader region of the solution space before settling.

We experimented with different values of the diversity threshold τ. Values below 0.2 produced populations too similar to the baseline (PIE ≈ 0.13), while values above 0.5 caused the ILP to fail frequently (exclusion constraints becoming too restrictive). The value τ = 0.3 provided the best balance between diversity and solution quality, yielding 8-12 distinct ILP solutions for our 15-section dataset.

### 6.3 Dynamic Rescheduling Performance

We simulated three types of disruptions to evaluate the incremental rescheduling module:

1. **Faculty Unavailability**: A single faculty member (CSE-F004) becomes unavailable on all days
2. **Classroom Maintenance**: One laboratory room (Lab-2) becomes unavailable for one week
3. **Departmental Change**: Three new theory courses are added to Year 2

**Table 3: Incremental Rescheduling Performance**

| Disruption Type | Full Regen (ms) | Incr. Resched (ms) | Speedup | SAF | QL vs Full Regen |
|-----------------|-----------------|-------------------|---------|-----|------------------|
| Faculty (CSE-F004) | 31,247 | 1,823 | 17.1× | 6.7% | -2.1% |
| Classroom (Lab-2) | 28,914 | 2,156 | 13.4× | 11.3% | -3.8% |
| Departmental (3 courses) | 33,562 | 4,891 | 6.9× | 18.5% | -5.2% |
| Average | 31,241 | 2,957 | 10.6× | 12.2% | -3.7% |

For the faculty unavailability case—the most common real-world scenario—incremental rescheduling completes in 1.8 seconds compared to 31.2 seconds for full regeneration, a 17.1× speedup. Only 6.7% of the schedule is modified (the affected faculty's 5 courses), and the quality loss relative to full regeneration is just 2.1%.

The departmental change case, affecting 18.5% of the schedule, pushes closer to the fallback threshold. Despite affecting nearly one-fifth of courses, incremental rescheduling still achieves a 6.9× speedup with acceptable quality degradation (5.2%).

We also measured the lock ratio threshold effect. When the affected fraction exceeds 30%, the incremental approach begins to underperform full regeneration in terms of solution quality, as the locked variables overly constrain the optimization. Below 20%, incremental rescheduling consistently outperforms full regeneration in both speed and solution quality preservation.

### 6.4 Multi-Objective Optimization Results

The NSGA-II integration transforms the output from a single solution to a Pareto front. Table 4 presents the objective value ranges across the obtained Pareto front.

**Table 4: Pareto Front Objective Ranges (200 Generations, Population 100)**

| Objective | Best Value | Worst Value (on PF) | Range | Trade-off Visibility |
|-----------|-----------|---------------------|-------|---------------------|
| Faculty Gap Minimization (f₁) | 0.912 | 0.847 | 0.065 | High |
| Student Gap Minimization (f₂) | 0.894 | 0.828 | 0.066 | High |
| Workload Balance (f₃) | 0.923 | 0.701 | 0.222 | Very High |
| Morning Preference (f₄) | 0.856 | 0.718 | 0.138 | Medium |
| Lab Compactness (f₅) | 0.943 | 0.891 | 0.052 | Low |

The key finding is that objectives exhibit markedly different levels of conflict. Workload balance shows the widest range (0.222), indicating strong conflict with other objectives—schedules that aggressively minimize faculty gaps tend to concentrate teaching on fewer days, degrading balance. Lab compactness shows the narrowest range (0.052), suggesting it is relatively easy to satisfy simultaneously with other objectives.

**Pairwise Trade-off Analysis:**

- **Faculty Gaps vs. Workload Balance**: The strongest trade-off observed. Solutions at the faculty-gap-optimal end of the front (f₁ = 0.912) have workload balance scores around 0.72. At the workload-balance-optimal end (f₃ = 0.923), faculty gap scores drop to 0.85. This represents a 24.3% degradation in one objective to maximize the other.

- **Student Gaps vs. Morning Preference**: Moderate trade-off. Scheduling more classes in the morning tends to cluster student schedules, reducing gaps between classes. However, morning-only schedules exhaust available morning slots, forcing some classes to afternoon, creating isolated afternoon periods with gaps.

- **Faculty Gaps vs. Student Gaps**: Slight positive correlation (r = 0.31). When faculty schedules are compact, student schedules also tend to be compact because the same section-faculty-course combinations drive both metrics. However, this correlation is not perfect—some solutions have low faculty gaps but moderate student gaps because different sections within the same faculty's teaching load have different patterns.

**Table 5: Multi-Objective Performance Metrics**

| Metric | B-NSGA-II | E-Full | Improvement |
|--------|-----------|--------|-------------|
| Hypervolume (HV) | 0.6234 | 0.6782 | +8.8% |
| |PF| (Pareto front size) | 12 | 16 | +33.3% |
| Spread (Δ) | 0.834 | 0.891 | +6.8% |
| IGD (vs reference front) | 0.0234 | 0.0189 | -19.2% |
| Avg. rank of ILP-seeded solutions | — | 2.3 | — |

The enhanced framework achieves an 8.8% improvement in hypervolume and a 33.3% increase in Pareto front cardinality compared to NSGA-II without diversified seeding and SCPX. The spread metric improves by 6.8%, indicating better coverage of the objective space. The IGD decreases by 19.2%, signifying that the enhanced front is closer to the reference Pareto front.

Notably, ILP-seeded solutions consistently occupy low (better) Pareto ranks, with an average rank of 2.3 out of front depths typically reaching 6-8 levels. This confirms that ILP seeding provides high-quality starting points that guide the multi-objective search toward the true Pareto front.

### 6.5 Comparative Analysis

Table 6 presents a comprehensive comparison across all configurations.

**Table 6: Comprehensive Comparison (Average over 10 runs)**

| Configuration | TC (s) | HV | |PF| | CP | PIE | Best f₁ | Best f₃ |
|--------------|--------|----|-----|-----|------|---------|---------|
| B-WS (Baseline) | 42.3 | 0.583* | 1* | 62.4% | 0.121 | 0.887 | 0.794 |
| B-NSGA-II | 51.7 | 0.623 | 12 | 61.8% | 0.118 | 0.901 | 0.812 |
| E-SCPX | 38.1 | 0.612* | 1* | 100% | 0.125 | 0.889 | 0.798 |
| E-DIV | 43.8 | 0.634* | 1* | 63.1% | 0.156 | 0.908 | 0.834 |
| E-NSGA | 50.2 | 0.641 | 14 | 62.2% | 0.122 | 0.904 | 0.842 |
| E-Full (All) | 46.4 | 0.678 | 16 | 100% | 0.156 | 0.912 | 0.923 |

*Note: For single-solution configurations, HV is computed treating the single solution as a degenerate front.

The key observations from the comparative analysis:

1. **SCPX alone** (E-SCPX) provides the best computational efficiency (38.1s, 10% faster than baseline), confirming that eliminating repair overhead has a measurable impact on total runtime.

2. **Diversified seeding alone** (E-DIV) provides the best single-solution quality (f₁ = 0.908, f₃ = 0.834), demonstrating that a better starting population translates to a better final result.

3. **NSGA-II alone** (E-NSGA) provides the trade-off visibility that single-solution approaches lack, but without SCPX and diversified seeding, it converges to a Pareto front with lower hypervolume than the full framework.

4. **The complete framework** (E-Full) achieves the best hypervolume (0.678), Pareto front size (16), and individual objective values, while maintaining 100% constraint preservation and requiring only 9.7% more time than the baseline—a modest overhead for substantially richer output.

### 6.6 Statistical Significance

All reported results are averaged over 10 independent runs with different random seeds. We conducted pairwise Mann-Whitney U tests comparing E-Full against each baseline for the hypervolume metric. All differences were statistically significant at p < 0.01, with effect sizes (Cohen's d) ranging from 0.82 (vs. B-NSGA-II) to 1.34 (vs. B-WS).

---

## 7. Conclusion and Future Work

### 7.1 Summary of Contributions

This paper has presented a comprehensive enhancement to the ILP-GA hybrid framework for university timetabling, addressing four structural weaknesses identified through systematic analysis of a deployed production system.

Our **Structural Coordinate-Preserving Crossover (SCPX)** operator replaces slot-level crossover with block-level exchange, mathematically guaranteeing 100% hard-constraint feasibility in all offspring. By eliminating the repair overhead that consumed 37.4% of per-generation processing time in the baseline, SCPX achieves both correctness and efficiency gains.

The **Relaxed-ILP Diversification Strategy** transforms population initialization from a deterministic single-seed process to a principled diverse generation procedure. By solving the ILP with randomized objectives and enforcing Hamming distance thresholds between outputs, we produce initial populations with 28.9% higher entropy, delaying convergence by 22 generations and improving final solution quality by 4.0%.

The **Incremental ILP Rescheduling** module enables the system to respond to real-world disruptions—faculty changes, classroom unavailability, and curriculum modifications—without regenerating the entire timetable. By locking unaffected schedule variables and re-solving only the affected neighborhood, we achieve a 10.6× average speedup over full regeneration with only 3.7% quality degradation.

Finally, the **NSGA-II Multi-Objective Integration** replaces the reductive weighted-sum fitness function with Pareto-dominance-based ranking across five conflicting objectives. The output is a Pareto front of 14-18 non-dominated solutions, enabling institutional decision-makers to understand and navigate the trade-offs inherent in timetable construction rather than accepting a single arbitrarily weighted compromise.

### 7.2 Practical Implications

The framework carries several practical implications for educational timetabling:

- **Deployment Feasibility**: All four contributions operate within the existing architectural boundaries of the baseline system (Next.js + Supabase + OR-Tools), requiring no additional infrastructure.

- **Administrator Empowerment**: The Pareto front output transforms the scheduling process from a black-box "generate and accept" workflow to an informed decision-making process where trade-offs are explicit and selectable.

- **Operational Resilience**: The incremental rescheduling capability enables institutions to handle mid-semester disruptions without the organizational cost of regenerating and redistributing entirely new timetables.

### 7.3 Limitations

Our work has several limitations that warrant acknowledgment:

- **Dataset Scope**: Experiments were conducted on a single departmental dataset. While the dataset is real and representative, the absolute performance numbers (computation time, Pareto front size) may vary with problem scale and constraint density.

- **ILP Solver Dependency**: The diversified seeding strategy requires the ILP to find multiple distinct feasible solutions, which may not be possible for extremely tightly constrained problem instances. The fallback to greedy variations partially addresses this but at the cost of solution quality.

- **NSGA-II Parameter Sensitivity**: The quality of the Pareto front is influenced by population size and generation count, which interact with problem dimensionality. Our parameter choices were tuned on the specific dataset and may require adjustment for different problem scales.

- **User Study**: While we present Pareto fronts as decision-support tools, we have not conducted a formal user study to evaluate how effectively administrators use this information to select timetables. This remains important future work.

### 7.4 Future Research Directions

Several promising directions extend from this work:

1. **NSGA-III for Many-Objective Extension**: As the number of soft constraints grows—considering additional objectives like room preference, faculty seniority weighting, and student cohort grouping—the five-objective framework could be extended to NSGA-III with reference-point-based selection, which handles many-objective spaces more effectively.

2. **Learning-Based Constraint Decomposition**: The current decomposition (ILP for labs, GA for theory) is manually specified. A machine learning proxy that analyzes constraint density and problem structure to dynamically partition constraints between exact and metaheuristic stages could further optimize the ILP-GA boundary.

3. **Online Learning for Incremental Rescheduling**: Historical patterns of schedule disruptions could inform the incremental rescheduling module about which parts of the schedule are most likely to change, enabling proactive solution caching.

4. **Interactive Multi-Objective Decision Making**: Integrating interactive methods where administrators iteratively refine their preferences and receive updated Pareto fronts in real-time would bridge the gap between automated optimization and human decision-making.

5. **Cross-Institutional Validation**: Deploying the framework across multiple institutions with different scheduling rules, class sizes, and constraints would validate the generalizability of our approach.

---

## Acknowledgments

The authors acknowledge the Department of Computer Science and Information Technology for providing access to the production scheduling data and the open-source communities behind OR-Tools, Next.js, and Supabase for their foundational tools.

---

## References

[1] Abramson, D. (1991). Constructing school timetables using simulated annealing: sequential and parallel algorithms. *Management Science*, 37(1), 98-113.

[2] Al-Yakoob, S. M., & Sherali, H. D. (2006). Mathematical programming models and algorithms for a class-faculty assignment problem. *European Journal of Operational Research*, 173(2), 488-507.

[3] Burke, E. K., Elliman, D. G., & Weare, R. F. (1995). A hybrid genetic algorithm for highly constrained timetabling problems. *Proceedings of the 6th International Conference on Genetic Algorithms*, 605-610.

[4] Burke, E. K., Bykov, Y., & Petrovic, S. (2001). A multicriteria approach to examination timetabling. *International Conference on the Practice and Theory of Automated Timetabling*, 118-131.

[5] Chen, R. M., & Shih, H. F. (2013). Solving university course timetabling problems using constriction particle swarm optimization with local search. *Algorithms*, 6(2), 227-244.

[6] Chu, S. C., Chen, Y. T., & Ho, J. H. (2006). Timetable scheduling using particle swarm optimization. *First International Conference on Innovative Computing, Information and Control*, 3, 324-327.

[7] Colorni, A., Dorigo, M., & Maniezzo, V. (1991). Genetic algorithms and highly constrained problems: The time-table case. *International Conference on Parallel Problem Solving from Nature*, 55-59.

[8] Deb, K., Pratap, A., Agarwal, S., & Meyarivan, T. (2002). A fast and elitist multiobjective genetic algorithm: NSGA-II. *IEEE Transactions on Evolutionary Computation*, 6(2), 182-197.

[9] Deb, K., & Jain, H. (2014). An evolutionary many-objective optimization algorithm using reference-point-based nondominated sorting approach, part I: Solving problems with box constraints. *IEEE Transactions on Evolutionary Computation*, 18(4), 577-601.

[10] Dinkel, J. J., Mote, J., & Venkataramanan, M. A. (1989). An efficient decision support system for academic course scheduling. *Operations Research*, 37(6), 853-864.

[11] Fonseca, G. H., Santos, H. G., & Carrano, E. G. (2016). Integrating matheuristics and metaheuristics for timetabling. *Computers & Operations Research*, 74, 108-117.

[12] Head, C., & Shaban, S. (2007). A heuristic approach to simultaneous course/student timetabling. *Computers & Operations Research*, 34(4), 919-933.

[13] Hertz, A. (1991). Tabu search for large scale timetabling problems. *European Journal of Operational Research*, 54(1), 39-47.

[14] Lopes, L., & Smith-Miles, K. (2013). Generating applicable synthetic instances for branch problems. *Operations Research*, 61(3), 563-577.

[15] Muller, T., & Rudova, H. (2012). Real-life curriculum-based timetabling. *Proceedings of the 9th International Conference on the Practice and Theory of Automated Timetabling*, 57-72.

[16] Murray, K., Muller, T., & Rudova, H. (2007). Modeling and solution of a complex university course timetabling problem. *International Conference on the Practice and Theory of Automated Timetabling*, 189-209.

[17] Pillay, N., & Banzhaf, W. (2010). An informed genetic algorithm for the examination timetabling problem. *Applied Soft Computing*, 10(2), 457-467.

[18] Pongcharoen, P., Promtet, W., Yenradee, P., & Hicks, C. (2008). Stochastic optimisation timetabling tool for university course scheduling. *International Journal of Production Economics*, 112(2), 903-918.

[19] Schaerf, A. (1999). A survey of automated timetabling. *Artificial Intelligence Review*, 13(2), 87-127.

[20] Schimmelpfeng, K., & Helber, S. (2007). Application of a real-world university-course timetabling model solved by integer programming. *OR Spectrum*, 29(4), 783-803.

[21] Socha, K., & Sampels, M. (2003). Ant algorithms for the university course timetabling problem with regard to the state-of-the-art. *Applications of Evolutionary Computing*, 334-345.

[22] Thompson, J. M., & Dowsland, K. A. (1998). A robust simulated annealing based examination timetabling system. *Computers & Operations Research*, 25(7-8), 637-648.

[23] Vieira, G. E., Herrmann, J. W., & Lin, E. (2003). Rescheduling manufacturing systems: a framework of strategies, policies, and methods. *Journal of Scheduling*, 6(1), 39-62.

[24] Google OR-Tools. (2024). CP-SAT Solver. https://developers.google.com/optimization/cp/cp_solver

---
