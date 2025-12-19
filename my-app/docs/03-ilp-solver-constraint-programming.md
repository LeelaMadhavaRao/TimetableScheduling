# ILP Solver - Constraint Programming with OR-Tools

## Overview

The ILP (Integer Linear Programming) Solver is a Python microservice that uses Google OR-Tools CP-SAT (Constraint Programming - Satisfiability) solver for optimal lab scheduling. It handles the **hard constraint satisfaction** problem mathematically and provides detailed diagnostics for infeasible schedules.

**File**: `ilp-solver/app.py`
**Deployment**: `https://timetablescheduling.onrender.com` (Render.com)
**Technology**: FastAPI + OR-Tools CP-SAT + Python 3.11

## Key Updates

- **Enhanced Diagnostics**: Detailed logging shows why labs cannot be scheduled (room capacity, faculty availability, etc.)
- **Capacity Relaxation**: 85% minimum capacity matching to handle room shortages
- **Infeasibility Detection**: Pre-constraint validation catches unsolvable problems early
- **Theory Endpoint**: New `/solve-theory` endpoint for fallback theory scheduling

## Why OR-Tools CP-SAT?

CP-SAT is a **constraint programming solver** that:
- Handles boolean decision variables efficiently
- Guarantees finding a solution if one exists (OPTIMAL or FEASIBLE)
- Can optimize for objectives (minimize capacity waste)
- Scales well for timetabling problems (60-second timeout)
- Provides clear status: OPTIMAL, FEASIBLE, INFEASIBLE, or UNKNOWN

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    FastAPI Application                          │
│  ┌───────────────┐  ┌────────────────┐  ┌──────────────────┐   │
│  │  Health Check │  │   /solve-labs  │  │  /solve-theory   │   │
│  │    GET /      │  │  POST endpoint │  │  POST endpoint   │   │
│  └───────────────┘  └───────┬────────┘  └────────┬─────────┘   │
│                             │                     │              │
│                             ▼                     ▼              │
│              ┌──────────────────────────────────────────────┐   │
│              │           OR-Tools CP-SAT Solver              │   │
│              │  • Decision Variables                        │   │
│              │  • Constraints                               │   │
│              │  • Objective Function                        │   │
│              └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Data Models

### Input Models

```python
class Course(BaseModel):
    sectionId: str       # UUID of the section
    sectionName: str     # e.g., "CSE-2A"
    subjectId: str       # UUID of the subject
    subjectCode: str     # e.g., "CS201L"
    facultyId: str       # UUID of the faculty
    facultyCode: str     # e.g., "CSE001"
    studentCount: int    # Number of students
    yearLevel: int       # 1-4

class Room(BaseModel):
    id: str
    name: str
    capacity: int

class AvailabilitySlot(BaseModel):
    dayOfWeek: int       # 0=Mon, 5=Sat
    startPeriod: int     # 1-8
    endPeriod: int       # 1-8

class FacultyAvailability(BaseModel):
    facultyId: str
    slots: List[AvailabilitySlot]

class Rules(BaseModel):
    labPeriods: int      # 4 (consecutive)
    daysPerWeek: int     # 6
    periodsPerDay: int   # 8
```

### Output Model

```python
class Assignment(BaseModel):
    sectionId: str
    subjectId: str
    day: int            # 0-5
    startPeriod: int    # 1-8
    endPeriod: int      # 1-8
    roomId: str

class SolutionResponse(BaseModel):
    success: bool
    status: str         # "OPTIMAL", "FEASIBLE", "INFEASIBLE"
    message: str
    assignments: List[Assignment]
    solveTimeMs: int
```

## Lab Scheduling Endpoint: `/solve-labs`

### Decision Variables

Labs are scheduled in **blocks** (Morning or Afternoon, each 4 periods):

```python
# Block definitions
blocks = ["M", "A"]  # Morning, Afternoon
block_periods = {
    "M": [1, 2, 3, 4],    # Morning block
    "A": [5, 6, 7, 8],    # Afternoon block
}

# Decision variable: L[course_idx][day][block][room_idx]
# Binary: 1 if lab assigned to (day, block, room), 0 otherwise
L = {}
for c_idx, course in enumerate(courses):
    for day in days:
        for block in blocks:
            for r_idx, room in enumerate(rooms):
                var_name = f"L_{c_idx}_{day}_{block}_{r_idx}"
                L[(c_idx, day, block, r_idx)] = model.NewBoolVar(var_name)
```

### Variable Filtering (Pre-constraint Pruning)

Before creating variables, invalid combinations are filtered out:

```python
for c_idx, course in enumerate(courses):
    for day in days:
        for block in blocks:
            # Filter 1: Saturday afternoon only for Year 1
            if day == 5 and block == "A" and course.yearLevel != 1:
                continue
            
            # Filter 2: Faculty availability
            faculty_avail = faculty_avail_map.get(course.facultyId, "all")
            if faculty_avail != "all":
                periods_in_block = block_periods[block]
                if not all((day, p) in faculty_avail for p in periods_in_block):
                    continue  # Faculty not available
            
            # Filter 3: Room capacity (85% rule)
            for r_idx, room in enumerate(rooms):
                min_acceptable = int(course.studentCount * 0.85)
                if room.capacity < min_acceptable:
                    continue
                
                # Only create variable if all filters pass
                L[(c_idx, day, block, r_idx)] = model.NewBoolVar(...)
```

### Constraints

#### Constraint 1: Each Lab Scheduled Exactly Once (HARD)

**CRITICAL**: This is a HARD constraint. If any lab cannot be scheduled, the entire problem is INFEASIBLE.

```python
for c_idx, course in enumerate(courses):
    course_vars = [
        L[(c_idx, day, block, r_idx)]
        for (c, day, block, r_idx) in valid_assignments
        if c == c_idx
    ]
    
    if course_vars:
        # EXACTLY one assignment per lab (HARD REQUIREMENT)
        model.Add(sum(course_vars) == 1)
    else:
        # NO VALID SLOT EXISTS - DIAGNOSE WHY
        suitable_rooms = [r for r in rooms if r.capacity >= int(course.studentCount * 0.85)]
        faculty_avail = faculty_avail_map.get(course.facultyId, "all")
        
        # Detailed error analysis
        blocking_reasons = []
        if len(suitable_rooms) == 0:
            blocking_reasons.append(f"No rooms with capacity >= {int(course.studentCount * 0.85)}")
        
        if faculty_avail != "all":
            faculty_info = next((fa for fa in data.facultyAvailability if fa.facultyId == course.facultyId), None)
            if not faculty_info or len(faculty_info.slots) == 0:
                blocking_reasons.append(f"Faculty {course.facultyCode} has NO availability windows")
            else:
                # Check if faculty slots allow 4-period blocks
                valid_blocks = []
                for slot in faculty_info.slots:
                    for start_p in range(slot.startPeriod, slot.endPeriod - 3 + 1):
                        valid_blocks.append((slot.dayOfWeek, start_p))
                if len(valid_blocks) == 0:
                    blocking_reasons.append(f"Faculty windows don't allow 4-period blocks")
        
        # FAIL HARD with detailed diagnosis
        raise ValueError(
            f"INFEASIBLE: Cannot schedule lab {course.subjectCode} ({course.sectionName})\n"
            f"Blocking reasons: {' | '.join(blocking_reasons)}\n"
            f"Suitable rooms: {len(suitable_rooms)}, Faculty windows: {len(faculty_info.slots) if faculty_info else 0}"
        )
```

**Diagnostic Output Example**:
```
[Solver] Lab 0: CS201L (CSE-2A, 60 students)
[Solver]   Faculty: CSE-F004
[Solver]   Valid assignments: 0
[Solver]   ❌ NO VALID ASSIGNMENTS FOUND
[Solver]   Suitable rooms (>=85% capacity): 2
[Solver]   Rooms list: LAB-101(65), LAB-102(70)
[Solver]   Faculty availability windows: 1
[Solver]   Faculty slots detail: [(0, 1, 8)]  # Monday 1-8
[Solver]   Possible 4-period blocks for faculty: 5
```

#### Constraint 2: Room Non-Overlap

No two labs can use the same room at the same period:

```python
for r_idx in range(len(rooms)):
    for day in days:
        for period in range(1, periods_per_day + 1):
            # Find all variables using this room at this period
            period_vars = []
            for (c_idx, d, block, r) in valid_assignments:
                if r == r_idx and d == day:
                    if period in block_periods[block]:
                        period_vars.append(L[(c_idx, d, block, r)])
            
            if period_vars:
                model.Add(sum(period_vars) <= 1)  # At most one
```

#### Constraint 3: Section Non-Overlap

Students can't be in two places at once:

```python
# Group courses by section
section_to_courses = {}
for c_idx, course in enumerate(courses):
    if course.sectionId not in section_to_courses:
        section_to_courses[course.sectionId] = []
    section_to_courses[course.sectionId].append(c_idx)

for section_id, course_indices in section_to_courses.items():
    for day in days:
        for period in range(1, periods_per_day + 1):
            period_vars = []
            for c_idx in course_indices:
                for (c, d, block, r_idx) in valid_assignments:
                    if c == c_idx and d == day:
                        if period in block_periods[block]:
                            period_vars.append(L[(c, d, block, r_idx)])
            
            if period_vars:
                model.Add(sum(period_vars) <= 1)
```

