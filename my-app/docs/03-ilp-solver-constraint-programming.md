# ILP Solver & Constraint Programming

## Overview

The ILP (Integer Linear Programming) solver is an **external service** running OR-Tools CP-SAT (Constraint Programming with SAT solving) on Render.com. It handles complex scheduling problems that greedy algorithms struggle with, particularly:

1. **Lab Scheduling**: 3 consecutive period blocks with room/faculty constraints
2. **Theory Scheduling Fallback**: When greedy achieves <80% success rate
3. **Optimization Phase**: Later phase for quality improvement

## External Solver Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              Supabase Edge Function (generate-base-timetable)                │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  HTTP POST Request                                                      │ │
│  │  URL: https://timetablescheduling.onrender.com/solve-labs              │ │
│  │  Content-Type: application/json                                         │ │
│  │  Timeout: 60 seconds                                                    │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    OR-Tools CP-SAT Solver (Render.com)                       │
│                                                                              │
│  ┌─────────────────────┐    ┌────────────────────────────────────────────┐ │
│  │   VARIABLES         │    │   CONSTRAINTS                              │ │
│  │   ───────────       │    │   ───────────                              │ │
│  │   x[c,r,d,p] ∈ {0,1}│    │   • One room per time slot                 │ │
│  │                     │    │   • One section per time slot              │ │
│  │   c = course        │    │   • One faculty per time slot              │ │
│  │   r = room          │    │   • 3 consecutive periods for labs         │ │
│  │   d = day (0-5)     │    │   • Faculty availability windows           │ │
│  │   p = period (1-8)  │    │   • Room capacity >= student count         │ │
│  └─────────────────────┘    └────────────────────────────────────────────┘ │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │   SOLVER CONFIGURATION                                                  │ │
│  │   • max_time_in_seconds: 30                                             │ │
│  │   • num_search_workers: 4                                               │ │
│  │   • log_search_progress: true                                           │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Lab Scheduling with ILP

### Request Payload

```typescript
interface SolveLabsRequest {
  courses: Array<{
    sectionId: string
    sectionName: string
    subjectId: string
    subjectCode: string
    facultyId: string
    facultyCode: string
    studentCount: number
    yearLevel: number
  }>
  rooms: Array<{
    id: string
    roomCode: string
    capacity: number
    roomType: "lab"
  }>
  facultyAvailability: Array<{
    facultyId: string
    dayOfWeek: number
    startPeriod: number
    endPeriod: number
  }>
  rules: {
    labPeriods: 3         // Consecutive periods required
    daysPerWeek: 6        // Monday-Saturday
    periodsPerDay: 8
  }
}
```

### ILP Model for Labs

#### Decision Variables

For each lab course `c`, room `r`, day `d`, and starting period `p`:
```
x[c,r,d,p] ∈ {0,1}
```
Where `x[c,r,d,p] = 1` means course `c` is scheduled in room `r` on day `d` starting at period `p`.

#### Hard Constraints

**1. Each lab scheduled exactly once:**
```
∑(r,d,p) x[c,r,d,p] = 1    ∀ course c
```

**2. Room conflict prevention:**
```
∑(c) x[c,r,d,p] + x[c,r,d,p+1] + x[c,r,d,p+2] ≤ 1    ∀ r,d,p
```

**3. Faculty conflict prevention:**
```
For faculty f with courses C_f:
∑(c∈C_f,r) x[c,r,d,p] ≤ 1    ∀ d,p
```

**4. Section conflict prevention:**
```
For section s with courses C_s:
∑(c∈C_s,r) x[c,r,d,p] ≤ 1    ∀ d,p
```

**5. Faculty availability:**
```
x[c,r,d,p] = 0    if faculty of c not available at (d,p), (d,p+1), or (d,p+2)
```

**6. Room capacity:**
```
x[c,r,d,p] = 0    if capacity(r) < studentCount(c)
```

**7. No lunch crossing (periods 4-5):**
```
x[c,r,d,p] = 0    if p = 3 or p = 4    (would span lunch)
```

**8. Lab room type:**
```
x[c,r,d,p] = 0    if roomType(r) ≠ "lab"
```

### Valid Lab Starting Periods

