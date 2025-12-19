# Base Timetable Generation

## Overview

The base timetable generation is the first phase of the scheduling process. It creates a **valid, conflict-free schedule** that satisfies all hard constraints. This process uses:

1. **External ILP solver** (OR-Tools CP-SAT on Render.com) for lab scheduling
2. **Enhanced greedy algorithm** with multiple ordering strategies for theory classes
3. **Day-balancing constraint** to distribute faculty workload evenly
4. **Dynamic availability tracking** to prevent conflicts in real-time

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    generate-base-timetable Edge Function                     │
│                         (2500+ lines TypeScript)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────┐    ┌──────────────────────────────────────┐  │
│  │      PHASE 1: LABS       │    │         PHASE 2: THEORY              │  │
│  │  ────────────────────    │    │  ──────────────────────────────────  │  │
│  │  External ILP Solver     │    │  Phase 2A: Enhanced Greedy (15 tries)│  │
│  │  (OR-Tools CP-SAT)       │    │  Phase 2B: ILP Fallback if <80%      │  │
│  │  3-period consecutive    │    │  2 periods/day max per subject       │  │
│  │  blocks                  │    │  Day-balancing constraint            │  │
│  └──────────────────────────┘    └──────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    CONSTRAINT TRACKING SYSTEM                         │  │
│  │  ─────────────────────────────────────────────────────────────────   │  │
│  │  • facultySchedule: Map<facultyId, Set<"day-period">>                │  │
│  │  • roomSchedule: Map<roomId, Set<"day-period">>                      │  │
│  │  • sectionSchedule: Map<sectionId, Set<"day-period">>                │  │
│  │  • facultyDynamicAvailability: Real-time available slots             │  │
│  │  • facultyTheoryDayLoad: Theory-only periods per day (for balancing) │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Entry Point: Edge Function

**File**: `supabase/functions/generate-base-timetable/index.ts`

### Request Flow

```typescript
POST /functions/v1/generate-base-timetable
Headers: {
  Authorization: Bearer <session_token>
  apikey: <anon_key>
}
Body: { adminId: string }  // Optional, for multi-tenant filtering
```

## Key Data Structures

### Course Assignment

```typescript
interface CourseAssignment {
  sectionId: string       // UUID
  sectionName: string     // e.g., "CSE-2A"
  subjectId: string       // UUID
  subjectName: string     // e.g., "Data Structures"
  subjectCode: string     // e.g., "CS201"
  subjectType: "theory" | "lab"
  periodsPerWeek: number  // 3-4 for labs, 4 for theory
  facultyId: string       // UUID
  facultyCode: string     // e.g., "CSE-F001"
  studentCount: number    // For room capacity matching
  yearLevel: number       // 1-4 (affects Saturday restrictions)
}
```

### Timetable Slot

```typescript
interface TimetableSlot {
  sectionId: string
  subjectId: string
  facultyId: string
  classroomId: string
  day: DayOfWeek        // 0-5 (Mon-Sat)
  startPeriod: Period   // 1-8
  endPeriod: Period     // 1-8
}
```

## ILPTimetableGenerator Class

### Constructor Initialization

The constructor performs critical setup:

```typescript
constructor(courses, classrooms, facultyAvailability) {
  // 1. Initialize constraint tracking maps
  this.facultySchedule = new Map()   // Tracks all faculty bookings
  this.roomSchedule = new Map()       // Tracks all room bookings
  this.sectionSchedule = new Map()    // Tracks all section bookings
  
  // 2. Initialize DYNAMIC availability from declared availability
  // ALL faculty get availability initialized (including theory-only)
  for (const facultyId of allFacultyIds) {
    const availableSlots = new Set<string>()
    // Add all declared available periods
    for (const avail of facultyAvailability) {
      for (let p = avail.startPeriod; p <= avail.endPeriod; p++) {
        availableSlots.add(`${avail.dayOfWeek}-${p}`)
      }
    }
    this.facultyDynamicAvailability.set(facultyId, availableSlots)
  }
  
  // 3. Calculate faculty THEORY workload for day-balancing
  const theoryCourses = courses.filter(c => c.subjectType === 'theory')
  for (const course of theoryCourses) {
    const current = this.facultyTotalWorkload.get(course.facultyId) || 0
    this.facultyTotalWorkload.set(course.facultyId, current + course.periodsPerWeek)
  }
  
  // 4. Calculate max periods per day for each faculty
  // Formula: ceil(totalWorkload / 6 days) + 3 buffer
  for (const [facultyId, totalWorkload] of this.facultyTotalWorkload.entries()) {
    const maxPerDay = Math.ceil(totalWorkload / 6) + 3
    this.facultyMaxPerDay.set(facultyId, maxPerDay)
  }
}
```