#### Constraint 4: Faculty Non-Overlap

Faculty can't teach multiple classes simultaneously:

```python
faculty_to_courses = {}
for c_idx, course in enumerate(courses):
    if course.facultyId not in faculty_to_courses:
        faculty_to_courses[course.facultyId] = []
    faculty_to_courses[course.facultyId].append(c_idx)

for faculty_id, course_indices in faculty_to_courses.items():
    for day in days:
        for period in range(1, periods_per_day + 1):
            period_vars = []
            for c_idx in course_indices:
                for (c, d, block, r_idx) in valid_assignments:
                    if c == c_idx and d == day:
                        if period in block_periods[block]:
                            period_vars.append(L[(c, d, block, r_idx)])
            
            if period_vars:
                model.Add(sum(period_vars) <= 1)
```

### Objective Function

Minimize wasted room capacity (prefer exact matches):

```python
capacity_penalties = []
for (c_idx, day, block, r_idx) in valid_assignments:
    course = courses[c_idx]
    room = rooms[r_idx]
    # Penalty = excess capacity
    penalty = max(0, room.capacity - course.studentCount)
    capacity_penalties.append(penalty * L[(c_idx, day, block, r_idx)])

if capacity_penalties:
    model.Minimize(sum(capacity_penalties))
```

### Solving

```python
solver = cp_model.CpSolver()
solver.parameters.max_time_in_seconds = 60.0  # Timeout
solver.parameters.log_search_progress = False

status = solver.Solve(model)

if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
    # Extract solution
    assignments = []
    for (c_idx, day, block, r_idx) in valid_assignments:
        if solver.Value(L[(c_idx, day, block, r_idx)]) == 1:
            course = courses[c_idx]
            room = rooms[r_idx]
            periods = block_periods[block]
            
            assignments.append(Assignment(
                sectionId=course.sectionId,
                subjectId=course.subjectId,
                day=day,
                startPeriod=periods[0],
                endPeriod=periods[-1],
                roomId=room.id
            ))

elif status == cp_model.INFEASIBLE:
    # No solution exists
    return SolutionResponse(success=False, status="INFEASIBLE", ...)
```

## Theory Scheduling Endpoint: `/solve-theory`

Theory scheduling is more complex:
- Variable periods per course (1-4 per week)
- Smaller block sizes (1-3 periods)
- Must avoid existing lab assignments
- Maximum periods per day per section

### Additional Constraints

```python
# Input includes existing lab assignments
class TheoryProblemData(BaseModel):
    courses: List[TheoryCourse]
    rooms: List[Room]
    facultyAvailability: List[FacultyAvailability]
    existingAssignments: List[ExistingAssignment]  # Labs
    rules: TheoryRules

# Track existing assignments
existing_faculty = {}   # facultyId -> Set of "day-period"
existing_room = {}      # roomId -> Set of "day-period"
existing_section = {}   # sectionId -> Set of "day-period"

for assign in data.existingAssignments:
    for p in range(assign.startPeriod, assign.endPeriod + 1):
        key = f"{assign.day}-{p}"
        existing_faculty[assign.facultyId].add(key)
        existing_room[assign.roomId].add(key)
        existing_section[assign.sectionId].add(key)
```

## Diagnostic Output

The solver provides detailed logging for debugging:

```python
print(f"[Solver] Lab {c_idx}: {course.subjectCode} ({course.sectionName})")
print(f"[Solver]   Faculty: {course.facultyCode}")
print(f"[Solver]   Student Count: {course.studentCount}")
print(f"[Solver]   Valid assignments: {len(course_vars)}")

# If no valid assignments:
print(f"[Solver]   ❌ NO VALID ASSIGNMENTS FOUND")
print(f"[Solver]   Suitable rooms: {len(suitable_rooms)}")
print(f"[Solver]   Faculty availability windows: {len(faculty_slots)}")
```

## Error Handling

### Infeasibility Detection

```python
if unschedulable_labs:
    error_details = "\n".join([
        f"• {lab['subjectCode']} ({lab['section']}, {lab['studentCount']} students)"
        for lab in unschedulable_labs
    ])
    raise ValueError(
        f"INFEASIBLE: Cannot schedule {len(unschedulable_labs)} lab(s):\n"
        f"{error_details}\n\n"
        f"Please check:\n"
        f"(1) Lab room capacities\n"
        f"(2) Faculty availability\n"
        f"(3) Time block availability"
    )
```

