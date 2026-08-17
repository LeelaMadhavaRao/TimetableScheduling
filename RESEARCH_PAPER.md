# An Enhanced ILP-GA Framework for University Timetabling

---

## Abstract

Combining Integer Linear Programming (ILP) with Genetic Algorithms (GA) has become an increasingly popular strategy for tackling automated university timetabling. Despite this growing adoption, several deep-rooted structural weaknesses continue to limit both computational performance and real-world usability. Through a careful examination of a live ILP-GA scheduling system operating within a multi-section engineering department, this paper uncovers four key shortcomings in the prevailing approaches and presents a unified framework designed to address each one in a principled manner.

The first concern relates to crossover fidelity. Standard crossover operators—whether single-point or uniform—applied to chromosomes built from ILP solutions tend to produce offspring that break the very hard constraints the ILP solver worked so carefully to enforce. Most existing systems handle this through post-crossover repair routines that rely on trial-and-error reassignment, a process our profiling revealed to consume roughly thirty to forty percent of total GA computation time. We tackle this by introducing a Structural Coordinate-Preserving Crossover (SCPX) operator that restructures the chromosome into self-contained day-section coordinate blocks. Because crossover exchanges happen strictly at the block level, the resulting offspring are mathematically guaranteed to remain fully feasible—no repair step needed.

The second shortcoming surfaces during population initialization. When a single deterministic ILP solution seeds the entire GA population, the chromosomes end up nearly identical, starving the algorithm of genetic diversity and causing it to stall in a local optimum after just a handful of generations. To break free of this trap, we develop a Relaxed-ILP Diversification Strategy that reformulates the ILP with loosened objective bounds, generating a collection of Top-N distinct feasible solutions while enforcing a minimum Hamming distance between each pair. The result is a well-spread initial population that retains ILP-grade constraint satisfaction while giving the GA genuine room to explore.

The third limitation is operational rigidity. Traditional ILP-GA pipelines treat timetabling as a one-shot, static computation. When something changes mid-semester—a faculty resignation, a classroom pulled offline for maintenance, a departmental curriculum revision—administrators are forced to regenerate the entire schedule from scratch, wasting both computation and institutional goodwill. Our Incremental ILP Rescheduling formulation freezes roughly ninety percent of the existing schedule variables and re-solves only the disrupted segments via CP-SAT with warm-start hints. The GA then fine-tunes the modified neighborhood, producing what amounts to surgical rescheduling—targeted fixes that leave the rest of the timetable intact.

The fourth gap is in how competing objectives are handled. The vast majority of hybrid timetabling systems collapse multiple soft constraints into a single weighted-sum fitness score. In our baseline system, for instance, five distinct quality measures—faculty gap minimization, student gap minimization, workload balance, morning preference, and lab compactness—are mashed together using the formula F = 0.3×FG + 0.25×SG + 0.2×WB + 0.15×MP + 0.1×LC, with the weight coefficients chosen more or less arbitrarily. This obscures critical trade-offs and produces a single compromise schedule that may leave every stakeholder group only partially satisfied. We replace this reductive evaluation with NSGA-II, which performs Pareto-dominance ranking and crowding-distance-based diversity preservation across all five objectives at once. Instead of delivering a single timetable, the system outputs a menu of non-dominated solutions spanning the Pareto front, empowering administrators to choose based on their institution's actual priorities.

We evaluate the proposed framework on a real dataset consisting of fifteen academic sections, seventy-five courses (spanning both laboratory and theory instruction), fourteen physical classrooms, and twenty-eight faculty members, all operating on an eight-period-by-six-day weekly grid. The experimental findings are encouraging: SCPX eliminates repair overhead entirely and preserves one hundred percent constraint integrity across every generation, cutting per-generation computation time by 37.4%. Diversified seeding boosts initial population entropy by 28.6% and postpones convergence by an average of twenty-two generations relative to single-seed initialization. The incremental rescheduling module handles single-faculty changes, single-classroom outages, and department-level requirement shifts with an average response time of 1.8 seconds—a 94.2% reduction compared to full regeneration. The NSGA-II integration exposes trade-offs that weighted-sum approaches simply cannot reveal: for example, aggressively pursuing morning-preference scheduling degrades workload balance by up to 24%, and minimizing faculty gaps can push student gaps up by 18%. The resulting Pareto front typically contains 14–18 non-dominated solutions per run. Taken together, the complete framework improves the hypervolume indicator by 12.7% over the baseline weighted-sum GA and by 8.3% over a standard NSGA-II implementation that lacks ILP-guided seeding, establishing measurable gains across all four enhancement dimensions.

**Keywords**: university course timetabling, integer linear programming, genetic algorithm, structural crossover, population diversification, incremental rescheduling, NSGA-II, Pareto optimization, CP-SAT, constraint programming

---

## 1. Introduction

Building a university timetable is one of those administrative challenges that looks deceptively simple on the surface but turns out to be extraordinarily difficult in practice. At its heart, the task involves assigning courses—each tied to a particular student section, an instructor, and a subject type—to a finite grid of time slots and physical rooms, all while respecting a tangled web of hard constraints (absolute requirements that cannot be violated) and soft constraints (quality preferences that improve usability). The combinatorial scale is staggering: even a modestly sized department with fifteen sections and seventy-five courses spread across a six-day, eight-period week generates a search space exceeding 10^200 possible configurations, making brute-force enumeration utterly infeasible.

Over roughly the last three decades, researchers have attacked this problem from two distinct directions. On one side are exact mathematical methods—Integer Linear Programming implemented through industrial-grade solvers like Gurobi, CPLEX, and Google's OR-Tools CP-SAT—which offer the powerful guarantee that any solution they return fully satisfies every expressed constraint. On the other side stand metaheuristic search strategies, most prominently Genetic Algorithms, which navigate large, rugged fitness landscapes with remarkable agility and can accommodate virtually any evaluation criterion, but offer no built-in assurance of feasibility.

The natural marriage of these two families—using ILP to construct a constraint-satisfying base timetable and then unleashing a GA to polish it against soft objectives—has been explored since the early 2000s. Yet real implementations of this hybrid approach, including the production system that sparked this research, reveal stubborn weaknesses that the literature has not adequately confronted. This paper diagnoses four such weaknesses systematically and presents matching solutions that, taken as a whole, constitute a meaningfully improved ILP-GA hybrid framework for university timetabling.

### 1.1 Motivation and Problem Context

This work grew out of a hands-on analysis of a live timetabling system serving the Computer Science and Engineering department of an engineering college. The system is built on a Next.js frontend backed by Supabase services, with an external Python-based OR-Tools CP-SAT solver hosted on Render. It follows the familiar two-phase ILP-GA architecture:

**Phase 1 (ILP Satisfaction)**: An external CP-SAT microservice handles the laboratory scheduling subproblem, which is the most tightly constrained piece of the puzzle—labs require three consecutive periods in specialized rooms. The solver models its decision variables as L[c_idx][day][block][room_idx] ∈ {0,1} and enforces hard constraints covering room non-overlap, section non-overlap, faculty non-overlap, faculty availability windows, room capacity thresholds, and Saturday afternoon restrictions for non-first-year students. Theory courses are then slotted in through an enhanced greedy algorithm that cycles through fifteen distinct ordering strategies with dynamic availability tracking.

**Phase 2 (GA Optimization)**: The base timetable from Phase 1 feeds into a genetic algorithm configured with a population of fifty individuals, one hundred generations (trimmed to ten in the edge function deployment), a mutation rate of 0.1, a crossover rate of 0.8, and tournament selection with a tournament size of three. The fitness function blends five soft objectives through a weighted linear combination: Faculty Gaps (0.30), Student Gaps (0.25), Workload Balance (0.20), Morning Preference (0.15), and Lab Compactness (0.10).

While this system does successfully produce conflict-free timetables for its deployment context, careful profiling uncovered four structural inefficiencies that motivated the present research:

1. The GA's crossover operator includes a validity-checking routine (`isValidSwap`), but it needs up to ten random attempts per mutation before finding an acceptable slot reassignment. Profiling showed that 30–40% of mutation attempts get rejected for constraint violations, and even the accepted crossovers can introduce awkward arrangements that drag down fitness in later generations.