## PHASE 1: Lab Scheduling

### External ILP Solver

Labs are scheduled using an external OR-Tools CP-SAT solver for optimal constraint satisfaction:

```typescript
async scheduleLabsWithExternalSolver(labCourses: CourseAssignment[]): Promise<number> {
  const response = await fetch(`${ILP_SOLVER_URL}/solve-labs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      courses: labCourses.map(c => ({
        sectionId: c.sectionId,
        sectionName: c.sectionName,
        subjectId: c.subjectId,
        subjectCode: c.subjectCode,
        facultyId: c.facultyId,
        facultyCode: c.facultyCode,
        studentCount: c.studentCount,
        yearLevel: c.yearLevel
      })),
      rooms: this.classrooms.filter(r => r.roomType === "lab"),
      facultyAvailability: this.formatFacultyAvailabilityForSolver(),
      rules: {
        labPeriods: RULES.LAB_PERIODS,  // 3 consecutive periods
        daysPerWeek: 6,
        periodsPerDay: 8
      }
    })
  })
  
  const { success, assignments, status, message } = await response.json()
  
  if (success && assignments) {
    // Apply ILP solution to local tracking
    for (const assign of assignments) {
      this.applyLabAssignment(assign)
    }
  }
}
```

### Greedy Fallback for Labs

If the external solver fails, a local greedy algorithm is used:

```typescript
private scheduleLabCourse(course: CourseAssignment): boolean {
  const slot = this.findLabSlot(course)
  if (slot) {
    return this.addSlot(course, slot.day, slot.startPeriod, slot.endPeriod, slot.classroomId)
  }
  return false
}
```

## PHASE 2: Theory Scheduling

### Phase 2A: Enhanced Greedy Algorithm

The theory scheduling uses a sophisticated multi-attempt greedy algorithm:

```typescript
// 15 attempts with different orderings
// Attempts 1-10: Normal mode with day-balancing
// Attempts 11-15: Relaxed mode (no day-balancing constraint)
const NUM_ATTEMPTS = 15

