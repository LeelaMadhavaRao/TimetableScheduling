# Slot Assignment Mechanism

## Overview

This document explains **how time slots are assigned** during timetable generation. The process involves:
1. Finding valid slots that satisfy all constraints
2. Checking availability of resources (faculty, room, section)
3. Marking resources as busy after assignment

## Slot Data Structure

```typescript
interface TimetableSlot {
  sectionId: string      // Which class of students
  subjectId: string      // Which subject
  facultyId: string      // Which teacher
  classroomId: string    // Which room
  day: DayOfWeek         // 0-5 (Mon-Sat)
  startPeriod: Period    // 1-8
  endPeriod: Period      // 1-8
}
```

## Time Representation

### Days

| Value | Day |
|-------|-----|
| 0 | Monday |
| 1 | Tuesday |
| 2 | Wednesday |
| 3 | Thursday |
| 4 | Friday |
| 5 | Saturday |

### Periods

| Period | Time | Session |
|--------|------|---------|
| 1 | 9:00 - 9:45 | Morning |
| 2 | 9:45 - 10:30 | Morning |
| 3 | 10:30 - 11:15 | Morning |
| 4 | 11:15 - 12:00 | Morning |
| -- | 12:00 - 1:30 | Lunch Break |
| 5 | 1:30 - 2:15 | Afternoon |
| 6 | 2:15 - 3:00 | Afternoon |
| 7 | 3:00 - 3:45 | Afternoon |
| 8 | 3:45 - 4:30 | Afternoon |

### Blocks (for Labs)

Labs require 4 consecutive periods:

| Block | Periods | Time |
|-------|---------|------|
| Morning (M) | 1-4 | 9:00 - 12:00 |
| Afternoon (A) | 5-8 | 1:30 - 4:30 |

## Tracking Mechanisms

### Schedule Maps

Three maps track what's busy at each time:

```typescript
// Key format: "day-period" (e.g., "0-1" = Monday Period 1)

private facultySchedule: Map<string, Set<string>>
// Maps facultyId -> Set of "day-period" when busy

private roomSchedule: Map<string, Set<string>>
// Maps roomId -> Set of "day-period" when busy

private sectionSchedule: Map<string, Set<string>>
// Maps sectionId -> Set of "day-period" when busy
```

### Example State

```
After scheduling "CSE-2A Data Structures Lab" on Monday P1-4 in LAB-1:

facultySchedule = {
  "faculty-uuid": Set["0-1", "0-2", "0-3", "0-4"]
}

roomSchedule = {
  "lab1-uuid": Set["0-1", "0-2", "0-3", "0-4"]
}

sectionSchedule = {
  "cse2a-uuid": Set["0-1", "0-2", "0-3", "0-4"]
}
```

## Lab Slot Finding Process

### Step 1: Filter Suitable Rooms

```typescript
const labRooms = this.classrooms.filter((r) => 
  r.roomType === "lab" &&           // Must be a lab room
  r.capacity >= course.studentCount  // Must fit all students
)

// In ILP solver: 85% capacity rule
const minCapacity = course.studentCount * 0.85
const suitableRooms = rooms.filter(r => r.capacity >= minCapacity)
```

### Step 2: Generate Candidate Slots

```typescript
// Try days in priority order
const daysToTry = [0, 1, 2, 3, 4, 5]  // Mon-Sat

for (const day of daysToTry) {
  if (day === 5) {  // Saturday
    // Morning block only (P1-4)
    trySlot(day, 1, 4)
    
    // Afternoon (P5-8) only for Year 1
    if (course.yearLevel === 1) {
      trySlot(day, 5, 8)
    }
  } else {  // Weekdays
    // Try all possible 4-period windows
    for (let start = 1; start <= 5; start++) {
      const end = start + 3
      if (end <= 8) {
        trySlot(day, start, end)
      }
    }
    // Possible windows: P1-4, P2-5, P3-6, P4-7, P5-8
  }
}
```

### Step 3: Check All Constraints

```typescript
function trySlot(day, start, end) {
  // Constraint 1: Faculty available?
  if (!isFacultyAvailable(course.facultyId, day, start, end)) {
    return null  // Faculty has declared unavailability
  }
  
  // Constraint 2: Faculty consecutive rule?
  if (!checkFacultyConsecutiveRule(course.facultyId, day, start)) {
    return null  // Would violate teaching gap rule
  }
  
  // Constraint 3: Section free?
  if (!isSectionAvailable(course.sectionId, day, start, end)) {
    return null  // Section already has another class
  }
  
  // Constraint 4: Find available room
  for (const room of labRooms) {
    if (isRoomAvailable(room.id, day, start, end)) {
      return { day, start, end, roomId: room.id }  // Found!
    }
  }
  
  return null  // No room available at this time
}
```

### Detailed Constraint Checks

#### Faculty Availability Check