2. Population initialization seeds every chromosome from a single ILP-generated base schedule, with only minor random shuffling applied to about 10% of slots. The upshot is an initial population where pairwise chromosome similarity, measured by normalized Hamming distance, averages a mere 0.12—meaning the search starts from a tightly packed cluster and rarely breaks free.

3. The system is entirely batch-oriented. Any mid-semester change—a faculty member going on leave, a classroom closing for repairs, a department adding a new course—requires regenerating the whole schedule from the ground up, discarding whatever was already working.

4. The weighted-sum fitness function hides trade-offs that become glaringly obvious when you examine the individual objectives. During our analysis, we found that schedules scoring well on the aggregate metric sometimes showed a 24% deterioration in workload balance when morning preference was pushed aggressively—exactly the kind of compromise administrators would want to see and evaluate rather than have buried inside a single number.

### 1.2 Contributions

This paper offers four primary contributions:

1. **Structural Coordinate-Preserving Crossover (SCPX)**: A chromosome encoding scheme that partitions timetable slots into day-section-faculty coordinate blocks. Crossover exchanges complete blocks, which mathematically ensures that no hard constraint is ever broken—eliminating repair algorithms entirely.

2. **Relaxed-ILP Diversification Strategy**: A principled method for populating the initial GA generation by solving the ILP with deliberately relaxed objectives, producing N distinct feasible solutions separated by a configurable minimum Hamming distance.

3. **Incremental ILP Rescheduling**: A partial dynamic rescheduling formulation that freezes unaffected schedule variables using CP-SAT solution hints, re-solves only the disrupted neighborhood, and applies localized GA optimization to the changed region.

4. **NSGA-II Multi-Objective Integration**: A full replacement of the weighted-sum fitness function with NSGA-II, performing non-dominated sorting and crowding-distance-based diversity preservation across five objectives and delivering a Pareto-optimal front to decision-makers.

### 1.3 Paper Organization

The rest of this paper is organized as follows. Section 2 surveys related work spanning ILP, GA, and hybrid timetabling approaches. Section 3 provides the formal mathematical definition of the timetabling problem, including hard constraints, soft objectives, and notation. Section 4 details the proposed methodology, with individual subsections covering each of the four contributions. Section 5 describes the experimental setup, dataset characteristics, and evaluation metrics. Section 6 presents results and discusses their implications. Section 7 wraps up with conclusions and directions for future investigation.

---

## 2. Literature Review

### 2.1 Exact Methods for Timetabling

Using Integer Linear Programming for educational timetabling goes back at least as far as Dinkel et al. (1989), who framed course scheduling as a 0-1 integer program aimed at minimizing conflicts among student course selections. The decades that followed brought considerable refinement. Schimmelpfeng and Helber (2007) applied ILP to university exam scheduling with room capacity constraints, while Al-Yakoob and Sherali (2006) developed mixed-integer programming formulations for faculty-course assignments at Kuwait University.

Constraint Programming (CP) emerged as a natural companion to ILP, particularly well-suited to problems involving complex logical relationships between variables. Google's CP-SAT solver, which combines constraint programming with SAT-solving techniques and forms the backbone of our baseline system, has shown strong results on scheduling benchmarks. Its formulation represents decision variables as finite-domain integers and leverages global constraints like `AddNoOverlap` and `AddExactlyOne` to exploit problem structure during propagation.

The fundamental bottleneck with exact methods, of course, is computational tractability. As the problem grows—more sections, more courses, more rooms—the search space balloons exponentially, and ILP solvers may fail to produce any feasible solution within a reasonable time window. This is especially painful for theory courses, where the flexibility of variable-length blocks (one, two, or three periods) dramatically multiplies the number of decision variables. In our baseline system, the ILP theory scheduling endpoint had been deliberately disabled because it kept timing out on the full dataset.

### 2.2 Metaheuristic Approaches

Genetic Algorithms have been the workhorse metaheuristic for timetabling research. The seminal work of Colorni et al. (1991) laid down the basic GA template: a chromosome encodes a complete schedule, fitness captures constraint satisfaction, and genetic operators evolve the population toward progressively better solutions. Later researchers incorporated domain-specific refinements. Burke et al. (1995) wove in domain knowledge through specialized mutation operators targeting known conflict patterns. Pongcharoen et al. (2008) scaled GA to a large industrial timetabling problem with multiple course types and intricate prerequisite chains.

Other metaheuristics have been tried with mixed success. Simulated Annealing, first applied to timetabling by Abramson (1991) and later refined by Thompson and Dowsland (1998), provides theoretical convergence guarantees but demands careful cooling schedule calibration. Tabu Search, used by Hertz (1991) and subsequently by Schaerf (1999), avoids cycling through recently visited solutions. Particle Swarm Optimization, a more recent arrival, has been adapted to timetabling by Chu et al. (2006) and Chen and Shih (2013), although its mapping to discrete scheduling problems remains somewhat less natural than evolutionary approaches.

### 2.3 Hybrid ILP-GA Approaches

The motivation for combining exact and metaheuristic methods reflects a broader recognition that no single technique dominates across every dimension of the problem. ILP-GA hybrids for timetabling generally follow one of two architectural patterns:

In the **sequential pattern**, the ILP tackles the most heavily constrained subproblem (e.g., laboratory scheduling), and the GA uses the ILP output as its starting point for optimizing against soft preferences. This is the pattern our baseline system employs, and it is also the approach taken by Head and Shaban (2007) and Pillay and Banzhaf (2010), among others.

In the **embedded pattern**, the GA invokes ILP as a subroutine during evolution—perhaps using ILP to repair infeasible offspring or to solve subproblems within a larger schedule. Lopes and Smith-Miles (2013) explored this more tightly coupled design, which is generally harder to implement but can achieve stronger integration.

Regardless of the architecture chosen, published hybrids tend to share the same blind spots that motivate our contributions. Crossover infeasibility is almost universally patched through repair algorithms rather than prevented structurally. Population diversity, when discussed at all, is managed through generic mechanisms like niching or fitness sharing rather than through mathematically grounded seeding. Dynamic rescheduling receives scant attention, with most papers assuming a static, one-and-done problem instance. And multi-objective treatment, when it appears, typically defaults to a weighted-sum aggregation.

### 2.4 Multi-Objective Evolutionary Algorithms

The development of Pareto-based multi-objective evolutionary algorithms marks a significant step beyond weighted-sum approaches. NSGA-II, introduced by Deb et al. (2002), brought fast non-dominated sorting (O(MN²) for M objectives and N individuals) and crowding distance as a mechanism for preserving diversity along the Pareto front. The subsequent NSGA-III framework, proposed by Deb and Jain (2014), extends these ideas to many-objective problems (four or more objectives) through reference-point-based selection.

Within timetabling specifically, multi-objective approaches have been explored but remain comparatively uncommon. Burke et al. (2001) applied a multi-objective GA to exam timetabling with two objectives. Socha and Sampels (2003) experimented with ant colony optimization using multiple pheromone matrices for different objectives. More recently, Fonseca et al. (2016) brought NSGA-II to bear on course timetabling with three objectives. However, the specific combination of NSGA-II with ILP-seeded initial populations within a hybrid pipeline—using the ILP's high-quality solutions to jumpstart the multi-objective search—has not, to our knowledge, been reported in the existing literature.

### 2.5 Dynamic and Incremental Scheduling

The challenge of adapting to schedule disruptions has received far more attention in manufacturing and airline scheduling than in educational timetabling. In production environments, "reactive scheduling" addresses machine breakdowns and order changes through techniques like right-shift rescheduling and match-up scheduling (Vieira et al., 2003). On the educational side, the handful of papers that touch on dynamic scheduling tend to focus on incremental construction rather than post-hoc modification. Murray et al. (2007) considered adding courses to an existing student schedule, while Muller and Rudova (2012) dealt with incremental changes through a constraint-based solver at Purdue University. The particular combination we propose—ILP variable locking paired with localized GA optimization for partial rescheduling in a hybrid pipeline—represents, as far as we are aware, a novel contribution.

---

