# Supabase Edge Function - Advanced Scheduling

## Overview

The Supabase Edge Function provides **advanced scheduling capabilities** beyond the local ILP generator. It features:
- Multi-start greedy algorithm
- Course prioritization strategies
- External ILP solver integration for complex problems
- ILP fallback when greedy fails

**File**: `supabase/functions/generate-base-timetable/index.ts`

## Why Edge Function?

| Local Generator | Edge Function |
|-----------------|---------------|
| Simple greedy | Multi-start with best-pick |
| Single ordering | Priority-based + randomized |
| No fallback | External ILP solver fallback |
| May fail on complex problems | Higher success rate |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Edge Function Flow                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐                                                │
│  │   Request   │                                                │
│  └──────┬──────┘                                                │
│         ▼                                                        │
│  ┌─────────────────────────────────────────┐                    │
│  │    Phase 1: Lab Scheduling              │                    │
│  │    ┌──────────────────────────────┐     │                    │
│  │    │  External ILP Solver         │     │                    │
│  │    │  (OR-Tools on Render)        │     │                    │
│  │    └──────────────┬───────────────┘     │                    │
│  │                   │ Failed?             │                    │
│  │                   ▼                     │                    │
│  │    ┌──────────────────────────────┐     │                    │
│  │    │  Greedy Fallback             │     │                    │
│  │    └──────────────────────────────┘     │                    │
│  └────────────────────┬────────────────────┘                    │
│                       ▼                                          │
│  ┌─────────────────────────────────────────┐                    │
│  │    Phase 2: Theory Scheduling           │                    │
│  │    ┌──────────────────────────────┐     │                    │
│  │    │  Multi-Start Greedy          │     │                    │
│  │    │  • Attempt 1: Priority-based │     │                    │
│  │    │  • Attempt 2: Reverse order  │     │                    │
│  │    │  • Attempt 3: Randomized     │     │                    │
│  │    └──────────────┬───────────────┘     │                    │
│  │                   │ < 80% success?      │                    │
│  │                   ▼                     │                    │
│  │    ┌──────────────────────────────┐     │                    │
│  │    │  ILP Fallback for remaining  │     │                    │
│  │    └──────────────────────────────┘     │                    │
│  └────────────────────┬────────────────────┘                    │
│                       ▼                                          │
│  ┌─────────────────────────────────────────┐                    │
│  │    Validate No Overlaps                 │                    │
│  └────────────────────┬────────────────────┘                    │
│                       ▼                                          │
│  ┌─────────────┐                                                │
│  │   Response  │                                                │
│  └─────────────┘                                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Dynamic Availability Tracking

Unlike the simple local generator, the edge function tracks **dynamic availability**:

```typescript
class ILPTimetableGenerator {
  // Static schedules (what's been assigned)
  private facultySchedule: Map<string, Set<string>>   // "day-period" booked
  private roomSchedule: Map<string, Set<string>>
  private sectionSchedule: Map<string, Set<string>>
  
  // DYNAMIC availability (what's still free)
  private facultyDynamicAvailability: Map<string, Set<string>>  // "day-period" available
  private roomDynamicAvailability: Map<string, Set<string>>
}
```

### Initialization

```typescript
constructor(courses, classrooms, facultyAvailability) {
  // Initialize dynamic availability from declared availability
  for (const course of courses) {
    if (!this.facultyDynamicAvailability.has(course.facultyId)) {
      const availableSlots = new Set<string>()
      const facultyAvail = this.facultyAvailability.get(course.facultyId) || []
      
      if (facultyAvail.length === 0) {
        // No restrictions - all periods available
        for (let day = 0; day <= 5; day++) {
          for (let period = 1; period <= 8; period++) {
            availableSlots.add(`${day}-${period}`)
          }
        }
      } else {
        // Only declared available periods
        for (const avail of facultyAvail) {
          for (let p = avail.startPeriod; p <= avail.endPeriod; p++) {
            availableSlots.add(`${avail.dayOfWeek}-${p}`)
          }
        }
      }
      
      this.facultyDynamicAvailability.set(course.facultyId, availableSlots)
    }
  }
  
  // Rooms start fully available
  for (const room of classrooms) {
    const availableSlots = new Set<string>()
    for (let day = 0; day <= 5; day++) {
      for (let period = 1; period <= 8; period++) {
        availableSlots.add(`${day}-${period}`)
      }
    }
    this.roomDynamicAvailability.set(room.id, availableSlots)
  }
}
```

