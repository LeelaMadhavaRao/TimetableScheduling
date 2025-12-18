# Scheduling Rules and Constraints

## Overview

The timetable scheduling system enforces two types of constraints:

1. **Hard Constraints**: Must be satisfied (violation = invalid timetable)
2. **Soft Constraints**: Should be satisfied (violation = lower quality)

## Hard Constraints

### 1. No Double Booking

#### Faculty Constraint
A faculty member cannot teach multiple classes at the same time.

```typescript
// Check: faculty not already busy at this time
for (let p = startPeriod; p <= endPeriod; p++) {
  if (facultySchedule.get(facultyId).has(`${day}-${p}`)) {
    return false  // Conflict!
  }
}
```

#### Room Constraint
A room cannot host multiple classes at the same time.

```typescript
// Check: room not already occupied
for (let p = startPeriod; p <= endPeriod; p++) {
  if (roomSchedule.get(roomId).has(`${day}-${p}`)) {
    return false  // Conflict!
  }
}
```

#### Section Constraint
Students (section) cannot be in multiple places at once.

```typescript
// Check: section not already in class
for (let p = startPeriod; p <= endPeriod; p++) {
  if (sectionSchedule.get(sectionId).has(`${day}-${p}`)) {
    return false  // Conflict!
  }
}
```

### 2. Room Capacity

Room must have sufficient capacity for the section's students.

```typescript
// Standard rule
if (room.capacity < section.studentCount) {
  return false  // Room too small
}

// ILP solver: 85% rule (allows some flexibility)
const minCapacity = section.studentCount * 0.85
if (room.capacity < minCapacity) {
  return false
}
```

**Example:**
- Section has 55 students
- Standard: Needs room with capacity ≥ 55
- 85% rule: Needs room with capacity ≥ 47 (55 × 0.85)

### 3. Room Type Matching

Labs must be in lab rooms, theory in theory rooms.

```typescript
if (subject.subjectType === "lab") {
  if (room.roomType !== "lab") {
    return false  // Labs need lab equipment
  }
}

if (subject.subjectType === "theory") {
  if (room.roomType !== "theory") {
    return false  // Theory doesn't need lab
  }
}
```

### 4. Lab Duration

Labs require exactly 4 consecutive periods (3 hours).

```typescript
const RULES = {
  LAB_PERIODS: 4,  // 4 × 45 min = 3 hours
}

// Labs scheduled in blocks
const blocks = {
  "M": [1, 2, 3, 4],  // Morning: 9:00 - 12:00
  "A": [5, 6, 7, 8],  // Afternoon: 1:30 - 4:30
}
```

### 5. Faculty Availability

Faculty can only teach during their declared available times.

```typescript
// faculty_availability table stores available windows
// Example: Faculty CSE001 available Mon P1-8, Tue P1-4

private isFacultyAvailable(facultyId, day, start, end): boolean {
  const availability = this.facultyAvailability.get(facultyId)
  
  if (!availability || availability.length === 0) {
    return true  // No restrictions = always available
  }
  
  // Must fall within a declared window
  return availability.some((slot) => 
    slot.dayOfWeek === day &&
    slot.startPeriod <= start &&
    slot.endPeriod >= end
  )
}
```

### 6. Saturday Rules

Saturday has special restrictions:

```typescript
// Rule: Saturday is half-day (morning only)
// Exception: Year 1 can have labs on Saturday afternoon

if (day === 5) {  // Saturday
  if (course.yearLevel !== 1) {
    // Only morning (P1-4) allowed
    if (startPeriod > 4 || endPeriod > 4) {
      return false
    }
  }
  // Year 1 can use P1-8
}
```

## Soft Constraints (Optimization Goals)

### 1. Minimize Faculty Gaps (30% weight)

Prefer schedules where faculty have continuous teaching blocks.

```
BAD: Faculty teaches P1, P2, then P6, P7 (gap at P3-5)
GOOD: Faculty teaches P1, P2, P3, P4 (no gaps)
```

**Calculation:**
```typescript
const gaps = maxPeriod - minPeriod + 1 - actualPeriods
// Example: teaches P1, P2, P5, P6
// maxPeriod = 6, minPeriod = 1
// expected = 6, actual = 4, gaps = 2
```

### 2. Minimize Student Gaps (25% weight)

Prefer schedules where students have continuous classes.

```
BAD: Section has P1-2, then P5-8 (gap at P3-4)
GOOD: Section has P1-4 continuous
```

### 3. Workload Balance (20% weight)

Distribute faculty workload evenly across days.

```
BAD: Faculty teaches 8 periods Monday, 0 periods other days
GOOD: Faculty teaches ~3 periods per day across week
```

**Calculation:** Minimize variance of daily teaching hours.

### 4. Morning Preference (15% weight)

Prefer classes scheduled in the morning.

```
PREFERRED: P1, P2, P3, P4 (morning)
LESS PREFERRED: P5, P6, P7, P8 (afternoon)
```

**Calculation:**
```typescript
const morningScore = morningPeriods / totalPeriods
// Higher score = more morning classes
```

### 5. Lab Compactness (10% weight)

Prefer labs scheduled early in the week.

```
PREFERRED: Labs on Monday, Tuesday
LESS PREFERRED: Labs on Friday, Saturday
```

**Calculation:**
```typescript
const compactness = (5 - dayOfWeek) / 5
// Monday (0) → 5/5 = 1.0
// Saturday (5) → 0/5 = 0.0
```

## Rule Constants