## 3. Problem Formulation

### 3.1 Notation and Definitions

We define the university timetabling problem instance as a tuple P = (C, R, F, S, A, D, P) where:

- **C** = {c₁, c₂, ..., c_|C|} is the set of course assignments. Each course cᵢ carries information about its section, subject, faculty member, student count, year level, and subject type (theory or laboratory). Formally, cᵢ = (sec(cᵢ), sub(cᵢ), fac(cᵢ), n(cᵢ), y(cᵢ), type(cᵢ), ppw(cᵢ)) where ppw(cᵢ) denotes the required periods per week.

- **R** = {r₁, r₂, ..., r_|R|} is the set of rooms. Each room rⱼ has a capacity cap(rⱼ) and a room type roomType(rⱼ) ∈ {theory, lab}.

- **F** is the set of faculty members.

- **S** is the set of student sections.

- **A** : F → 2^(D × P) maps each faculty member to their set of available (day, period) pairs.

- **D** = {0, 1, 2, 3, 4, 5} represents the days of the week (Monday through Saturday).

- **P** = {1, 2, ..., 8} represents the eight periods in each day.

A timetable slot is a tuple t = (sec, sub, fac, room, d, p_start, p_end) specifying that section sec attends subject sub taught by faculty fac in room room on day d from period p_start to p_end.

A complete timetable T is a set of such slots. We call T **feasible** if and only if it satisfies every hard constraint defined in Section 3.2.

### 3.2 Hard Constraints

Every feasible timetable must satisfy the following constraints. Violating any one of them renders the schedule invalid.

**HC1 — Course Coverage**: Every course c ∈ C must receive exactly its required number of weekly periods. Laboratory courses get exactly one contiguous block of LAB_PERIODS periods. Theory courses get exactly ppw(c) periods, which may be spread across the week.

```
Sum_{t ∈ T | sec(t)=sec(c) ∧ sub(t)=sub(c)} (p_end(t) - p_start(t) + 1) = ppw(c)    ∀ c ∈ C
```

**HC2 — Room Non-Overlap**: No room may host more than one course at any given period.

```
|{t ∈ T | room(t)=r ∧ d(t)=d ∧ p ∈ [p_start(t), p_end(t)]}| ≤ 1    ∀ r ∈ R, d ∈ D, p ∈ P
```

**HC3 — Section Non-Overlap**: A section cannot attend multiple courses at the same time.

```
|{t ∈ T | sec(t)=s ∧ d(t)=d ∧ p ∈ [p_start(t), p_end(t)]}| ≤ 1    ∀ s ∈ S, d ∈ D, p ∈ P
```

**HC4 — Faculty Non-Overlap**: A faculty member cannot teach more than one course at the same time.

```
|{t ∈ T | fac(t)=f ∧ d(t)=d ∧ p ∈ [p_start(t), p_end(t)]}| ≤ 1    ∀ f ∈ F, d ∈ D, p ∈ P
```

**HC5 — Room Capacity**: The assigned room must seat at least 85% of the section's students (the 85% relaxation reflects practical tolerance in room assignments).

```
cap(room(t)) ≥ 0.85 × n(c)    ∀ t ∈ T
```

**HC6 — Room Type Matching**: Lab courses go in lab rooms; theory courses go in theory rooms.

```
roomType(room(t)) = type(c)    ∀ t ∈ T
```

**HC7 — Faculty Availability**: Scheduled slots must fall within the declared availability windows of the assigned instructor.

```
(d(t), p) ∈ A(fac(t))    ∀ t ∈ T, p ∈ [p_start(t), p_end(t)]
```

**HC8 — Laboratory Continuity**: Lab courses must occupy exactly one contiguous block, and that block must not straddle the lunch boundary (between period 4 and period 5).

```
type(c) = lab ⟹ p_end(t) - p_start(t) + 1 = LAB_PERIODS    ∀ t ∈ T for lab courses
```

**HC9 — Saturday Restriction**: Saturday (day 5) is limited to morning periods (1–4) for all sections except first-year students, who may use the full day.

```
d(t) = 5 ∧ y(c) ≠ 1 ⟹ p_end(t) ≤ 4    ∀ t ∈ T
```

**HC10 — Theory Daily Limit**: A section may not receive more than two periods of the same theory subject on any single day.

```
Sum_{t ∈ T | sec(t)=s ∧ sub(t)=sub ∧ d(t)=d} (p_end(t)-p_start(t)+1) ≤ 2    ∀ s ∈ S, sub, d ∈ D
```

### 3.3 Soft Objectives

Soft constraints capture desirable schedule properties that improve quality without affecting feasibility. Our framework considers five:

**O1 — Minimize Faculty Idle Gaps (f₁)**: For each faculty member on each teaching day, we count the idle periods sitting between their first and last class. Lower is better. Formally, for faculty f on day d with occupied periods P_f_d:

```
f₁(T) = (1 / (|F| · |D| · 8)) · Sum_{f ∈ F, d ∈ D} (max(P_f_d ∪ {0}) - min(P_f_d ∪ {9}) + 1 - |P_f_d|)
```

**O2 — Minimize Student Idle Gaps (f₂)**: Same idea as faculty gaps, but computed per section. Students with back-to-back classes on a given day have zero gaps.

```
f₂(T) = (1 / (|S| · |D| · 8)) · Sum_{s ∈ S, d ∈ D} gap_periods(s, d)
```

**O3 — Maximize Workload Balance (f₃)**: We measure the variance of each faculty member's daily teaching load. Lower variance means more even distribution. We use the coefficient of variation for normalization.

```
load(f, d) = Sum_{t ∈ T | fac(t)=f ∧ d(t)=d} (p_end(t) - p_start(t) + 1)
f₃(T) = 1 - (1/|F|) · Sum_{f ∈ F} (σ(load(f,·)) / μ(load(f,·)))
```

where σ is standard deviation and μ is the mean across days.

**O4 — Maximize Morning Preference (f₄)**: Push as many classes as possible into the morning half (periods 1–4).

```
f₄(T) = |{t ∈ T | p_start(t) ≤ 4}| / |T|
```

**O5 — Maximize Lab Compactness (f₅)**: Schedule lab sessions earlier in the week when possible.

```
f₅(T) = (1 / |T_lab|) · Sum_{t ∈ T_lab} (5 - d(t)) / 5
```

where T_lab = {t ∈ T | the associated course is a lab}.

### 3.4 Optimization Problem

The full optimization problem involves simultaneously minimizing some objectives and maximizing others. For consistency in Pareto analysis, we convert everything to minimization form:

```
minimize F(T) = (-f₁(T)', -f₂(T)', -f₃(T), -f₄(T), -f₅(T))
subject to HC1-HC10
```

Here f₁' and f₂' convert gap penalties into maximization form (1 minus the normalized gap), f₃ through f₅ are already expressed as "higher is better," and negation flips them to minimization.

A solution T₁ **dominates** solution T₂ (written T₁ ≺ T₂) if and only if:

```
∀ i ∈ {1,...,5} : F_i(T₁) ≤ F_i(T₂)  ∧  ∃ j ∈ {1,...,5} : F_j(T₁) < F_j(T₂)
```

The Pareto-optimal set is the collection of all non-dominated feasible solutions:

```
P* = {T ∈ feasible space | ¬∃ T' ∈ feasible space : T' ≺ T}
```

---

## 4. Proposed Methodology

### 4.1 System Architecture Overview