## Lab Prioritization

Labs are sorted by scheduling difficulty:

```typescript
private prioritizeLabCourses(labCourses: CourseAssignment[]): CourseAssignment[] {
  // Count labs per section
  const labsPerSection = new Map<string, number>()
  for (const lab of labCourses) {
    labsPerSection.set(lab.sectionId, (labsPerSection.get(lab.sectionId) || 0) + 1)
  }
  
  return labCourses.slice().sort((a, b) => {
    // 1. Sections with multiple labs first (harder)
    const aLabCount = labsPerSection.get(a.sectionId) || 0
    const bLabCount = labsPerSection.get(b.sectionId) || 0
    if (aLabCount !== bLabCount) {
      return bLabCount - aLabCount  // More labs = higher priority
    }
    
    // 2. Year 1 first (need Saturday afternoon option)
    if (a.yearLevel !== b.yearLevel) {
      return a.yearLevel - b.yearLevel
    }
    
    // 3. Constrained faculty first (fewer availability slots)
    const aAvail = this.facultyAvailability.get(a.facultyId)?.length || 0
    const bAvail = this.facultyAvailability.get(b.facultyId)?.length || 0
    return aAvail - bAvail
  })
}
```

## Theory Prioritization

More sophisticated difficulty scoring:

```typescript
private prioritizeTheoryCourses(theoryCourses: CourseAssignment[]): CourseAssignment[] {
  const courseDifficulty = new Map<string, number>()
  
  for (const course of theoryCourses) {
    let difficulty = 0
    
    // 1. More periods = harder (weight: 10 per period)
    difficulty += course.periodsPerWeek * 10
    
    // 2. Larger class = fewer room options (weight: 0.1 per student)
    difficulty += course.studentCount * 0.1
    
    // 3. Limited faculty availability (weight: 0.5 per missing slot)
    const facultySlots = this.facultyAvailability.get(course.facultyId)
    const maxSlots = 6 * 8  // 48 possible slots
    const availableSlots = facultySlots?.reduce((sum, slot) => 
      sum + (slot.endPeriod - slot.startPeriod + 1), 0) || maxSlots
    difficulty += (maxSlots - availableSlots) * 0.5
    
    // 4. Section has many courses (weight: 3 per course)
    const sectionCourseCount = theoryCourses.filter(
      c => c.sectionId === course.sectionId
    ).length
    difficulty += sectionCourseCount * 3
    
    // 5. Year 1 Saturday restrictions (weight: 5)
    if (course.yearLevel === 1) {
      difficulty += 5
    }
    
    const courseId = `${course.sectionId}-${course.subjectId}`
    courseDifficulty.set(courseId, difficulty)
  }
  
  // Sort by difficulty (highest first)
  return theoryCourses.slice().sort((a, b) => {
    const aId = `${a.sectionId}-${a.subjectId}`
    const bId = `${b.sectionId}-${b.subjectId}`
    return (courseDifficulty.get(bId) || 0) - (courseDifficulty.get(aId) || 0)
  })
}
```

## Multi-Start Greedy

Tries multiple orderings, keeps the best result:

```typescript
async generate(): Promise<TimetableSlot[]> {
  // Phase 1: Schedule labs
  const labsScheduled = await this.scheduleLabsWithExternalSolver(prioritizedLabs)
  
  // Save state after labs
  const labTimetable = [...this.timetable]
  const labFacultySchedule = new Map(this.facultySchedule)
  // ... save all state
  
  // Phase 2: Multi-start for theory
  const NUM_ATTEMPTS = 3
  let bestResult = null
  
  for (let attempt = 1; attempt <= NUM_ATTEMPTS; attempt++) {
    // Reset to post-lab state
    this.timetable = [...labTimetable]
    this.facultySchedule = new Map([...labFacultySchedule].map(([k, v]) => [k, new Set(v)]))
    // ... reset all state
    
    // Choose ordering strategy
    let orderedCourses: CourseAssignment[]
    if (attempt === 1) {
      // Priority-based (hardest first)
      orderedCourses = this.prioritizeTheoryCourses(theoryCourses)
    } else if (attempt === 2) {
      // Reverse priority (easiest first - fills gaps)
      orderedCourses = this.prioritizeTheoryCourses(theoryCourses).reverse()
    } else {
      // Randomized
      orderedCourses = this.shuffleArray(theoryCourses)
    }
    
    // Schedule and track results
    let totalPeriodsScheduled = 0
    for (const course of orderedCourses) {
      const progress = this.scheduleTheoryCourse(course)
      totalPeriodsScheduled += progress
    }
    
    // Keep best result
    if (!bestResult || totalPeriodsScheduled > bestResult.totalPeriods) {
      bestResult = {
        timetable: [...this.timetable],
        totalPeriods: totalPeriodsScheduled,
        // ...
      }
      
      // Early exit on perfect schedule
      if (totalPeriodsScheduled === totalPeriodsNeeded) {
        break
      }
    }
  }
  
  return bestResult.timetable
}
```

## External ILP Solver Integration

### Lab Scheduling