```typescript
private isFacultyAvailable(
  facultyId: string, 
  day: DayOfWeek, 
  start: Period, 
  end: Period
): boolean {
  const availability = this.facultyAvailability.get(facultyId)
  
  // No declared availability = available all times
  if (!availability || availability.length === 0) {
    return true
  }
  
  // Check if requested time is within any availability window
  return availability.some((slot) => 
    slot.dayOfWeek === day &&      // Same day
    slot.startPeriod <= start &&   // Starts at or before
    slot.endPeriod >= end          // Ends at or after
  )
}
```

**Example:**
- Faculty available: Day 0 (Monday), P1-4 and P5-8
- Request: Day 0, P1-4 → ✓ Valid
- Request: Day 0, P3-6 → ✗ Invalid (crosses lunch, not in one window)

#### Section Availability Check

```typescript
private isSectionAvailable(
  sectionId: string, 
  day: DayOfWeek, 
  start: Period, 
  end: Period
): boolean {
  const schedule = this.sectionSchedule.get(sectionId) || new Set()
  
  // Check each period in the range
  for (let p = start; p <= end; p++) {
    const key = `${day}-${p}`
    if (schedule.has(key)) {
      return false  // Already busy at this period
    }
  }
  return true  // All periods free
}
```

#### Room Availability Check

```typescript
private isRoomAvailable(
  roomId: string, 
  day: DayOfWeek, 
  start: Period, 
  end: Period
): boolean {
  const schedule = this.roomSchedule.get(roomId) || new Set()
  
  for (let p = start; p <= end; p++) {
    if (schedule.has(`${day}-${p}`)) {
      return false  // Room occupied
    }
  }
  return true
}
```

## Theory Slot Finding Process

Theory courses have different rules:
- Variable periods (1-4 per week)
- Can be split across days
- Maximum periods per day per section

### Find Single Theory Block

```typescript
private findTheorySlot(
  course: CourseAssignment, 
  periods: number  // How many periods to schedule at once
): SlotResult | null {
  const theoryRooms = this.classrooms.filter((r) => 
    r.roomType === "theory" && 
    r.capacity >= course.studentCount
  )
  
  const daysToTry = [0, 1, 2, 3, 4, 5]
  
  for (const day of daysToTry) {
    // Saturday limit for non-Year-1
    const maxPeriod = (day === 5 && course.yearLevel !== 1) ? 4 : 8
    
    for (let start = 1; start <= maxPeriod - periods + 1; start++) {
      const end = start + periods - 1
      if (end > maxPeriod) continue
      
      // Check daily limit
      if (!canScheduleTheoryOnDay(course.sectionId, day, periods)) {
        continue
      }
      
      // Try to find valid slot
      const slot = tryTheorySlot(course, theoryRooms, day, start, end)
      if (slot) return slot
    }
  }
  
  return null
}
```

### Daily Theory Limit Check

```typescript
private canScheduleTheoryOnDay(
  sectionId: string, 
  day: DayOfWeek, 
  additionalPeriods: number
): boolean {
  const schedule = this.sectionSchedule.get(sectionId) || new Set()
  
  // Count existing periods on this day
  let periodsOnDay = 0
  for (let p = 1; p <= 8; p++) {
    if (schedule.has(`${day}-${p}`)) {
      periodsOnDay++
    }
  }
  
  // Check limit (default: 2 theory periods per day per subject)
  return periodsOnDay + additionalPeriods <= RULES.MAX_THEORY_PERIODS_PER_DAY
}
```

## Slot Assignment Process

### Adding a Slot

```typescript
private addSlot(
  course: CourseAssignment,
  day: DayOfWeek,
  startPeriod: Period,
  endPeriod: Period,
  classroomId: string
): boolean {
  // 1. Verify slot is still valid (double-check)
  if (!this.isSectionAvailable(course.sectionId, day, startPeriod, endPeriod)) {
    console.error("Section no longer available!")
    return false
  }
  
  if (!this.isRoomAvailable(classroomId, day, startPeriod, endPeriod)) {
    console.error("Room no longer available!")
    return false
  }
  
  // 2. Add to timetable
  this.timetable.push({
    sectionId: course.sectionId,
    subjectId: course.subjectId,
    facultyId: course.facultyId,
    classroomId,
    day,
    startPeriod,
    endPeriod,
  })
  
  // 3. Mark resources as busy
  for (let p = startPeriod; p <= endPeriod; p++) {
    const key = `${day}-${p}`
    
    this.facultySchedule.get(course.facultyId)!.add(key)
    this.roomSchedule.get(classroomId)!.add(key)
    this.sectionSchedule.get(course.sectionId)!.add(key)
  }
  
  // 4. Update course progress
  const courseId = `${course.sectionId}-${course.subjectId}`
  const periodsAdded = endPeriod - startPeriod + 1
  this.courseProgress.set(
    courseId, 
    (this.courseProgress.get(courseId) || 0) + periodsAdded
  )
  
  console.log(`Scheduled: ${course.sectionName} - ${course.subjectName} ` +
              `on Day ${day}, P${startPeriod}-${endPeriod}`)
  
  return true
}
```

## Visual Example

### Initial State