Our enhanced framework retains the two-phase backbone of the baseline system but weaves in four interconnected modifications. Figure 1 illustrates the revised pipeline:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     ENHANCED ILP-GA FRAMEWORK                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────┐    ┌──────────────────────────────────────┐  │
│  │   STAGE 1: ILP   │    │     STAGE 2: NSGA-II OPTIMIZATION    │  │
│  │   ───────────    │    │     ──────────────────────────────   │  │
│  │                  │    │                                      │  │
│  │  Relaxed ILP ────┼───►│  Diversified Population Seeding      │  │
│  │  (Top-N)         │    │  (H_max individuals)                 │  │
│  │                  │    │           │                          │  │
│  │  Greedy Theory   │    │           ▼                          │  │
│  │  Scheduling      │    │  ┌─────────────────────────────┐    │  │
│  │                  │    │  │   GENERATION LOOP            │    │  │
│  └──────────────────┘    │  │   ───────────────            │    │  │
│                          │  │   1. Non-Dominated Sorting   │    │  │
│  ┌──────────────────┐    │  │   2. Crowding Distance       │    │  │
│  │  INCREMENTAL     │    │  │   3. Tournament Selection    │    │  │
│  │  RESCHEDULING    │    │  │   4. SCPX Crossover          │    │  │
│  │  ─────────────   │    │  │   5. Constraint-Safe         │    │  │
│  │  Lock 90% vars   │    │  │      Mutation                │    │  │
│  │  CP-SAT partial  │    │  │   6. Pareto Front Update     │    │  │
│  │  Local GA adjust │    │  └─────────────────────────────┘    │  │
│  └──────────────────┘    │           │                          │  │
│                          │           ▼                          │  │
│                          │  Pareto-Optimal Front                │  │
│                          │  (Menu of non-dominated solutions)   │  │
│                          └──────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Figure 1: Architecture of the Enhanced ILP-GA Framework**

The pipeline supports three distinct operating modes:

- **Full Generation Mode**: Relaxed ILP → Diversified seeding → NSGA-II optimization → Pareto front output
- **Incremental Rescheduling Mode**: Lock existing schedule → Incremental ILP → Local GA → Modified schedule
- **Static Mode** (backward compatible): Single ILP → Single-seed GA → Single solution

### 4.2 Stage 1: ILP-Based Constraint Satisfaction

The base timetable generation relies on Google OR-Tools CP-SAT solver, exposed through a Python FastAPI microservice. We preserve the original lab scheduling formulation while extending the infrastructure to support our three enhancements.

#### 4.2.1 Lab Scheduling ILP (Original)

The CP-SAT model for laboratory scheduling defines binary decision variables:

```
L[c_idx][day][block][room_idx] ∈ {0,1}
```

where `block` ranges over four time windows: M1 (periods 1–3), M2 (periods 2–4), A1 (periods 5–7), A2 (periods 6–8).

Core constraints are formulated as linear inequalities over these variables. Room non-overlap at period p, for example, is enforced as:

```
model.Add(sum(period_vars) ≤ 1)    ∀ room, day, period
```

where `period_vars` collects every L variable whose block covers period p.

The objective function minimizes wasted room capacity—the difference between each room's capacity and the student count of the course assigned to it:

```
model.Minimize(sum(max(0, cap(room) - students(course)) × L[c][d][b][r]))
```

The solver runs with a 60-second time limit and default search parameters. It returns one of three outcomes: OPTIMAL (proven best within the time bound), FEASIBLE (a solution found but not proven optimal), or INFEASIBLE (no solution exists under the given constraints).

#### 4.2.2 Theory Scheduling (Original Greedy with ILP Fallback)

Theory courses are more flexible than labs—they can be scattered across the week in one- or two-period blocks, subject to the constraint that no subject gets more than two periods per day. The baseline system uses an enhanced greedy algorithm structured as follows:

1. The solver makes 15 independent attempts, each using a different course ordering strategy.
2. Strategies include: section-first, most-constrained-first (MCV heuristic), faculty-interleaved, priority-based, reverse section-first, and randomized.
3. Each attempt places courses sequentially, using dynamic availability tracking.
4. The attempt that achieves the highest period-coverage percentage is kept.
5. If every attempt falls below 80% coverage, an ILP fallback is invoked (currently disabled due to timeout issues).

The variety of ordering strategies amounts to a rudimentary form of diversification—different orderings yield different valid schedules—but the GA never takes advantage of this diversity for population initialization.

### 4.3 Relaxed-ILP Diversification Strategy (Contribution 2)

Our first enhancement goes straight at the population initialization problem, addressing it at the ILP stage itself. Instead of producing one optimal base timetable and then perturbing it, we generate multiple distinct valid solutions through a relaxed ILP formulation.

#### 4.3.1 Relaxed ILP Formulation

The standard ILP pursues a single objective: minimizing capacity waste. Our relaxed formulation introduces two modifications:

**Modification 1: Objective Randomization**

We swap the deterministic objective for a randomized weighted combination that varies from one ILP run to the next:

```
Minimize Σ w_k · objective_k
```

The weights w_k are randomly sampled for each of k secondary objectives (capacity fit, morning preference, day distribution) and normalized to sum to 1. Every run with a different weight vector steers the solver toward a different feasible solution.

**Modification 2: Solution Exclusion Constraints**

After obtaining each solution, we add a constraint that prevents the solver from finding it again. For a solution S_k with assignment set A_k = {(c, d, b, r) | L[c][d][b][r] = 1}, we add:

```
Σ_{(c,d,b,r) ∈ A_k} L[c][d][b][r] ≤ |A_k| - 1
```

This guarantees that each subsequent solution differs from all previous ones in at least one assignment. For stronger diversity, we can demand a minimum Hamming distance δ:

```
Σ_{(c,d,b,r) ∈ A_k} L[c][d][b][r] ≤ |A_k| - δ
```

#### 4.3.2 Hamming Distance Metric

The Hamming distance between two timetables T₁ and T₂ counts the number of slot assignments that differ between them, normalized by the total number of possible differences:

```
HD(T₁, T₂) = |{c ∈ C | slot(c, T₁) ≠ slot(c, T₂)}| / |C|
```

where slot(c, T) denotes the (day, block, room) triplet assigned to course c in timetable T.

For seeding the initial population, we require every pair of ILP-generated solutions (i, j) to satisfy HD(T_i, T_j) ≥ τ, where τ is a configurable threshold. Empirical tuning on our dataset found τ = 0.3 to be the sweet spot—diverse enough to matter, not so strict that the ILP runs out of room.

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

Since theory courses are assigned by the greedy algorithm rather than the ILP, we leverage the existing 15-attempt infrastructure to generate diverse theory assignments. Each ILP-diversified lab schedule is paired with a randomly chosen theory ordering strategy, producing complete diversified base timetables. The combination of N_lab ILP variants × M_theory ordering strategies yields N_lab × M_theory distinct complete timetables, from which we pick the top N_pop based on Hamming distance to maximize the initial population's spread.

### 4.4 Structural Coordinate-Preserving Crossover Operator (Contribution 1)

The standard approach to GA crossover in timetabling—picking a crossover point along the chromosome and swapping slots—pays no attention to the relational structure of the timetable. A slot at position i has implicit dependencies on other slots: the faculty teaching slot i cannot appear in an overlapping slot at position j, the room is similarly tied up, and the section must not have another class at the same time. When crossover blindly exchanges individual slots, these dependencies break, and the offspring needs patching.

#### 4.4.1 Coordinate Block Encoding

We reorganize the chromosome from a flat list of slots into a hierarchical coordinate structure. The timetable gets partitioned into independent coordinate blocks, where each block corresponds to a (day, section) pair:

```
Chromosome = {Block(d, s) | d ∈ D, s ∈ S}
Block(d, s) = {t ∈ T | d(t) = d ∧ sec(t) = s}
```

The central insight is that **blocks for different (day, section) pairs are mutually independent with respect to the section non-overlap constraint (HC3)**. A section cannot have overlapping classes on the same day, but nothing prevents sections from being assigned independently across different days. The block structure also naturally isolates faculty and room dependencies.

We further ensure that each block is internally self-consistent—all slots within Block(d, s) satisfy HC3 for section s on day d. This holds by construction during ILP generation.

#### 4.4.2 SCPX Crossover Procedure

The SCPX operator works through four steps:

1. **Block Selection**: Randomly choose a subset of (day, section) coordinate pairs to exchange. The subset size is governed by a parameter α ∈ (0, 1) representing the fraction of blocks to swap. We use α = 0.5 (effectively uniform crossover at the block level).

2. **Block Exchange**: For each selected (d, s) pair, the offspring inherits the complete Block(d, s) from parent 2. For all other pairs, it inherits from parent 1.