```typescript
// lib/timetable.ts

export const RULES = {
  LAB_PERIODS: 4,                    // 4 consecutive periods for labs
  PERIOD_DURATION_MINS: 45,          // Each period is 45 minutes
  SATURDAY_MORNING_ONLY: true,       // Saturday half-day
  SATURDAY_AFTERNOON_FOR_FIRST_YEAR_LABS: true,  // Exception
  MAX_THEORY_PERIODS_PER_DAY: 2,     // Theory limit per section
  FACULTY_GAP_RULE: 3,               // Minimum gap periods
}

export const LUNCH_BREAK = { start: "12:00", end: "1:30" }
```

## Period Schedule

```typescript
export const PERIOD_TIMINGS = [
  { period: 1, start: "9:00", end: "9:45", session: "morning" },
  { period: 2, start: "9:45", end: "10:30", session: "morning" },
  { period: 3, start: "10:30", end: "11:15", session: "morning" },
  { period: 4, start: "11:15", end: "12:00", session: "morning" },
  // LUNCH BREAK: 12:00 - 1:30
  { period: 5, start: "1:30", end: "2:15", session: "afternoon" },
  { period: 6, start: "2:15", end: "3:00", session: "afternoon" },
  { period: 7, start: "3:00", end: "3:45", session: "afternoon" },
  { period: 8, start: "3:45", end: "4:30", session: "afternoon" },
]
```

## Faculty Consecutive Rule

Special rule to prevent faculty fatigue:

```typescript
// If faculty teaches P1-2, they can't teach P3-4
// Must wait until P5 for next class

private checkFacultyConsecutiveRule(facultyId, day, startPeriod): boolean {
  const schedule = this.facultySchedule.get(facultyId)
  if (!schedule) return true
  
  // Trying to schedule P3-4?
  if (startPeriod >= 3 && startPeriod <= 4) {
    // Check if already taught P1 or P2
    if (schedule.has(`${day}-1`) || schedule.has(`${day}-2`)) {
      return false  // Needs break before P3-4
    }
  }
  
  // Trying to schedule P1-2?
  if (startPeriod >= 1 && startPeriod <= 2) {
    // Check if will teach P3 or P4
    if (schedule.has(`${day}-3`) || schedule.has(`${day}-4`)) {
      return false  // Conflict with gap rule
    }
  }
  
  return true
}
```

## Maximum Periods Rules

### Theory Subject Daily Limit

```typescript
const RULES = {
  MAX_THEORY_PERIODS_PER_DAY: 2,  // Per section per day
}

// A section can't have more than 2 theory periods on one day
// Ensures variety and prevents fatigue
```

### Section Daily Limit (Edge Function)

```typescript
const RULES = {
  MAX_SECTION_PERIODS_PER_DAY: 6,  // Total periods per section
}

// A section shouldn't have more than 6 periods in a day
// Leaves time for breaks and self-study
```

## Constraint Enforcement Comparison

| Constraint | Local Generator | ILP Solver | GA Optimizer |
|------------|-----------------|------------|--------------|
| No double booking | Check before assign | Mathematical constraint | Validity check |
| Room capacity | Filter rooms | Variable filter | Inherited |
| Room type | Filter rooms | Variable filter | Inherited |
| Lab duration | Fixed 4 periods | Block assignment | Not changed |
| Faculty availability | Check availability | Variable filter | Not changed |
| Saturday rules | Day-based logic | Variable filter | Swap validation |
| Faculty consecutive | Explicit check | Not implemented | Not checked |
| Theory daily limit | Explicit check | Constraint | Not changed |

## Validation

Final validation ensures all constraints are satisfied:

```typescript
private validateNoOverlaps(): void {
  const issues: string[] = []
  
  for (let i = 0; i < this.timetable.length; i++) {
    for (let j = i + 1; j < this.timetable.length; j++) {
      const a = this.timetable[i]
      const b = this.timetable[j]
      
      if (a.day !== b.day) continue
      
      const periodsOverlap = !(a.endPeriod < b.startPeriod || 
                              b.endPeriod < a.startPeriod)
      
      if (periodsOverlap) {
        if (a.facultyId === b.facultyId) {
          issues.push(`Faculty double-booked: ${a.facultyId}`)
        }
        if (a.classroomId === b.classroomId) {
          issues.push(`Room double-booked: ${a.classroomId}`)
        }
        if (a.sectionId === b.sectionId) {
          issues.push(`Section double-booked: ${a.sectionId}`)
        }
      }
    }
  }
  
  if (issues.length > 0) {
    throw new Error(`Invalid timetable: ${issues.length} conflicts`)
  }
}
```

## Summary Table

| Constraint Type | Rule | Violation Consequence |
|-----------------|------|----------------------|
| **HARD** | No faculty double-booking | Invalid schedule |
| **HARD** | No room double-booking | Invalid schedule |
| **HARD** | No section double-booking | Invalid schedule |
| **HARD** | Room capacity sufficient | Invalid schedule |
| **HARD** | Lab = 4 consecutive periods | Invalid schedule |
| **HARD** | Faculty available at time | Invalid schedule |
| **HARD** | Saturday morning only (most) | Invalid schedule |
| **SOFT** | Minimize faculty gaps | Lower fitness score |
| **SOFT** | Minimize student gaps | Lower fitness score |
| **SOFT** | Balance workload | Lower fitness score |
| **SOFT** | Prefer morning | Lower fitness score |
| **SOFT** | Labs early in week | Lower fitness score |