Labs require 3 consecutive periods without crossing lunch:
```
Valid starting periods: [1, 2, 5, 6]
Period 1-3: Morning block (7:45-10:15)
Period 2-4: Extended morning (8:30-11:00)
Period 5-7: Afternoon block (12:15-14:45)
Period 6-8: Late afternoon (13:00-15:30)
```

### Response Format

```typescript
interface SolveLabsResponse {
  success: boolean
  status: "OPTIMAL" | "FEASIBLE" | "INFEASIBLE" | "MODEL_INVALID"
  message: string
  assignments: Array<{
    sectionId: string
    subjectId: string
    facultyId: string
    classroomId: string
    day: number
    startPeriod: number
    endPeriod: number
  }>
  stats: {
    solveTimeMs: number
    numVariables: number
    numConstraints: number
  }
}
```

## Theory Scheduling with ILP

### When ILP is Used for Theory

The edge function uses ILP for theory scheduling only as a **fallback**:

```typescript
// Phase 2A: Try enhanced greedy first (15 attempts)
const greedyResult = await this.scheduleTheoryWithGreedy(theoryCourses)

// Phase 2B: If greedy < 80% success, try ILP
if (greedyResult.successRate < 0.8) {
  const ilpResult = await this.scheduleTheoryWithILP(theoryCourses)
}
```

### Theory ILP Constraints

Theory scheduling has different constraints than labs:

**1. Two-period blocks (not 3):**
```
x[c,r,d,p] + x[c,r,d,p+1] = 2 × assigned[c,r,d,p]
```

**2. Maximum 2 periods per subject per day:**
```
∑(r,p) periodsAt(c,r,d,p) ≤ 2    ∀ course c, day d
```

**3. Maximum 6 total periods per section per day:**
```
For section s:
∑(c∈C_s,r,p) periodsAt(c,r,d,p) ≤ 6    ∀ d
```

**4. Theory room type:**
```
x[c,r,d,p] = 0    if roomType(r) ≠ "theory"
```

## Period Reduction Fallback

If both greedy and ILP fail to achieve acceptable coverage, period reduction is applied:

```typescript
private applyTheoryPeriodReductionFallback(
  unscheduledCourses: CourseAssignment[],
  theoryRooms: Classroom[]
): CourseAssignment[] {
  // Reduce 4-period courses to 3 periods
  // Reduce 3-period courses to 2 periods
  // Retry scheduling with reduced requirements
  
  for (const course of unscheduledCourses) {
    if (course.periodsPerWeek === 4) {
      course.periodsPerWeek = 3
    } else if (course.periodsPerWeek === 3) {
      course.periodsPerWeek = 2
    }
  }
  
  return unscheduledCourses
}
```

## Solver Configuration

### OR-Tools CP-SAT Parameters

```python
# In the external solver (Python on Render.com)
from ortools.sat.python import cp_model

model = cp_model.CpModel()
solver = cp_model.CpSolver()

# Configuration
solver.parameters.max_time_in_seconds = 30.0
solver.parameters.num_search_workers = 4
solver.parameters.log_search_progress = True

# Search strategy
model.AddDecisionStrategy(
    variables,
    cp_model.CHOOSE_FIRST,  # Variable selection
    cp_model.SELECT_MIN_VALUE  # Value selection
)
```

### Optimization Hints

The solver accepts warm-start hints from previous solutions:

```python
# If previous feasible solution exists
for var, value in previous_solution.items():
    model.AddHint(var, value)
```

## Integration with Edge Function

### Calling the External Solver

```typescript
private async scheduleLabsWithExternalSolver(
  labCourses: CourseAssignment[]
): Promise<number> {
  const response = await fetch(`${ILP_SOLVER_URL}/solve-labs`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "X-Request-Timeout": "60000"  // 60 second timeout
    },
    body: JSON.stringify({
      courses: this.formatCoursesForSolver(labCourses),
      rooms: this.formatRoomsForSolver("lab"),
      facultyAvailability: this.formatAvailabilityForSolver(),
      rules: {
        labPeriods: RULES.LAB_PERIODS,
        daysPerWeek: 6,
        periodsPerDay: 8
      }
    })
  })

  if (!response.ok) {
    console.error(`ILP solver error: ${response.status}`)
    return this.scheduleLabsLocally(labCourses)  // Fallback to greedy
  }

  const result = await response.json()
  return this.applyILPSolution(result.assignments)
}
```

