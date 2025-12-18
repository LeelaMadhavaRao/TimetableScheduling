# Genetic Algorithm (GA) Optimizer

## Overview

The Genetic Algorithm Optimizer is the second phase of timetable generation. It takes a valid base timetable and **improves its quality** by optimizing for soft constraints like:
- Minimizing faculty idle gaps
- Balancing workload across days
- Preferring morning classes
- Keeping labs compact

**File**: `lib/ga-optimizer.ts`

## What is a Genetic Algorithm?

A Genetic Algorithm is a **metaheuristic optimization** technique inspired by natural evolution:

1. **Population**: Multiple candidate solutions (timetables)
2. **Fitness**: Measure of solution quality
3. **Selection**: Better solutions are more likely to reproduce
4. **Crossover**: Combine parts of two parents to create offspring
5. **Mutation**: Random changes to explore new solutions
6. **Generations**: Repeat for many iterations

```
┌─────────────────────────────────────────────────────────────────┐
│                   Genetic Algorithm Flow                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────┐                                               │
│   │    Start    │                                               │
│   └──────┬──────┘                                               │
│          ▼                                                       │
│   ┌─────────────────────────┐                                   │
│   │  Initialize Population  │  (50 chromosomes)                 │
│   └───────────┬─────────────┘                                   │
│               ▼                                                  │
│   ┌─────────────────────────┐                                   │
│   │   Evaluate Fitness      │  (Calculate scores)               │
│   └───────────┬─────────────┘                                   │
│               ▼                                                  │
│   ┌─────────────────────────┐     NO                            │
│   │  Generations Complete?  │────────┐                          │
│   └───────────┬─────────────┘        │                          │
│               │ YES                   │                          │
│               ▼                       │                          │
│   ┌─────────────────────────┐        │                          │
│   │   Return Best Solution  │        │                          │
│   └─────────────────────────┘        │                          │
│                                       │                          │
│               ◄──────────────────────┘                          │
│               │                                                  │
│               ▼                                                  │
│   ┌─────────────────────────┐                                   │
│   │   Selection (Elite +    │                                   │
│   │   Tournament)           │                                   │
│   └───────────┬─────────────┘                                   │
│               ▼                                                  │
│   ┌─────────────────────────┐                                   │
│   │      Crossover          │                                   │
│   └───────────┬─────────────┘                                   │
│               ▼                                                  │
│   ┌─────────────────────────┐                                   │
│   │      Mutation           │                                   │
│   └───────────┬─────────────┘                                   │
│               │                                                  │
│               └─────────► (Loop back to Evaluate Fitness)       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## GA Configuration

```typescript
// lib/timetable.ts
export const GA_CONFIG = {
  POPULATION_SIZE: 50,      // Number of candidate solutions
  GENERATIONS: 100,         // Iterations to run
  MUTATION_RATE: 0.1,       // 10% chance of mutation
  CROSSOVER_RATE: 0.8,      // 80% chance of crossover
  ELITE_PERCENTAGE: 0.1,    // Keep top 10% unchanged
  TOURNAMENT_SIZE: 5,       // Tournament selection size
}

export const FITNESS_WEIGHTS = {
  FACULTY_GAPS: 0.30,       // 30% weight
  STUDENT_GAPS: 0.25,       // 25% weight
  WORKLOAD_BALANCE: 0.20,   // 20% weight
  MORNING_PREFERENCE: 0.15, // 15% weight
  LAB_COMPACTNESS: 0.10,    // 10% weight
}
```

## Class Structure

```typescript
class GATimetableOptimizer {
  private baseSchedule: TimetableSlot[]     // Input: valid timetable
  private population: TimetableSlot[][] = [] // Population of chromosomes
  private fitnessScores: Map<number, number> // Index -> fitness score

  constructor(baseSchedule: TimetableSlot[]) {
    this.baseSchedule = baseSchedule
  }