## Mathematical Formulation

### Lab Scheduling Problem

**Variables:**
- $L_{c,d,b,r} \in \{0, 1\}$ : Lab course $c$ assigned to day $d$, block $b$, room $r$

**Constraints:**
1. Each lab exactly once: $\sum_{d,b,r} L_{c,d,b,r} = 1 \quad \forall c$

2. Room non-overlap: $\sum_{c: p \in block(b)} L_{c,d,b,r} \leq 1 \quad \forall d, p, r$

3. Section non-overlap: $\sum_{c \in section(s), p \in block(b)} L_{c,d,b,r} \leq 1 \quad \forall d, p, s$

4. Faculty non-overlap: $\sum_{c \in faculty(f), p \in block(b)} L_{c,d,b,r} \leq 1 \quad \forall d, p, f$

**Objective:**
$$\min \sum_{c,d,b,r} (capacity_r - students_c) \cdot L_{c,d,b,r}$$

## Performance

| Problem Size | Typical Solve Time | Status |
|--------------|-------------------|---------|
| 5-10 labs | < 1 second | OPTIMAL |
| 10-20 labs | 1-5 seconds | OPTIMAL |
| 20-50 labs | 5-30 seconds | OPTIMAL/FEASIBLE |
| 50+ labs | May timeout (60s limit) | FEASIBLE/UNKNOWN |

**Solver Configuration**:
- Max time: 60 seconds for labs, 30 seconds for theory
- Log search progress: Disabled (reduces network overhead)
- Solver: CP-SAT with default parameters

## Theory Scheduling Endpoint: `/solve-theory`

**NEW FEATURE**: Fallback constraint programming solver for theory classes when greedy algorithm fails.

### When is this used?

The theory endpoint is called ONLY when the local greedy algorithm fails to schedule >80% of required theory periods. This provides a mathematical guarantee of finding a solution if one exists.

### Key Differences from Labs

1. **Variable Block Sizes**: Theory can be scheduled in 1, 2, or 3 consecutive period blocks
2. **Periods Per Week**: Each theory course has variable periods (2-4 periods typically)
3. **Existing Assignments**: Must avoid conflicting with already-scheduled labs
4. **Max Periods Per Day**: Enforces section and subject-level daily limits (6 periods/day)

### Request Format

```typescript
POST /solve-theory
{
  courses: TheoryCourse[]        // Theory courses to schedule
  rooms: Room[]                  // Available theory classrooms
  facultyAvailability: FacultyAvailability[]
  existingAssignments: ExistingAssignment[]  // Lab slots already scheduled
  rules: {
    daysPerWeek: 6,
    periodsPerDay: 8,
    maxPeriodsPerBlock: 3,       // Max consecutive periods
    maxPeriodsPerDay: 6          // Max periods per section per day
  }
}
```

### Performance

- **Timeout**: 30 seconds (faster than labs)
- **Success Rate**: ~95% when local greedy fails
- **Typical Solve Time**: 2-5 seconds for 20-30 theory courses

## API Usage Example

```bash
# Health check
curl https://timetablescheduling.onrender.com/

# Solve labs
curl -X POST https://timetablescheduling.onrender.com/solve-labs \
  -H "Content-Type: application/json" \
  -d '{
    "courses": [
      {
        "sectionId": "uuid1",
        "sectionName": "CSE-2A",
        "subjectId": "uuid2",
        "subjectCode": "CS201L",
        "facultyId": "uuid3",
        "facultyCode": "CSE001",
        "studentCount": 55,
        "yearLevel": 2
      }
    ],
    "rooms": [
      {"id": "room1", "name": "LAB-1", "capacity": 60}
    ],
    "facultyAvailability": [
      {
        "facultyId": "uuid3",
        "slots": [
          {"dayOfWeek": 0, "startPeriod": 1, "endPeriod": 8},
          {"dayOfWeek": 1, "startPeriod": 1, "endPeriod": 8}
        ]
      }
    ],
    "rules": {
      "labPeriods": 4,
      "daysPerWeek": 6,
      "periodsPerDay": 8
    }
  }'
```

## Response Example

```json
{
  "success": true,
  "status": "OPTIMAL",
  "message": "Successfully scheduled 5 labs",
  "assignments": [
    {
      "sectionId": "uuid1",
      "subjectId": "uuid2",
      "day": 0,
      "startPeriod": 1,
      "endPeriod": 4,
      "roomId": "room1"
    }
  ],
  "solveTimeMs": 234
}
```