```typescript
async scheduleLabsWithExternalSolver(labCourses: CourseAssignment[]): Promise<number> {
  const labRooms = this.classrooms.filter((r) => r.roomType === "lab")
  
  // Prepare data for solver
  const problemData = {
    courses: labCourses.map((c) => ({
      sectionId: c.sectionId,
      sectionName: c.sectionName,
      subjectId: c.subjectId,
      subjectCode: c.subjectCode,
      facultyId: c.facultyId,
      facultyCode: c.facultyCode,
      studentCount: c.studentCount,
      yearLevel: c.yearLevel,
    })),
    rooms: labRooms.map((r) => ({
      id: r.id,
      name: r.name,
      capacity: r.capacity,
    })),
    facultyAvailability: Array.from(this.facultyAvailability.entries()).map(
      ([facultyId, slots]) => ({
        facultyId,
        slots: slots.map((s) => ({
          dayOfWeek: s.dayOfWeek,
          startPeriod: s.startPeriod,
          endPeriod: s.endPeriod,
        })),
      })
    ),
    rules: {
      labPeriods: 4,
      daysPerWeek: 6,
      periodsPerDay: 8,
    },
  }

  // Call external solver
  const response = await fetch(`${ILP_SOLVER_URL}/solve-labs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(problemData),
  })

  const result = await response.json()
  
  // Process assignments
  for (const assignment of result.assignments) {
    const course = labCourses.find(
      (c) => c.sectionId === assignment.sectionId && 
             c.subjectId === assignment.subjectId
    )
    
    this.addSlot(
      course,
      assignment.day,
      assignment.startPeriod,
      assignment.endPeriod,
      assignment.roomId
    )
  }
  
  return result.assignments.length
}
```

### ILP Fallback for Theory

When greedy achieves < 80% success:

```typescript
// In generate():
if (bestResult.totalPeriods / totalPeriodsNeeded < 0.8) {
  console.warn("Greedy success rate below 80% - triggering ILP fallback")
  
  // Find unscheduled courses
  const unscheduledTheory: CourseAssignment[] = []
  for (const course of theoryCourses) {
    const courseId = `${course.sectionId}-${course.subjectId}`
    const scheduled = this.courseProgress.get(courseId) || 0
    if (scheduled < course.periodsPerWeek) {
      unscheduledTheory.push({
        ...course,
        periodsPerWeek: course.periodsPerWeek - scheduled  // Remaining
      })
    }
  }
  
  // Call ILP solver for remaining courses
  const ilpResult = await this.scheduleTheoryWithILP(unscheduledTheory)
  
  if (ilpResult.success) {
    for (const slot of ilpResult.slots) {
      this.timetable.push(slot)
    }
  }
}
```

### Theory ILP Request

```typescript
private async scheduleTheoryWithILP(theoryCourses: CourseAssignment[]): Promise<...> {
  const theoryRooms = this.classrooms.filter((r) => r.roomType === "theory")
  
  // Include existing assignments as constraints
  const existingAssignments = this.timetable.map((slot) => ({
    sectionId: slot.sectionId,
    day: slot.day,
    startPeriod: slot.startPeriod,
    endPeriod: slot.endPeriod,
    facultyId: slot.facultyId,
    roomId: slot.classroomId,
  }))

  const problemData = {
    courses: theoryCourses.map((c) => ({
      sectionId: c.sectionId,
      sectionName: c.sectionName,
      subjectId: c.subjectId,
      subjectCode: c.subjectCode,
      facultyId: c.facultyId,
      facultyCode: c.facultyCode,
      studentCount: c.studentCount,
      yearLevel: c.yearLevel,
      periodsPerWeek: c.periodsPerWeek,  // Variable for theory
    })),
    rooms: theoryRooms.map(...),
    facultyAvailability: ...,
    existingAssignments,  // Don't conflict with these
    rules: {
      daysPerWeek: 6,
      periodsPerDay: 8,
      maxPeriodsPerBlock: 3,
      maxPeriodsPerDay: 6,
    },
  }

  const response = await fetch(`${ILP_SOLVER_URL}/solve-theory`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(problemData),
  })

  return await response.json()
}
```

## Overlap Validation

Final check to ensure no conflicts:

```typescript
private validateNoOverlaps(): void {
  const issues: string[] = []
  
  // Check all pairs of slots
  for (let i = 0; i < this.timetable.length; i++) {
    for (let j = i + 1; j < this.timetable.length; j++) {
      const a = this.timetable[i]
      const b = this.timetable[j]
      
      // Skip if different days
      if (a.day !== b.day) continue
      
      // Check period overlap
      const periodsOverlap = !(a.endPeriod < b.startPeriod || b.endPeriod < a.startPeriod)
      
      if (periodsOverlap) {
        // Faculty conflict
        if (a.facultyId === b.facultyId) {
          issues.push(`Faculty ${a.facultyId} double-booked on day ${a.day}`)
        }
        
        // Room conflict
        if (a.classroomId === b.classroomId) {
          issues.push(`Room ${a.classroomId} double-booked on day ${a.day}`)
        }
        
        // Section conflict
        if (a.sectionId === b.sectionId) {
          issues.push(`Section ${a.sectionId} double-booked on day ${a.day}`)
        }
      }
    }
  }
  
  if (issues.length > 0) {
    console.error("VALIDATION FAILED:", issues)
    throw new Error(`Timetable has ${issues.length} conflicts`)
  }
}
```

## Error Handling

```typescript
try {
  const labsScheduled = await this.scheduleLabsWithExternalSolver(prioritizedLabs)
} catch (error) {
  console.error("ILP solver failed:", error.message)
  console.log("Falling back to greedy algorithm...")
  
  // Use local greedy as fallback
  for (const course of labCourses) {
    this.scheduleLabCourse(course)
  }
}
```

## Logging

Detailed progress logging for debugging:

```
[Generation] Starting - 25 courses (8 labs, 17 theory)
[Phase 1] Scheduling labs using ILP solver...
[ILP] Sending 8 labs to solver (4 rooms available)
[ILP] Solver completed in 1234ms - Status: OPTIMAL
[ILP] Processing 8 lab assignments...
[ILP] ✅ Lab scheduling complete: 8/8 assigned
[Phase 1] ✅ Complete - 8/8 labs scheduled

[Phase 2] Enhanced Greedy: Scheduling 17 theory courses...
[Phase 2] Attempt 1/3: Priority-based ordering (hardest first)
[Phase 2] Attempt 1 result: 15 full, 2 partial, 0 failed (94.2% periods scheduled)
[Phase 2] ⭐ New best result: 94.2% periods scheduled
[Phase 2] Attempt 2/3: Reverse priority (easiest first)
[Phase 2] Attempt 2 result: 16 full, 1 partial, 0 failed (98.5% periods scheduled)
[Phase 2] ⭐ New best result: 98.5% periods scheduled
[Phase 2] Attempt 3/3: Randomized ordering
[Phase 2] Attempt 3 result: 17 full, 0 partial, 0 failed (100.0% periods scheduled)
[Phase 2] 🎯 Perfect schedule achieved! Skipping remaining attempts.
[Phase 2] ✅ Complete

[Generation] ✅ Complete - 45 total time slots created
```