  optimize(): { optimizedSchedule: TimetableSlot[]; finalFitness: number } {
    // Main optimization loop
  }
}
```

## Population Initialization

```typescript
private initializePopulation(): void {
  // First chromosome is the original base schedule
  this.population.push([...this.baseSchedule])

  // Generate variations through random swaps
  for (let i = 1; i < GA_CONFIG.POPULATION_SIZE; i++) {
    const chromosome = [...this.baseSchedule]

    // Apply random mutations to create diversity
    const mutationCount = Math.floor(chromosome.length * 0.1)  // 10% of slots
    for (let j = 0; j < mutationCount; j++) {
      this.applyRandomSwap(chromosome)
    }

    this.population.push(chromosome)
  }
}
```

## Fitness Function

The fitness function evaluates how "good" a timetable is. Higher is better.

```typescript
private calculateFitness(schedule: TimetableSlot[]): number {
  let totalFitness = 0

  // 1. Faculty gaps penalty (30%)
  const facultyGapPenalty = this.calculateFacultyGaps(schedule)
  totalFitness += (1 - facultyGapPenalty) * FITNESS_WEIGHTS.FACULTY_GAPS

  // 2. Student gaps penalty (25%)
  const studentGapPenalty = this.calculateStudentGaps(schedule)
  totalFitness += (1 - studentGapPenalty) * FITNESS_WEIGHTS.STUDENT_GAPS

  // 3. Workload balance (20%)
  const workloadBalance = this.calculateWorkloadBalance(schedule)
  totalFitness += workloadBalance * FITNESS_WEIGHTS.WORKLOAD_BALANCE

  // 4. Morning preference (15%)
  const morningPreference = this.calculateMorningPreference(schedule)
  totalFitness += morningPreference * FITNESS_WEIGHTS.MORNING_PREFERENCE

  // 5. Lab compactness (10%)
  const labCompactness = this.calculateLabCompactness(schedule)
  totalFitness += labCompactness * FITNESS_WEIGHTS.LAB_COMPACTNESS

  return totalFitness  // Range: 0 to 1
}
```

### Component 1: Faculty Gaps

Measures idle periods between classes for faculty:

```typescript
private calculateFacultyGaps(schedule: TimetableSlot[]): number {
  const facultySchedules = new Map<string, Map<number, number[]>>()

  // Group by faculty and day
  for (const slot of schedule) {
    if (!facultySchedules.has(slot.facultyId)) {
      facultySchedules.set(slot.facultyId, new Map())
    }
    const daySchedule = facultySchedules.get(slot.facultyId)!
    if (!daySchedule.has(slot.day)) {
      daySchedule.set(slot.day, [])
    }

    // Add all periods in this slot
    for (let p = slot.startPeriod; p <= slot.endPeriod; p++) {
      daySchedule.get(slot.day)!.push(p)
    }
  }

  let totalGaps = 0
  let totalDays = 0

  for (const daySchedule of facultySchedules.values()) {
    for (const periods of daySchedule.values()) {
      if (periods.length > 0) {
        periods.sort((a, b) => a - b)
        const minPeriod = periods[0]
        const maxPeriod = periods[periods.length - 1]
        const expectedPeriods = maxPeriod - minPeriod + 1
        const gaps = expectedPeriods - periods.length  // Missing periods = gaps
        totalGaps += gaps
        totalDays++
      }
    }
  }

  return totalDays > 0 ? totalGaps / totalDays / 8 : 0  // Normalized
}
```

**Example:**
- Faculty teaches: Period 1, 2, 5, 6
- Min=1, Max=6, Expected=6 periods
- Actual=4 periods, Gaps=2 (periods 3 and 4 are idle)

### Component 2: Student Gaps

Same logic as faculty gaps, but for sections:

```typescript
private calculateStudentGaps(schedule: TimetableSlot[]): number {
  // Same as faculty gaps, but grouped by sectionId
  // Measures idle periods between classes for students
}
```

### Component 3: Workload Balance

Measures variance in daily teaching load:

```typescript
private calculateWorkloadBalance(schedule: TimetableSlot[]): number {
  const facultyDailyLoad = new Map<string, number[]>()

  for (const slot of schedule) {
    if (!facultyDailyLoad.has(slot.facultyId)) {
      facultyDailyLoad.set(slot.facultyId, [0, 0, 0, 0, 0, 0])  // 6 days
    }
    const periods = slot.endPeriod - slot.startPeriod + 1
    facultyDailyLoad.get(slot.facultyId)![slot.day] += periods
  }

  let totalVariance = 0
  let facultyCount = 0

  for (const dailyLoads of facultyDailyLoad.values()) {
    const mean = dailyLoads.reduce((a, b) => a + b, 0) / dailyLoads.length
    const variance = dailyLoads.reduce(
      (sum, load) => sum + Math.pow(load - mean, 2), 0
    ) / dailyLoads.length
    totalVariance += variance
    facultyCount++
  }

  const avgVariance = facultyCount > 0 ? totalVariance / facultyCount : 0
  return Math.max(0, 1 - avgVariance / 16)  // Normalized (16 = max variance)
}
```

**Example:**
- Faculty daily periods: [4, 4, 4, 4, 4, 0]
- Mean = 3.33, Variance = 2.22
- Lower variance = higher balance score

### Component 4: Morning Preference

Prefers classes scheduled in the morning:

```typescript
private calculateMorningPreference(schedule: TimetableSlot[]): number {
  let morningSlots = 0
  let totalSlots = 0

  for (const slot of schedule) {
    const periods = slot.endPeriod - slot.startPeriod + 1
    if (slot.startPeriod <= 4) {  // Periods 1-4 are morning
      morningSlots += periods
    }
    totalSlots += periods
  }

  return totalSlots > 0 ? morningSlots / totalSlots : 0
}
```

### Component 5: Lab Compactness

Prefers labs scheduled early in the week:

```typescript
private calculateLabCompactness(schedule: TimetableSlot[]): number {
  // Labs are 4-period slots
  const labSlots = schedule.filter((s) => 
    s.endPeriod - s.startPeriod + 1 === 4
  )

  if (labSlots.length === 0) return 1

  let compactnessScore = 0
  for (const slot of labSlots) {
    // Prefer earlier days (Monday = 0, Saturday = 5)
    compactnessScore += (5 - slot.day) / 5
  }

  return compactnessScore / labSlots.length
}
```

## Selection: Tournament

```typescript
private tournamentSelection(): TimetableSlot[] {
  const tournament: number[] = []

  // Pick TOURNAMENT_SIZE random individuals
  for (let i = 0; i < GA_CONFIG.TOURNAMENT_SIZE; i++) {
    const randomIndex = Math.floor(Math.random() * this.population.length)
    tournament.push(randomIndex)
  }

  // Find the best among them
  let bestIndex = tournament[0]
  let bestFitness = this.fitnessScores.get(bestIndex) || Number.NEGATIVE_INFINITY

  for (const index of tournament) {
    const fitness = this.fitnessScores.get(index) || Number.NEGATIVE_INFINITY
    if (fitness > bestFitness) {
      bestFitness = fitness
      bestIndex = index
    }
  }

  return [...this.population[bestIndex]]  // Return copy
}
```

## Crossover

Combines two parent schedules:

```typescript
private crossover(parent1: TimetableSlot[], parent2: TimetableSlot[]): TimetableSlot[] {
  // Skip crossover with probability
  if (Math.random() > GA_CONFIG.CROSSOVER_RATE) {
    return [...parent1]
  }

  const offspring = [...parent1]
  const crossoverPoint = Math.floor(Math.random() * parent1.length)

  // Copy slots from parent2 after crossover point
  for (let i = crossoverPoint; i < parent1.length; i++) {
    // Find corresponding slot in parent2 (same section and subject)
    const matchingSlot = parent2.find(
      (s) => s.sectionId === parent1[i].sectionId && 
             s.subjectId === parent1[i].subjectId
    )

    if (matchingSlot && this.isValidSwap(offspring, i, matchingSlot)) {
      offspring[i] = { ...matchingSlot }
    }
  }

  return offspring
}
```

## Mutation

Random time slot changes:

```typescript
private mutate(chromosome: TimetableSlot[]): TimetableSlot[] {
  const mutated = [...chromosome]

  if (Math.random() < GA_CONFIG.MUTATION_RATE) {
    this.applyRandomSwap(mutated)
  }

  return mutated
}