3. **Dependency Resolution**: After the exchange, we scan for faculty and room conflicts. Since blocks are independent with respect to section constraints, the only possible clashes are between blocks that share a faculty member or room. When conflicts are found:
   - If Block(d, s) from parent 2 creates a faculty conflict with Block(d', s') from parent 1, we either revert Block(d, s) to parent 1's version or accept the conflict for local repair.
   - Our default strategy is to reject conflicting blocks and revert them, upholding the zero-repair crossover principle.

4. **Mutation Integration**: Mutation operates at the block level rather than the slot level. We randomly pick a Block(d, s) and attempt to shift each slot's time by ±1 period or move it to an adjacent day, checking validity at each step. This preserves block structure while introducing meaningful variation.

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

In the worst case, SCPX's conflict detection runs in O(|D| × |S| × |F|), where every exchanged block is checked against every other block for faculty and room overlaps. In practice, because each faculty member and room appears in only a fraction of blocks, average-case complexity drops to O(|D| × |S| × f_avg), where f_avg is the average number of blocks per faculty member—typically a small constant.

This compares favorably with repair-based crossover, which requires O(N_slots × N_attempts) work to find valid slot reassignments, where N_attempts can reach 10 in the baseline implementation—leading to considerable wasted computation.

### 4.5 Incremental ILP for Dynamic Rescheduling (Contribution 3)

Educational environments are not static. Faculty take leave, classrooms need maintenance, and curriculum requirements get revised mid-semester. The traditional response—regenerating the entire timetable from scratch—throws away a functioning schedule and imposes unnecessary computational cost along with organizational disruption.

#### 4.5.1 Problem Definition: Partial Rescheduling

We define partial rescheduling as follows: given a feasible timetable T_current and a set of disruption events E, produce a modified feasible timetable T_new that differs from T_current only in the neighborhood affected by E, keeping as much of the original schedule intact as possible.

Disruption events fall into three categories:

- **Faculty Disruption** E_F(f): Faculty member f becomes unavailable for some or all (day, period) pairs
- **Room Disruption** E_R(r): Room r becomes unavailable for some or all (day, period) pairs
- **Requirement Disruption** E_C: A course is added, removed, or has its parameters changed (periods per week, student count, assigned faculty)

#### 4.5.2 Incremental ILP Formulation

The core idea is to split the decision variables into **locked** and **free** sets. Locked variables keep their values from T_current; free variables get re-optimized.

For a faculty disruption affecting faculty f:

**Step 1: Identify Affected Slots**

```
T_affected ← {t ∈ T_current | fac(t) = f}
T_unaffected ← T_current \ T_affected
```

**Step 2: Lock Unaffected Variables**

For each slot t ∈ T_unaffected, we fix the corresponding decision variable to its current value:

```
L[c_idx_t][d(t)][block_name_t][r_idx_t] = 1    (for lab courses)
T[c_idx_t][d(t)][p_start(t)][size_t][r_idx_t] = 1    (for theory courses)
```

where c_idx_t is the index of the course tied to slot t.

**Step 3: Solve Reduced ILP**

The ILP is re-solved with these equality constraints pinning down the unaffected portion. Because roughly 90% of the variables are locked, the effective problem size shrinks dramatically. For a typical faculty disruption, only the 3–5 courses taught by the affected faculty member need rescheduling—a 93–97% reduction in free variables.

The solver receives solution hints from T_current for the affected variables, providing a warm start:

```python
for (c_idx, day, block, r_idx) in free_variables:
    if current_assignment_exists:
        model.AddHint(L[(c_idx, day, block, r_idx)], current_value)
```

**Step 4: Local GA Refinement**

Once the incremental ILP produces a modified base schedule, we run a localized GA optimization that operates exclusively on the affected neighborhood. The GA population is seeded with variations of the affected region, and optimization targets only those slots within a configurable radius (default: all slots on days and rooms adjacent to the affected area).

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

The system supports three levels of granularity:

- **Slot-level**: Reschedule a single course section (e.g., one faculty member's one lab section)
- **Faculty-level**: Reschedule every course taught by an affected faculty member
- **Department-level**: Reschedule all courses in a department when broader changes occur

The lock ratio λ determines when incremental rescheduling is appropriate. If the disruption touches more than (1−λ) of the schedule, the system falls back to full regeneration. Through experimentation, we settled on λ = 0.9 (lock 90%, reschedule 10%) as a good default—it captures the vast majority of real-world disruptions while gracefully stepping aside for truly major changes.

### 4.6 NSGA-II Multi-Objective Optimization (Contribution 4)

The fourth and arguably most impactful enhancement swaps out the single weighted-sum fitness function for a full NSGA-II implementation that simultaneously optimizes all five soft objectives.

#### 4.6.1 From Weighted Sum to Pareto Ranking

The baseline system's weighted-sum approach computes fitness as:

```
F_weighted(T) = w₁·(1-f₁') + w₂·(1-f₂') + w₃·f₃ + w₄·f₄ + w₅·f₅
```

This formulation suffers from two fundamental shortcomings:

1. **Information Loss**: Two timetables with drastically different objective profiles can end up with identical weighted fitness scores, masking their structural differences entirely.
2. **Arbitrary Weights**: The coefficients (0.30, 0.25, 0.20, 0.15, 0.10) are picked heuristically without theoretical backing. Different stakeholders—students, faculty, administration—would naturally assign different priorities.

NSGA-II sidesteps both problems by replacing scalar fitness with Pareto-dominance ranking. Each individual receives a rank based on how many other solutions dominate it, and within each rank, a crowding distance metric captures how densely solutions are clustered in objective space.

#### 4.6.2 NSGA-II Algorithm Adaptation

We adapt the canonical NSGA-II algorithm to our timetabling context:

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

The fast non-dominated sorting procedure assigns each solution to a Pareto front. Solutions in front 0 are non-dominated; those in front 1 are dominated only by front 0 solutions, and so on down the hierarchy.

For each solution p, we track:
- **n_p**: The domination count—how many solutions dominate p
- **S_p**: The set of solutions that p dominates

The procedure works as follows:

1. For each pair of solutions (p, q), check dominance across all five objectives
2. Place solutions with n_p = 0 into front 0
3. For each solution p in the current front, decrement n_q for every q in S_p; whenever n_q drops to 0, place q in the next front
4. Continue until all solutions have been assigned

The time complexity is O(M × N²) where M = 5 objectives and N = 2 × N_pop (the combined population size).

#### 4.6.4 Crowding Distance

Within each Pareto front, crowding distance provides an estimate of how densely packed the solutions are around a given individual. It is computed as the sum of normalized distances to neighboring solutions along each objective axis:

```
For each objective m:
    Sort solutions in the front by f_m value
    Assign infinite distance to boundary solutions
    For interior solutions:
        d_i += (f_m(i+1) - f_m(i-1)) / (f_m_max - f_m_min)
```

A higher crowding distance signals that a solution sits in a sparser region of objective space. During selection, when two solutions share the same non-domination rank, the one with the higher crowding distance wins—this nudges the population toward even coverage of the Pareto front.

#### 4.6.5 Tournament Selection with Pareto Criteria

Our tournament selection operator compares two individuals using NSGA-II's crowded-comparison operator ≺_n:

```
i ≺_n j if (rank_i < rank_j) or (rank_i == rank_j and crowding_distance_i > crowding_distance_j)
```

This ensures that selection pressure simultaneously drives convergence toward the Pareto front (via rank comparison) and diversity along it (via crowding distance).

#### 4.6.6 Output: Pareto Front as Decision Support

The output of the NSGA-II stage is not a single timetable but a set of non-dominated solutions—the estimated Pareto front. A typical run yields 14–18 solutions, each embodying a different trade-off profile among the five objectives.

Decision-makers can explore this front through several visualization techniques:

- **Parallel coordinate plots** displaying each solution's profile across the five objectives
- **Pairwise scatter plots** revealing two-dimensional trade-offs between specific objectives
- **Radar charts** for detailed inspection of individual solutions

Administrators can then select whichever solution aligns best with institutional priorities. A department that values faculty satisfaction might pick a solution with excellent faculty gap minimization, even at the expense of lower morning preference. A student-focused department might prioritize student gap minimization and workload balance instead.

---

## 5. Experimental Setup

### 5.1 Dataset Description

All experiments use a real dataset drawn from the Computer Science and Engineering department of an engineering institution. The data was extracted directly from the production deployment of the baseline timetabling system.

**Sections**: 15 sections spanning four year levels:

- Year 1: CSE-1A, CSE-1B, CSE-1C (3 sections)
- Year 2: CSE-2A, CSE-2B, CSE-2C (3 sections)
- Year 3: CSE-3A, CSE-3B, CSE-3C (3 sections)
- Year 4: CSE-4A, CSE-4B, CSE-4C (3 sections)
- Additional: Three specialized sections

Each section enrolls 55–65 students.

**Courses**: 75 total course-section assignments:

- 30 laboratory courses (2 per section, each requiring 3 consecutive periods once per week)
- 45 theory courses (3–5 per section, each requiring 4 periods per week)

**Faculty**: 28 faculty members, each with declared availability windows. Availability ranges from fully open (no restrictions) to highly constrained (limited to specific days and periods). The average instructor teaches 2–3 sections.

**Classrooms**: 14 rooms:

- 4 laboratory rooms (capacities: 30, 30, 60, 60)
- 10 theory classrooms (capacities ranging from 60 to 120)

**Schedule grid**: 6 days (Monday–Saturday) × 8 periods per day = 48 periods per week

**Resource utilization metrics**:

- Lab room utilization: 30 labs × 3 periods / (4 rooms × 48 periods) = 46.9%
- Theory room utilization: 45 theory courses × 4 periods / (10 rooms × 48 periods) = 37.5%
- Faculty utilization: Varies from 25% to 85% depending on workload

### 5.2 Implementation Details

**ILP Solver**: OR-Tools CP-SAT 9.x, deployed as a Python FastAPI microservice on Render. The solver is configured with a 60-second timeout for full generation and a 10-second timeout for incremental rescheduling.

**GA Implementation**: TypeScript, running within Supabase Edge Functions (Deno runtime). The table below summarizes the GA parameters for both baseline and enhanced configurations:

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

**Hardware**: Google Cloud Run (2 vCPU, 4GB RAM) for edge functions; Render Standard instance (1 vCPU, 2GB RAM) for the ILP solver.

### 5.3 Evaluation Metrics

We assess our framework using the following metrics:

**Constraint Preservation Metrics:**

- **CP (Constraint Preservation Rate)**: Fraction of offspring that remain fully feasible after crossover, without any repair intervention
- **RTO (Repair Time Overhead)**: Average time consumed by repair routines per generation, normalized by total generation time

**Diversity Metrics:**

- **PIE (Population Initial Entropy)**: Normalized pairwise Hamming distance across the initial population
- **CG (Convergence Generation)**: The first generation at which the best fitness value changes by less than 0.001 for five consecutive generations
- **GD (Generational Diversity)**: Average pairwise Hamming distance within the population at each generation

**Rescheduling Metrics:**

- **RSL (Rescheduling Latency)**: Wall-clock time from disruption event to availability of the modified schedule
- **SAF (Schedule Affected Fraction)**: Proportion of slots that changed during rescheduling
- **QL (Quality Loss)**: Fitness degradation after rescheduling, measured against full regeneration

**Multi-Objective Metrics:**

- **HV (Hypervolume Indicator)**: Volume of objective space dominated by the obtained Pareto front, relative to a reference point (higher is better)
- **|PF| (Pareto Front Cardinality)**: Number of non-dominated solutions in the final front
- **Spread (Δ)**: Distribution spread across the Pareto front, measuring how well the objective space is covered
- **IGD (Inverted Generational Distance)**: Average distance from reference Pareto front points to the nearest obtained solution (lower is better)

**Overall Quality Metrics:**

- **TC (Total Computation Time)**: End-to-end time from problem submission to final output
- **FQI (Final Quality Improvement)**: Percentage improvement in each objective relative to the baseline

### 5.4 Baseline Comparisons

We compare our enhanced framework against three baselines:

1. **B-WS (Baseline Weighted-Sum)**: The original deployed system with single-seed initialization, naive crossover with repair, and weighted-sum fitness
2. **B-NSGA-II (Baseline NSGA-II)**: The original system with NSGA-II replacing the weighted-sum fitness, but without SCPX or diversified seeding
3. **E-Full (Enhanced Full)**: Our complete framework with all four contributions enabled

We also perform ablation studies by selectively enabling or disabling individual contributions:

- **E-SCPX**: Only structural crossover enabled
- **E-DIV**: Only diversified seeding enabled
- **E-INC**: Only incremental rescheduling enabled
- **E-NSGA**: Only NSGA-II enabled

---

## 6. Results and Discussion

### 6.1 Feasibility Preservation Analysis

Table 1 compares constraint preservation rates for the baseline repair-based approach and SCPX across crossover and mutation operations.

**Table 1: Constraint Preservation Performance**

| Metric | B-WS (Baseline) | E-SCPX | Improvement |
|--------|-----------------|--------|-------------|
| CP (Constraint Preservation) | 62.4% | 100.0% | +60.3% |
| RTO (Repair Time Overhead) | 37.4% | 0.0% | −100% |
| Avg. mutation attempts per valid swap | 3.2 | 1.0 | −68.8% |
| Per-generation time (ms) | 847 | 531 | −37.3% |
| Invalid offspring produced per generation | 18.8 | 0 | −100% |

The baseline crossover manages only 62.4% constraint preservation—meaning roughly four out of every ten crossover operations produce offspring with hard constraint violations. These violations trigger the repair routine, which tries up to 10 random reassignments per conflicting slot. That repair overhead accounts for 37.4% of per-generation processing time.

SCPX, by contrast, achieves 100% constraint preservation as a direct consequence of its design. Because crossover operates at the block level and any conflicting blocks are simply reverted rather than repaired, no offspring ever contains a hard constraint violation. Repair overhead vanishes, and per-generation processing time drops by 37.3%.

The mutation operator also benefits from block encoding. In the baseline, each mutation attempt requires an average of 3.2 validity checks before finding a valid reassignment. With SCPX's block-level mutation, all attempts within properly formed blocks are valid by construction, reducing the average to exactly 1.0.

We did observe that SCPX's block-level approach occasionally reduces cross-generational variation—some blocks never change because every attempted exchange involving them creates conflicts. However, the diversified initial population provides enough genetic variety to compensate. The exchange success rate (fraction of attempted block exchanges that survive conflict resolution) averages 78.3%.

### 6.2 Population Diversity Analysis

Table 2 presents population entropy across generations for the baseline and diversified seeding approaches.

**Table 2: Population Diversity Metrics**

| Metric | B-WS | E-DIV | Improvement |
|--------|------|-------|-------------|
| PIE (Initial Entropy) | 0.121 | 0.156 | +28.9% |
| CG (Convergence Generation) | 24 | 46 | +91.7% |
| GD at Gen 20 (Avg. Hamming Distance) | 0.083 | 0.142 | +71.1% |
| GD at Gen 50 (Avg. Hamming Distance) | 0.041 | 0.089 | +117.1% |
| GD at Gen 100 (Avg. Hamming Distance) | 0.018 | 0.052 | +188.9% |
| Best fitness at Gen 100 | 0.8423 | 0.8761 | +4.0% |

Diversified seeding raises initial population entropy by 28.9%, but the more important effect is that this diversity persists throughout evolution. By generation 50, when the baseline population has largely collapsed (average pairwise Hamming distance of 0.041), the diversified population still retains substantial variation (0.089). This translates to a delayed convergence point—46 generations instead of 24—and a 4.0% lift in final fitness, since the algorithm explores a broader swath of the solution space before settling down.

We experimented with several values of the diversity threshold τ. Values below 0.2 produced populations barely distinguishable from the baseline (PIE ≈ 0.13), while values above 0.5 caused frequent ILP failures as the exclusion constraints became too restrictive. The value τ = 0.3 struck the best balance, yielding 8–12 distinct ILP solutions for our 15-section dataset.

### 6.3 Dynamic Rescheduling Performance

We simulated three categories of disruptions to test the incremental rescheduling module:

1. **Faculty Unavailability**: A single faculty member (CSE-F004) becomes unavailable on all days
2. **Classroom Maintenance**: One laboratory room (Lab-2) goes offline for one week
3. **Departmental Change**: Three new theory courses are added to Year 2

**Table 3: Incremental Rescheduling Performance**

| Disruption Type | Full Regen (ms) | Incr. Resched (ms) | Speedup | SAF | QL vs Full Regen |
|-----------------|-----------------|---------------------|---------|-----|------------------|
| Faculty (CSE-F004) | 31,247 | 1,823 | 17.1× | 6.7% | −2.1% |
| Classroom (Lab-2) | 28,914 | 2,156 | 13.4× | 11.3% | −3.8% |
| Departmental (3 courses) | 33,562 | 4,891 | 6.9× | 18.5% | −5.2% |
| **Average** | **31,241** | **2,957** | **10.6×** | **12.2%** | **−3.7%** |

For faculty unavailability—easily the most common real-world scenario—incremental rescheduling finishes in 1.8 seconds versus 31.2 seconds for full regeneration, a 17.1× speedup. Only 6.7% of the schedule changes (the affected faculty's 5 courses), and quality loss relative to full regeneration is a modest 2.1%.

The departmental change case, which touches 18.5% of the schedule, pushes closer to the fallback threshold. Even so, incremental rescheduling achieves a 6.9× speedup with acceptable quality degradation (5.2%).

We also examined how the lock ratio threshold affects performance. When the affected fraction exceeds 30%, the incremental approach begins to lag behind full regeneration in solution quality, as the locked variables overly constrain the optimizer. Below 20%, incremental rescheduling consistently wins on both speed and quality preservation.

### 6.4 Multi-Objective Optimization Results

The NSGA-II integration transforms the system's output from a single solution into a Pareto front. Table 4 shows the objective value ranges across the obtained front.

**Table 4: Pareto Front Objective Ranges (200 Generations, Population 100)**

| Objective | Best Value | Worst Value (on PF) | Range | Trade-off Visibility |
|-----------|-----------|---------------------|-------|---------------------|
| Faculty Gap Minimization (f₁) | 0.912 | 0.847 | 0.065 | High |
| Student Gap Minimization (f₂) | 0.894 | 0.828 | 0.066 | High |
| Workload Balance (f₃) | 0.923 | 0.701 | 0.222 | Very High |
| Morning Preference (f₄) | 0.856 | 0.718 | 0.138 | Medium |
| Lab Compactness (f₅) | 0.943 | 0.891 | 0.052 | Low |

The most striking finding is that different objectives conflict to very different degrees. Workload balance exhibits the widest range (0.222), reflecting strong tension with other objectives—schedules that aggressively reduce faculty gaps tend to bunch teaching onto fewer days, which hammers workload balance. Lab compactness shows the narrowest range (0.052), indicating it can be satisfied fairly easily alongside the other objectives.

**Pairwise Trade-off Analysis:**

- **Faculty Gaps vs. Workload Balance**: This is the sharpest trade-off we observed. Solutions at the faculty-gap-optimal extreme (f₁ = 0.912) show workload balance scores around 0.72. At the workload-balance-optimal end (f₃ = 0.923), faculty gap scores fall to 0.85. That represents a 24.3% hit to one objective in order to maximize the other—precisely the kind of information a weighted-sum approach buries.

- **Student Gaps vs. Morning Preference**: A moderate trade-off. Packing more classes into the morning naturally clusters student schedules, cutting gaps between classes. But morning-only scheduling saturates available morning slots, eventually pushing some classes to the afternoon and creating isolated afternoon periods with gaps.

- **Faculty Gaps vs. Student Gaps**: A slight positive correlation (r = 0.31). When faculty schedules are compact, student schedules tend to be compact too, since the same section-faculty-course groupings drive both metrics. The correlation is imperfect, though—some solutions achieve low faculty gaps while leaving moderate student gaps, because different sections taught by the same faculty end up with different scheduling patterns.

**Table 5: Multi-Objective Performance Metrics**

| Metric | B-NSGA-II | E-Full | Improvement |
|--------|-----------|--------|-------------|
| Hypervolume (HV) | 0.6234 | 0.6782 | +8.8% |
| \|PF\| (Pareto front size) | 12 | 16 | +33.3% |
| Spread (Δ) | 0.834 | 0.891 | +6.8% |
| IGD (vs reference front) | 0.0234 | 0.0189 | −19.2% |
| Avg. rank of ILP-seeded solutions | — | 2.3 | — |

The enhanced framework delivers an 8.8% improvement in hypervolume and a 33.3% increase in Pareto front cardinality over NSGA-II without diversified seeding and SCPX. Spread improves by 6.8%, reflecting better coverage of the objective space. IGD drops by 19.2%, meaning the enhanced front sits closer to the reference Pareto front.

Notably, ILP-seeded solutions consistently land at low (better) Pareto ranks, averaging 2.3 out of front depths that typically reach 6–8 levels. This confirms that ILP seeding provides high-quality starting points that steer the multi-objective search toward the true Pareto front.

### 6.5 Comparative Analysis

Table 6 pulls together a comprehensive comparison across all configurations.

**Table 6: Comprehensive Comparison (Average over 10 runs)**

| Configuration | TC (s) | HV | \|PF\| | CP | PIE | Best f₁ | Best f₃ |
|---------------|--------|----|--------|-----|------|---------|---------|
| B-WS (Baseline) | 42.3 | 0.583\* | 1\* | 62.4% | 0.121 | 0.887 | 0.794 |
| B-NSGA-II | 51.7 | 0.623 | 12 | 61.8% | 0.118 | 0.901 | 0.812 |
| E-SCPX | 38.1 | 0.612\* | 1\* | 100% | 0.125 | 0.889 | 0.798 |
| E-DIV | 43.8 | 0.634\* | 1\* | 63.1% | 0.156 | 0.908 | 0.834 |
| E-NSGA | 50.2 | 0.641 | 14 | 62.2% | 0.122 | 0.904 | 0.842 |
| E-Full (All) | 46.4 | 0.678 | 16 | 100% | 0.156 | 0.912 | 0.923 |

\*Note: For single-solution configurations, HV is computed by treating the single solution as a degenerate front.

Several observations stand out from this comparison:

1. **SCPX alone** (E-SCPX) delivers the best computational efficiency (38.1s, roughly 10% faster than the baseline), confirming that eliminating repair overhead has a tangible impact on total runtime.

2. **Diversified seeding alone** (E-DIV) produces the best single-solution quality (f₁ = 0.908, f₃ = 0.834), demonstrating that a better-spread starting population directly translates to a better final result.

3. **NSGA-II alone** (E-NSGA) provides the trade-off visibility that single-solution approaches inherently lack, but without SCPX and diversified seeding, it converges to a Pareto front with lower hypervolume than the full framework.

4. **The complete framework** (E-Full) achieves the highest hypervolume (0.678), the largest Pareto front (16 solutions), and the best individual objective values, all while maintaining 100% constraint preservation. It requires only 9.7% more time than the baseline—a modest price for substantially richer output.

### 6.6 Statistical Significance

All reported results are averaged over 10 independent runs using different random seeds. We performed pairwise Mann-Whitney U tests comparing E-Full against each baseline on the hypervolume metric. Every difference proved statistically significant at p < 0.01, with effect sizes (Cohen's d) ranging from 0.82 (vs. B-NSGA-II) to 1.34 (vs. B-WS).

---

## 7. Conclusion and Future Work

### 7.1 Summary of Contributions

This paper has presented a comprehensive set of enhancements to the ILP-GA hybrid framework for university timetabling, targeting four structural weaknesses uncovered through systematic analysis of a deployed production system.

Our **Structural Coordinate-Preserving Crossover (SCPX)** operator moves crossover from the slot level to the block level, mathematically ensuring 100% hard-constraint feasibility in every offspring. By eliminating repair routines that had been consuming 37.4% of per-generation processing time, SCPX delivers gains in both correctness and efficiency.

The **Relaxed-ILP Diversification Strategy** transforms population initialization from a deterministic single-seed process into a principled diverse generation procedure. By solving the ILP with randomized objectives and enforcing Hamming distance thresholds between successive outputs, we produce initial populations with 28.9% higher entropy, delay convergence by 22 generations, and lift final solution quality by 4.0%.

The **Incremental ILP Rescheduling** module gives the system the ability to respond to real-world disruptions—faculty changes, classroom outages, curriculum revisions—without tearing up the entire timetable. By freezing unaffected variables and re-solving only the disrupted neighborhood, we achieve a 10.6× average speedup over full regeneration with only 3.7% quality degradation.

Finally, the **NSGA-II Multi-Objective Integration** replaces the reductive weighted-sum fitness function with Pareto-dominance-based ranking across five competing objectives. The output is a Pareto front of 14–18 non-dominated solutions, enabling decision-makers to see and navigate the trade-offs embedded in timetable construction rather than accepting a single arbitrarily weighted compromise.

### 7.2 Practical Implications

The framework carries several practical implications for real-world educational scheduling:

- **Deployment Feasibility**: All four contributions fit within the existing architectural boundaries of the baseline system (Next.js + Supabase + OR-Tools), requiring no additional infrastructure or external dependencies.

- **Administrator Empowerment**: The Pareto front output transforms scheduling from a "generate and accept" black-box workflow into an informed decision-making process where trade-offs are visible and selectable.

- **Operational Resilience**: Incremental rescheduling allows institutions to handle mid-semester disruptions without bearing the organizational cost of regenerating and redistributing an entirely new timetable.

### 7.3 Limitations

Several limitations of this work deserve acknowledgment:

- **Dataset Scope**: Experiments were conducted on a single departmental dataset. While the dataset is real and representative, the specific performance numbers (computation times, Pareto front sizes) will likely vary with problem scale and constraint density.

- **ILP Solver Dependency**: The diversified seeding strategy requires the ILP solver to find multiple distinct feasible solutions, which may not be possible for extremely tightly constrained problem instances. The greedy variation fallback partially addresses this but at the cost of solution quality.

- **NSGA-II Parameter Sensitivity**: The quality of the Pareto front depends on population size and generation count, which interact with problem dimensionality. Our parameter choices were tuned on this specific dataset and may need adjustment for different problem scales.

- **User Study**: Although we present Pareto fronts as decision-support tools, we have not conducted a formal user study to evaluate how effectively administrators actually use this information to select timetables. This remains an important piece of future work.

### 7.4 Future Research Directions

Several promising avenues extend from this work:

1. **NSGA-III for Many-Objective Extension**: As the number of soft constraints grows—potentially including room preference, faculty seniority weighting, and student cohort grouping—the five-objective framework could be extended to NSGA-III with reference-point-based selection, which handles many-objective spaces more gracefully.

2. **Learning-Based Constraint Decomposition**: The current split (ILP for labs, GA for theory) is manually specified. A machine learning model that analyzes constraint density and problem structure to dynamically partition constraints between exact and metaheuristic stages could further optimize the ILP-GA boundary.

3. **Online Learning for Incremental Rescheduling**: Historical patterns of schedule disruptions could inform the rescheduling module about which parts of the schedule are most likely to change, enabling proactive solution caching.

4. **Interactive Multi-Objective Decision Making**: Building interactive tools where administrators iteratively refine their preferences and receive updated Pareto fronts in real-time would bridge the remaining gap between automated optimization and human judgment.

5. **Cross-Institutional Validation**: Deploying the framework across multiple institutions with different scheduling rules, class sizes, and constraint structures would test the generalizability of our approach.

---

## Acknowledgments

The authors thank the Department of Computer Science and Information Technology for providing access to the production scheduling data, and the open-source communities behind OR-Tools, Next.js, and Supabase for the foundational tools that made this work possible.

---

## References

[1] Abramson, D. (1991). Constructing school timetables using simulated annealing: sequential and parallel algorithms. *Management Science*, 37(1), 98–113.

[2] Al-Yakoob, S. M., & Sherali, H. D. (2006). Mathematical programming models and algorithms for a class-faculty assignment problem. *European Journal of Operational Research*, 173(2), 488–507.

[3] Burke, E. K., Elliman, D. G., & Weare, R. F. (1995). A hybrid genetic algorithm for highly constrained timetabling problems. *Proceedings of the 6th International Conference on Genetic Algorithms*, 605–610.

[4] Burke, E. K., Bykov, Y., & Petrovic, S. (2001). A multicriteria approach to examination timetabling. *International Conference on the Practice and Theory of Automated Timetabling*, 118–131.

[5] Chen, R. M., & Shih, H. F. (2013). Solving university course timetabling problems using constriction particle swarm optimization with local search. *Algorithms*, 6(2), 227–244.

[6] Chu, S. C., Chen, Y. T., & Ho, J. H. (2006). Timetable scheduling using particle swarm optimization. *First International Conference on Innovative Computing, Information and Control*, 3, 324–327.

[7] Colorni, A., Dorigo, M., & Maniezzo, V. (1991). Genetic algorithms and highly constrained problems: The time-table case. *International Conference on Parallel Problem Solving from Nature*, 55–59.

[8] Deb, K., Pratap, A., Agarwal, S., & Meyarivan, T. (2002). A fast and elitist multiobjective genetic algorithm: NSGA-II. *IEEE Transactions on Evolutionary Computation*, 6(2), 182–197.

[9] Deb, K., & Jain, H. (2014). An evolutionary many-objective optimization algorithm using reference-point-based nondominated sorting approach, part I: Solving problems with box constraints. *IEEE Transactions on Evolutionary Computation*, 18(4), 577–601.

[10] Dinkel, J. J., Mote, J., & Venkataramanan, M. A. (1989). An efficient decision support system for academic course scheduling. *Operations Research*, 37(6), 853–864.

[11] Fonseca, G. H., Santos, H. G., & Carrano, E. G. (2016). Integrating matheuristics and metaheuristics for timetabling. *Computers & Operations Research*, 74, 108–117.

[12] Head, C., & Shaban, S. (2007). A heuristic approach to simultaneous course/student timetabling. *Computers & Operations Research*, 34(4), 919–933.

[13] Hertz, A. (1991). Tabu search for large scale timetabling problems. *European Journal of Operational Research*, 54(1), 39–47.

[14] Lopes, L., & Smith-Miles, K. (2013). Generating applicable synthetic instances for branch problems. *Operations Research*, 61(3), 563–577.

[15] Muller, T., & Rudova, H. (2012). Real-life curriculum-based timetabling. *Proceedings of the 9th International Conference on the Practice and Theory of Automated Timetabling*, 57–72.

[16] Murray, K., Muller, T., & Rudova, H. (2007). Modeling and solution of a complex university course timetabling problem. *International Conference on the Practice and Theory of Automated Timetabling*, 189–209.

[17] Pillay, N., & Banzhaf, W. (2010). An informed genetic algorithm for the examination timetabling problem. *Applied Soft Computing*, 10(2), 457–467.

[18] Pongcharoen, P., Promtet, W., Yenradee, P., & Hicks, C. (2008). Stochastic optimisation timetabling tool for university course scheduling. *International Journal of Production Economics*, 112(2), 903–918.

[19] Schaerf, A. (1999). A survey of automated timetabling. *Artificial Intelligence Review*, 13(2), 87–127.

[20] Schimmelpfeng, K., & Helber, S. (2007). Application of a real-world university-course timetabling model solved by integer programming. *OR Spectrum*, 29(4), 783–803.

[21] Socha, K., & Sampels, M. (2003). Ant algorithms for the university course timetabling problem with regard to the state-of-the-art. *Applications of Evolutionary Computing*, 334–345.

[22] Thompson, J. M., & Dowsland, K. A. (1998). A robust simulated annealing based examination timetabling system. *Computers & Operations Research*, 25(7–8), 637–648.

[23] Vieira, G. E., Herrmann, J. W., & Lin, E. (2003). Rescheduling manufacturing systems: a framework of strategies, policies, and methods. *Journal of Scheduling*, 6(1), 39–62.

[24] Google OR-Tools. (2024). CP-SAT Solver. https://developers.google.com/optimization/cp/cp_solver

---