### Applying ILP Solution

```typescript
private applyILPSolution(assignments: ILPAssignment[]): number {
  let periodsScheduled = 0
  
  for (const assign of assignments) {
    // Validate assignment doesn't conflict with existing schedule
    if (this.validateAssignment(assign)) {
      this.addSlot(
        this.findCourse(assign.sectionId, assign.subjectId),
        assign.day,
        assign.startPeriod,
        assign.endPeriod,
        assign.classroomId
      )
      periodsScheduled += assign.endPeriod - assign.startPeriod + 1
    }
  }
  
  return periodsScheduled
}
```

## Error Handling

### Infeasible Solutions

```typescript
if (result.status === "INFEASIBLE") {
  console.warn("ILP found no feasible solution - constraints too tight")
  
  // Analyze which constraints are problematic
  const analysis = this.analyzeInfeasibility(labCourses)
  
  // Try relaxing constraints
  if (analysis.roomCapacityIssue) {
    // Allow smaller rooms with standing room
  }
  if (analysis.facultyAvailabilityIssue) {
    // Check if faculty availability can be expanded
  }
  
  // Fallback to greedy with constraint relaxation
  return this.scheduleLabsLocally(labCourses, { relaxed: true })
}
```

### Timeout Handling

```typescript
if (result.status === "TIME_LIMIT") {
  // Solver found partial solution within time limit
  if (result.assignments && result.assignments.length > 0) {
    console.log(`ILP partial solution: ${result.assignments.length} assignments`)
    return this.applyILPSolution(result.assignments)
  }
  
  // No solution found - fallback to greedy
  return this.scheduleLabsLocally(labCourses)
}
```

## Performance Characteristics

### Complexity

| Problem Size | Variables | Constraints | Typical Solve Time |
|-------------|-----------|-------------|-------------------|
| 10 labs, 5 rooms | ~300 | ~500 | <1 second |
| 30 labs, 10 rooms | ~2,400 | ~3,000 | 2-5 seconds |
| 50 labs, 15 rooms | ~6,000 | ~8,000 | 10-20 seconds |
| 100 labs, 20 rooms | ~16,000 | ~20,000 | 30+ seconds |

### Memory Usage

```
Variables: O(courses × rooms × days × periods)
Constraints: O(courses² + rooms × days × periods)
Typical memory: 50-200 MB for college-scale problems
```

## Debugging ILP Issues

### Common Problems

**1. All Labs Same Day:**
Add symmetry breaking constraint:
```python
# Force course order to prevent equivalent solutions
for i in range(len(courses) - 1):
    model.Add(
        day[courses[i]] * 100 + period[courses[i]] <=
        day[courses[i+1]] * 100 + period[courses[i+1]]
    )
```

**2. Faculty Overloaded:**
Check faculty availability calculation:
```typescript
// Ensure availability accounts for existing assignments
const existingLoad = this.getFacultyExistingLoad(facultyId)
const availableSlots = declaredAvailability - existingLoad
```

**3. Room Not Found:**
Validate room-course compatibility:
```typescript
const compatibleRooms = rooms.filter(r => 
  r.roomType === courseType &&
  r.capacity >= studentCount
)
if (compatibleRooms.length === 0) {
  console.error(`No compatible rooms for course ${courseId}`)
}
```

## API Endpoints

### Render.com Solver Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/solve-labs` | POST | Schedule lab courses |
| `/solve-theory` | POST | Schedule theory courses (fallback) |
| `/health` | GET | Health check |
| `/stats` | GET | Solver statistics |

### Health Check

```typescript
const health = await fetch(`${ILP_SOLVER_URL}/health`)
// Response: { status: "healthy", version: "1.0.0", uptime: 3600 }
```

## Future Improvements

1. **Parallel Solving**: Use multiple solver instances for different sections
2. **Warm Starting**: Use previous week's schedule as hints
3. **Objective Function**: Add soft constraints for preferences (morning classes, etc.)
4. **Incremental Solving**: Handle schedule modifications without full re-solve