for (let attempt = 1; attempt <= NUM_ATTEMPTS; attempt++) {
  // Reset to post-lab state for each attempt
  this.resetToLabState(labTimetable, labFacultySchedule, ...)
  
  // RELAXED MODE: Disable day-balancing for attempts 11+
  this.relaxedMode = attempt > 10
  
  // Determine ordering strategy
  let orderedCourses: CourseAssignment[]
  switch (attempt) {
    case 1:  orderedCourses = this.orderBySectionFirst(theoryCourses); break
    case 2:  orderedCourses = this.orderByMostConstrainedFirst(theoryCourses); break
    case 3:  orderedCourses = this.orderByFacultyInterleaved(theoryCourses); break
    case 4:  orderedCourses = this.prioritizeTheoryCourses(theoryCourses); break
    case 5:  orderedCourses = this.orderBySectionFirst(theoryCourses).reverse(); break
    default: orderedCourses = this.shuffleArray(theoryCourses); break
  }
  
  // Schedule with this ordering
  for (const course of orderedCourses) {
    const progress = this.scheduleTheoryCourse(course)
    totalPeriodsScheduled += progress
  }
  
  // Track best result
  if (totalPeriodsScheduled > bestGreedyResult.totalPeriods) {
    bestGreedyResult = { timetable: [...this.timetable], ... }
  }
  
  // Early exit if perfect schedule achieved
  if (totalPeriodsScheduled === totalPeriodsNeeded) {
    break
  }
}
```

### Ordering Strategies

#### 1. Section-First Ordering
Schedule all courses for each section together, preventing section fragmentation:

```typescript
orderBySectionFirst(courses: CourseAssignment[]): CourseAssignment[] {
  // Group by section, sort sections by total faculty workload
  // Within each section, sort by faculty workload (highest first)
}
```

#### 2. Most-Constrained-First
Prioritize courses with fewest scheduling options:

```typescript
orderByMostConstrainedFirst(courses: CourseAssignment[]): CourseAssignment[] {
  // Score each course by constraint difficulty
  // Sort by highest score (most constrained) first
}
```

#### 3. Faculty-Interleaved
Spread sections across faculty in round-robin:

```typescript
orderByFacultyInterleaved(courses: CourseAssignment[]): CourseAssignment[] {
  // Group by faculty, pick one from each faculty in rotation
}
```

### Theory Slot Finding Algorithm

```typescript
private findTheorySlot(course: CourseAssignment, periodsNeeded: number) {
  const theoryRooms = this.classrooms.filter(r => 
    r.roomType === "theory" && r.capacity >= course.studentCount
  )
  
  // 1. Calculate section and faculty day loads
  const sectionDayLoad = this.getSectionDayLoad(course.sectionId)
  const facultyDayLoad = this.getFacultyDayLoad(course.facultyId)
  
  // 2. Sort days by COMBINED load (prefer less busy days)
  const daysToTry = [0, 1, 2, 3, 4, 5].sort((a, b) => {
    const aLoad = (sectionDayLoad.get(a) || 0) + (facultyDayLoad.get(a) || 0)
    const bLoad = (sectionDayLoad.get(b) || 0) + (facultyDayLoad.get(b) || 0)
    return aLoad - bLoad
  })
  
  // PASS 1: Try preferred time slots (morning first)
  const timeSlotPriority = [
    { start: 1, end: 2 }, { start: 1, end: 3 }, { start: 2, end: 3 },
    { start: 2, end: 4 }, { start: 5, end: 6 }, { start: 5, end: 7 }, ...
  ]
  
  for (const day of daysToTry) {
    for (const timeSlot of timeSlotPriority) {
      const slot = this.tryTheorySlot(course, theoryRooms, day, timeSlot.start, timeSlot.end)
      if (slot) return slot
    }
  }
  
  // PASS 2: Try ALL sequential slots
  for (const day of daysToTry) {
    for (let start = 1; start <= 8 - periodsNeeded + 1; start++) {
      // Skip lunch crossing (periods 4-5)
      if (start <= 4 && start + periodsNeeded - 1 > 4) continue
      
      const slot = this.tryTheorySlot(course, theoryRooms, day, start, start + periodsNeeded - 1)
      if (slot) return slot
    }
  }
  
  return null
}
```

### Constraint Checks in tryTheorySlot

```typescript
private tryTheorySlot(course, rooms, day, start, end) {
  // CHECK 1: Section not already scheduled at this time
  if (this.isSectionAlreadyScheduled(course.sectionId, day, start, end)) {
    return null
  }

  // CHECK 2: Faculty DYNAMIC availability (updated after each assignment)
  if (!this.isFacultyDynamicallyAvailable(course.facultyId, day, start, end)) {
    return null
  }

  // CHECK 3: Section daily limit + subject daily limit
  // MAX_SECTION_PERIODS_PER_DAY = 6, MAX_THEORY_PERIODS_PER_DAY_PER_SUBJECT = 2
  if (!this.canScheduleTheoryOnDay(course.sectionId, day, end - start + 1, course.subjectId)) {
    return null
  }
  
  // CHECK 4: Day-balancing for high-workload faculty
  // CRITICAL: Uses getFacultyTheoryDayLoad() which counts ONLY theory periods
  // This prevents lab periods from incorrectly blocking theory scheduling
  if (!this.canFacultyTeachMoreOnDay(course.facultyId, day, end - start + 1)) {
    return null
  }

  // CHECK 5: Find available room
  for (const room of rooms) {
    if (this.isRoomDynamicallyAvailable(room.id, day, start, end)) {
      return { day, startPeriod: start, endPeriod: end, classroomId: room.id }
    }
  }
  
  return null
}
```

### Day-Balancing Constraint

**CRITICAL FIX**: The day-balancing constraint only counts THEORY periods, not lab periods:

```typescript
private canFacultyTeachMoreOnDay(facultyId: string, day: DayOfWeek, additionalPeriods: number): boolean {
  // In relaxed mode, skip this constraint entirely
  if (this.relaxedMode) return true
  
  const maxPerDay = this.facultyMaxPerDay.get(facultyId)
  if (!maxPerDay) return true
  
  // CRITICAL: Count ONLY theory periods using getFacultyTheoryDayLoad()
  // NOT lab periods. maxPerDay is calculated from theory workload only,
  // so we must compare apples-to-apples.
  const facultyTheoryDayLoad = this.getFacultyTheoryDayLoad(facultyId)
  const currentLoad = facultyTheoryDayLoad.get(day) || 0
  
  return (currentLoad + additionalPeriods) <= maxPerDay
}