private applyRandomSwap(chromosome: TimetableSlot[]): void {
  const attempts = 10
  for (let attempt = 0; attempt < attempts; attempt++) {
    const index = Math.floor(Math.random() * chromosome.length)
    const slot = chromosome[index]

    // Try to move to a different time
    const newDay = Math.floor(Math.random() * 6) as DayOfWeek
    const maxPeriod = newDay === 5 ? 4 : 8  // Saturday half-day
    const periodRange = slot.endPeriod - slot.startPeriod
    const newStartPeriod = Math.floor(Math.random() * (maxPeriod - periodRange + 1)) + 1

    const newSlot: TimetableSlot = {
      ...slot,
      day: newDay,
      startPeriod: newStartPeriod,
      endPeriod: newStartPeriod + periodRange,
    }

    if (this.isValidSwap(chromosome, index, newSlot)) {
      chromosome[index] = newSlot
      break
    }
  }
}
```

## Validity Check

Ensures swapped slots don't create conflicts:

```typescript
private isValidSwap(chromosome: TimetableSlot[], index: number, newSlot: TimetableSlot): boolean {
  for (let i = 0; i < chromosome.length; i++) {
    if (i === index) continue

    const otherSlot = chromosome[i]

    // Check same day
    if (otherSlot.day !== newSlot.day) continue

    // Check period overlap
    const overlap =
      (newSlot.startPeriod >= otherSlot.startPeriod && 
       newSlot.startPeriod <= otherSlot.endPeriod) ||
      (newSlot.endPeriod >= otherSlot.startPeriod && 
       newSlot.endPeriod <= otherSlot.endPeriod) ||
      (otherSlot.startPeriod >= newSlot.startPeriod && 
       otherSlot.startPeriod <= newSlot.endPeriod)

    if (overlap) {
      // Check for conflicts
      if (
        otherSlot.facultyId === newSlot.facultyId ||    // Same faculty
        otherSlot.classroomId === newSlot.classroomId || // Same room
        otherSlot.sectionId === newSlot.sectionId        // Same section
      ) {
        return false  // Conflict!
      }
    }
  }

  return true  // No conflicts
}
```

## Main Optimization Loop

```typescript
optimize(): { optimizedSchedule: TimetableSlot[]; finalFitness: number } {
  this.initializePopulation()

  let bestFitness = Number.NEGATIVE_INFINITY
  let bestSchedule: TimetableSlot[] = []

  for (let generation = 0; generation < GA_CONFIG.GENERATIONS; generation++) {
    // 1. Evaluate fitness for all chromosomes
    for (let i = 0; i < this.population.length; i++) {
      const fitness = this.calculateFitness(this.population[i])
      this.fitnessScores.set(i, fitness)

      if (fitness > bestFitness) {
        bestFitness = fitness
        bestSchedule = [...this.population[i]]
      }
    }

    if (generation % 10 === 0) {
      console.log(`Generation ${generation}: Best Fitness = ${bestFitness.toFixed(4)}`)
    }

    // 2. Create next generation
    const newPopulation: TimetableSlot[][] = []

    // 2a. Elitism: Keep top performers
    const eliteCount = Math.floor(this.population.length * GA_CONFIG.ELITE_PERCENTAGE)
    const sortedIndices = Array.from(this.fitnessScores.entries())
      .sort((a, b) => b[1] - a[1])  // Descending by fitness
      .map((entry) => entry[0])

    for (let i = 0; i < eliteCount; i++) {
      newPopulation.push([...this.population[sortedIndices[i]]])
    }

    // 2b. Generate offspring
    while (newPopulation.length < GA_CONFIG.POPULATION_SIZE) {
      const parent1 = this.tournamentSelection()
      const parent2 = this.tournamentSelection()

      let offspring = this.crossover(parent1, parent2)
      offspring = this.mutate(offspring)

      newPopulation.push(offspring)
    }

    this.population = newPopulation
  }

  return {
    optimizedSchedule: bestSchedule,
    finalFitness: bestFitness,
  }
}
```

## API Integration

**File**: `app/api/timetable/optimize/route.ts`

```typescript
export async function POST(request: Request) {
  const { jobId, adminId } = await request.json()

  // Fetch base timetable
  const { data: baseSlots } = await supabase
    .from("timetable_base")
    .select("*")
    .eq("job_id", jobId)

  // Transform to TimetableSlot format
  const timetableSlots: TimetableSlot[] = baseSlots.map((slot) => ({
    sectionId: slot.section_id,
    subjectId: slot.subject_id,
    facultyId: slot.faculty_id,
    classroomId: slot.classroom_id,
    day: slot.day_of_week,
    startPeriod: slot.start_period,
    endPeriod: slot.end_period,
  }))

  // Run GA optimization
  const optimizer = new GATimetableOptimizer(timetableSlots)
  const { optimizedSchedule, finalFitness } = optimizer.optimize()

  // Save optimized schedule
  const optimizedSlots = optimizedSchedule.map((slot) => ({
    job_id: jobId,
    section_id: slot.sectionId,
    ...
    fitness_score: finalFitness,
    created_by: adminId
  }))

  await supabase.from("timetable_optimized").insert(optimizedSlots)
}
```

## Example Output

```
[GA] Starting optimization
[GA] Configuration: {POPULATION_SIZE: 50, GENERATIONS: 100, ...}
[GA] Initializing population with 50 chromosomes
Generation 0: Best Fitness = 0.6234
Generation 10: Best Fitness = 0.7123
Generation 20: Best Fitness = 0.7589
Generation 30: Best Fitness = 0.7834
Generation 40: Best Fitness = 0.8012
Generation 50: Best Fitness = 0.8156
Generation 60: Best Fitness = 0.8234
Generation 70: Best Fitness = 0.8289
Generation 80: Best Fitness = 0.8345
Generation 90: Best Fitness = 0.8378
[GA] Optimization complete. Final fitness: 0.8423
```

## Convergence Pattern

```
Fitness
  │
1.0├                          ●●●●●●●●●●●●●●●●
   │                    ●●●●●●
   │               ●●●●●
   │           ●●●●
0.5├       ●●●
   │     ●●
   │   ●●
   │  ●
   │ ●
0.0├●
   └──┬───┬───┬───┬───┬───┬───┬───┬───┬───┬──
     0  10  20  30  40  50  60  70  80  90  100
                    Generation
```

The fitness typically improves rapidly in early generations then converges to a local optimum.