```
                  Monday  Tuesday  Wednesday  Thursday  Friday  Saturday
Faculty CSE001:   [free]  [free]   [free]     [free]    [free]  [free]
Room LAB-1:       [free]  [free]   [free]     [free]    [free]  [free]
Section CSE-2A:   [free]  [free]   [free]     [free]    [free]  [free]
```

### After Lab Assignment (Data Structures Lab)

```
Course: CSE-2A Data Structures Lab
Day: 0 (Monday), Periods: 1-4, Room: LAB-1

                  Monday       Tuesday  Wednesday  Thursday  Friday  Saturday
Faculty CSE001:   [P1-4 BUSY]  [free]   [free]     [free]    [free]  [free]
Room LAB-1:       [P1-4 BUSY]  [free]   [free]     [free]    [free]  [free]
Section CSE-2A:   [P1-4 BUSY]  [free]   [free]     [free]    [free]  [free]
```

### After Theory Assignment (Operating Systems)

```
Course: CSE-2A Operating Systems
Day: 1 (Tuesday), Periods: 1-2, Room: THEORY-101

                  Monday       Tuesday      Wednesday  Thursday  Friday  Saturday
Faculty CSE003:   [free]       [P1-2 BUSY]  [free]     [free]    [free]  [free]
Room THEORY-101:  [free]       [P1-2 BUSY]  [free]     [free]    [free]  [free]
Section CSE-2A:   [P1-4 BUSY]  [P1-2 BUSY]  [free]     [free]    [free]  [free]
```

## ILP Solver Slot Assignment

In the ILP solver, slots are assigned through **decision variables**:

### Variable Assignment

```python
# L[course_idx][day][block][room_idx] = 1 means assigned
# The solver picks exactly one combination per course

# After solving:
for (c_idx, day, block, r_idx) in valid_assignments:
    if solver.Value(L[(c_idx, day, block, r_idx)]) == 1:
        # This combination was chosen
        course = courses[c_idx]
        room = rooms[r_idx]
        periods = block_periods[block]  # e.g., [1,2,3,4] for morning
        
        # Create assignment
        Assignment(
            sectionId=course.sectionId,
            subjectId=course.subjectId,
            day=day,
            startPeriod=periods[0],
            endPeriod=periods[-1],
            roomId=room.id
        )
```

### Constraint Enforcement

Unlike greedy search, ILP enforces constraints **mathematically**:

```python
# Only ONE assignment per lab:
model.Add(sum(all_vars_for_course) == 1)

# Room can't be double-booked at any period:
model.Add(sum(vars_using_room_at_period) <= 1)

# Section can't be in two places:
model.Add(sum(vars_for_section_at_period) <= 1)

# The solver GUARANTEES all constraints are satisfied
```

## GA Optimizer Slot Changes

The GA optimizer **swaps** existing slots to improve fitness:

### Random Swap

```typescript
private applyRandomSwap(chromosome: TimetableSlot[]): void {
  // Pick random slot
  const index = Math.floor(Math.random() * chromosome.length)
  const slot = chromosome[index]
  
  // Generate new time
  const newDay = Math.floor(Math.random() * 6)
  const maxPeriod = newDay === 5 ? 4 : 8
  const periodRange = slot.endPeriod - slot.startPeriod
  const newStartPeriod = Math.floor(Math.random() * (maxPeriod - periodRange + 1)) + 1
  
  // Create swapped slot
  const newSlot = {
    ...slot,
    day: newDay,
    startPeriod: newStartPeriod,
    endPeriod: newStartPeriod + periodRange,
  }
  
  // Only apply if valid (no conflicts)
  if (this.isValidSwap(chromosome, index, newSlot)) {
    chromosome[index] = newSlot
  }
}
```

### Swap Validation

```typescript
private isValidSwap(chromosome, index, newSlot): boolean {
  for (let i = 0; i < chromosome.length; i++) {
    if (i === index) continue  // Skip self
    
    const other = chromosome[i]
    if (other.day !== newSlot.day) continue  // Different day = no conflict
    
    // Check period overlap
    const overlap = !(newSlot.endPeriod < other.startPeriod || 
                      other.endPeriod < newSlot.startPeriod)
    
    if (overlap) {
      // Same faculty?
      if (other.facultyId === newSlot.facultyId) return false
      
      // Same room?
      if (other.classroomId === newSlot.classroomId) return false
      
      // Same section?
      if (other.sectionId === newSlot.sectionId) return false
    }
  }
  
  return true  // No conflicts
}
```

## Summary

| Stage | Method | Slot Assignment |
|-------|--------|-----------------|
| Base Generation (Local) | Greedy search | First valid slot found |
| Base Generation (ILP) | Constraint solving | Mathematically optimal |
| Optimization (GA) | Random swaps | Validity-checked mutations |

All methods maintain the invariants:
1. No faculty double-booking
2. No room double-booking
3. No section double-booking
4. All declared availability respected
5. Subject type rules followed (lab = 4 periods, theory = max 2/day)