// Helper: Get THEORY-ONLY load per day for a faculty member
private getFacultyTheoryDayLoad(facultyId: string): Map<DayOfWeek, number> {
  const dayLoad = new Map<DayOfWeek, number>()
  
  for (const slot of this.timetable) {
    if (slot.facultyId !== facultyId) continue
    
    // Look up the course to check if it's theory
    const course = this.courses.find(
      c => c.sectionId === slot.sectionId && c.subjectId === slot.subjectId
    )
    
    // Only count theory courses (skip labs)
    if (course && course.subjectType === 'theory') {
      const periodsInSlot = slot.endPeriod - slot.startPeriod + 1
      dayLoad.set(slot.day, (dayLoad.get(slot.day) || 0) + periodsInSlot)
    }
  }
  
  return dayLoad
}
```

### Phase 2B: ILP Fallback

If greedy achieves less than 80% success, ILP fallback is triggered:

```typescript
if (!greedyTheorySuccess) {
  console.warn(`[Phase 2B] Greedy success rate below 80% - triggering ILP fallback...`)
  
  // Reset to post-lab state
  this.resetToLabState(labTimetable, ...)
  
  const ilpResult = await this.scheduleTheoryWithILP(theoryCourses)
  
  if (ilpResult.success && ilpResult.periodsScheduled > 0) {
    // Apply ILP solution
  } else {
    // Apply period reduction fallback
    theoryCourses = this.applyTheoryPeriodReductionFallback(theoryCourses, theoryRooms)
    // Retry ILP with reduced courses
  }
}
```

## Scheduling Rules Constants

```typescript
const RULES = {
  LAB_PERIODS: 3,                           // 3 consecutive periods (2.25 hours)
  PERIOD_DURATION_MINS: 45,
  LUNCH_START_PERIOD: 4.5,
  LUNCH_END_PERIOD: 5,
  MAX_THEORY_PERIODS_PER_DAY_PER_SUBJECT: 2, // Theory max 2 periods/day
  MAX_THEORY_BLOCK_SIZE: 2,                  // Always schedule 2 periods
  MAX_SECTION_PERIODS_PER_DAY: 6,            // Total section limit
}
```

## Dynamic Availability System

The system maintains real-time availability that updates after each assignment:

```typescript
private addSlot(course, day, startPeriod, endPeriod, classroomId): boolean {
  // Add to timetable
  this.timetable.push({ ... })

  // Update all tracking maps
  for (let p = startPeriod; p <= endPeriod; p++) {
    const key = `${day}-${p}`
    
    // Mark faculty as busy
    this.facultySchedule.get(course.facultyId)!.add(key)
    
    // REMOVE from faculty dynamic availability
    this.facultyDynamicAvailability.get(course.facultyId)?.delete(key)
    
    // Mark room as busy
    this.roomSchedule.get(classroomId)!.add(key)
    
    // REMOVE from room dynamic availability
    this.roomDynamicAvailability.get(classroomId)?.delete(key)
    
    // Mark section as busy
    this.sectionSchedule.get(course.sectionId)!.add(key)
  }
  
  return true
}
```

## Response Format

```typescript
// Success response
{
  success: true,
  jobId: "uuid",
  slotsGenerated: 150,
  generationTime: 2500  // milliseconds
}

// Database schema (timetable_base)
{
  id: "uuid",
  job_id: "uuid",
  section_id: "uuid",
  subject_id: "uuid",
  faculty_id: "uuid",
  classroom_id: "uuid",
  day_of_week: 0,       // Monday
  start_period: 1,
  end_period: 2,        // 2-period theory block
  created_by: "admin-uuid"
}
```

## Algorithm Summary

1. **Phase 1 (Labs)**: External ILP solver for optimal constraint satisfaction
   - 3 consecutive periods per lab
   - Greedy fallback if ILP fails
   
2. **Phase 2A (Theory Greedy)**: 15 attempts with different orderings
   - Attempts 1-10: Normal mode with day-balancing
   - Attempts 11-15: Relaxed mode (no day-balancing)
   - Multiple ordering strategies: Section-First, Most-Constrained-First, Faculty-Interleaved
   - Best result is kept
   
3. **Phase 2B (Theory ILP Fallback)**: Only if greedy <80% success
   - Period reduction fallback if ILP also fails

4. **Constraint Tracking**: Real-time tracking prevents conflicts
   - Faculty, room, section schedules updated after each assignment
   - Day-balancing uses theory-only counts (not lab periods)
