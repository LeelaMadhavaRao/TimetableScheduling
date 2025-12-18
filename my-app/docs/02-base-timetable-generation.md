# Base Timetable Generation

## Overview

The base timetable generation is the first phase of the scheduling process. It creates a **valid, conflict-free schedule** that satisfies all hard constraints. This document explains how the base generation works through the API route and local ILP generator.

## Entry Point: API Route

**File**: `app/api/timetable/generate-base/route.ts`

### Request Flow

```typescript
POST /api/timetable/generate-base
Body: { adminId: string }  // Optional, for multi-tenant filtering
```

### Step-by-Step Process

#### Step 1: Initialize Job
```typescript
// Create a new job to track progress
const { data: job } = await supabase
  .from("timetable_jobs")
  .insert({
    status: "generating_base",
    progress: 10,
    message: "Fetching data...",
    created_by: adminId
  })
  .select()
  .single()
```

#### Step 2: Clean Previous Data
```typescript
// Delete old timetables for this administrator
await supabase.from("timetable_optimized").delete().eq("created_by", adminId)
await supabase.from("timetable_base").delete().eq("created_by", adminId)
await supabase.from("timetable_jobs").delete().eq("created_by", adminId)
```

#### Step 3: Fetch Required Data
```typescript
// 1. Section-Subject assignments (what each section studies)
const { data: sectionSubjects } = await supabase
  .from("section_subjects")
  .select("*, sections(*), subjects(*), faculty(*)")
  .in("section_id", sectionIds)

// 2. Available classrooms
const { data: classrooms } = await supabase
  .from("classrooms")
  .select("*")
  .eq("created_by", adminId)

// 3. Faculty availability windows
const { data: availability } = await supabase
  .from("faculty_availability")
  .select("*")
  .in("faculty_id", facultyIds)
```

#### Step 4: Transform Data for Solver
```typescript
// Convert database records to solver-friendly format
const courses: CourseAssignment[] = sectionSubjects.map((ss) => ({
  sectionId: ss.section_id,
  sectionName: ss.sections.name,
  subjectId: ss.subject_id,
  subjectName: ss.subjects.name,
  subjectCode: ss.subjects.code,
  subjectType: ss.subjects.subject_type,      // "theory" | "lab"
  periodsPerWeek: ss.subjects.periods_per_week,
  facultyId: ss.faculty_id,
  facultyCode: ss.faculty.code,
  studentCount: ss.sections.student_count,
  yearLevel: ss.sections.year_level,
}))
```

#### Step 5: Run ILP Generator
```typescript
const generator = new ILPTimetableGenerator(courses, classroomOptions, facultyAvailability)
const timetableSlots = generator.generate()
```

#### Step 6: Save Results
```typescript
// Save all generated slots to database
const slotsToInsert = timetableSlots.map((slot) => ({
  job_id: job.id,
  section_id: slot.sectionId,
  subject_id: slot.subjectId,
  faculty_id: slot.facultyId,
  classroom_id: slot.classroomId,
  day_of_week: slot.day,
  start_period: slot.startPeriod,
  end_period: slot.endPeriod,
  created_by: adminId
}))

await supabase.from("timetable_base").insert(slotsToInsert)
```

## Local ILP Generator

**File**: `lib/ilp-generator.ts`

The local ILP generator uses a **greedy constraint satisfaction** approach (not true ILP, but constraint-based scheduling).

### Data Structures

```typescript
class ILPTimetableGenerator {
  private courses: CourseAssignment[]       // Courses to schedule
  private classrooms: ClassroomOption[]     // Available rooms
  private facultyAvailability: Map<string, FacultyAvailabilitySlot[]>
  private timetable: TimetableSlot[] = []   // Generated schedule
  
  // Constraint tracking maps (key: "day-period")
  private facultySchedule: Map<string, Set<string>>   // Faculty bookings
  private roomSchedule: Map<string, Set<string>>      // Room bookings
  private sectionSchedule: Map<string, Set<string>>   // Section bookings
  private courseProgress: Map<string, number>         // Periods scheduled per course
}
```

### Two-Phase Scheduling

#### Phase 1: Schedule Labs First
```typescript
generate(): TimetableSlot[] {
  // Labs are harder to schedule (4 consecutive periods)
  // So they get priority
  const labCourses = this.courses.filter((c) => c.subjectType === "lab")
  const theoryCourses = this.courses.filter((c) => c.subjectType === "theory")

  console.log("[Phase 1] Scheduling", labCourses.length, "lab courses")
  for (const course of labCourses) {
    this.scheduleCourse(course)
  }

  console.log("[Phase 2] Scheduling", theoryCourses.length, "theory courses")
  for (const course of theoryCourses) {
    this.scheduleCourse(course)
  }

  return this.timetable
}
```

### Lab Slot Finding Algorithm

```typescript
private findLabSlot(course: CourseAssignment): SlotResult | null {
  // Labs need 4 consecutive periods in the same block
  const labRooms = this.classrooms.filter((r) => 
    r.roomType === "lab" && r.capacity >= course.studentCount
  )

  // Priority order: Mon-Fri morning, Saturday morning
  const daysToTry: DayOfWeek[] = [0, 1, 2, 3, 4, 5]  // Mon-Sat

  for (const day of daysToTry) {
    if (day === 5) {
      // Saturday: Only morning (P1-4) normally
      const slot = this.tryLabSlot(course, labRooms, day, 1, 4)
      if (slot) return slot

      // Saturday afternoon for first year only
      if (course.yearLevel === 1) {
        const afternoonSlot = this.tryLabSlot(course, labRooms, day, 5, 8)
        if (afternoonSlot) return afternoonSlot
      }
    } else {
      // Weekdays: try all possible 4-period windows
      for (let start = 1; start <= 5; start++) {
        const end = start + 3  // 4 consecutive periods
        if (end <= 8) {
          const slot = this.tryLabSlot(course, labRooms, day, start, end)
          if (slot) return slot
        }
      }
    }
  }

  return null  // No valid slot found
}
```

### Constraint Checking

```typescript
private tryLabSlot(course, rooms, day, start, end): SlotResult | null {
  // Check 1: Faculty available during these periods?
  if (!this.isFacultyAvailable(course.facultyId, day, start, end)) {
    return null
  }

  // Check 2: Faculty consecutive teaching rule
  if (!this.checkFacultyConsecutiveRule(course.facultyId, day, start)) {
    return null
  }

  // Check 3: Section not already booked?
  if (!this.isSectionAvailable(course.sectionId, day, start, end)) {
    return null
  }

  // Check 4: Find available room
  for (const room of rooms) {
    if (this.isRoomAvailable(room.id, day, start, end)) {
      return { day, startPeriod: start, endPeriod: end, classroomId: room.id }
    }
  }

  return null
}
```

### Availability Checking Functions

```typescript
// Check if faculty is available (declared availability)
private isFacultyAvailable(facultyId: string, day: DayOfWeek, start: Period, end: Period): boolean {
  const availability = this.facultyAvailability.get(facultyId)
  if (!availability || availability.length === 0) return true  // No restrictions

  return availability.some((slot) => 
    slot.dayOfWeek === day && 
    slot.startPeriod <= start && 
    slot.endPeriod >= end
  )
}

// Check section not double-booked
private isSectionAvailable(sectionId: string, day: DayOfWeek, start: Period, end: Period): boolean {
  const schedule = this.sectionSchedule.get(sectionId) || new Set()

  for (let p = start; p <= end; p++) {
    if (schedule.has(`${day}-${p}`)) {
      return false  // Already has a class
    }
  }
  return true
}

// Check room not double-booked
private isRoomAvailable(roomId: string, day: DayOfWeek, start: Period, end: Period): boolean {
  const schedule = this.roomSchedule.get(roomId) || new Set()

  for (let p = start; p <= end; p++) {
    if (schedule.has(`${day}-${p}`)) {
      return false
    }
  }
  return true
}
```

### Faculty Consecutive Rule

This rule prevents faculty fatigue by ensuring breaks between teaching blocks:

```typescript
private checkFacultyConsecutiveRule(facultyId: string, day: DayOfWeek, startPeriod: Period): boolean {
  const schedule = this.facultySchedule.get(facultyId)
  if (!schedule) return true

  // Rule: If faculty teaches P1-2, they can't teach P3-4 (must wait until P5+)
  if (startPeriod >= 3 && startPeriod <= 4) {
    if (schedule.has(`${day}-1`) || schedule.has(`${day}-2`)) {
      return false
    }
  }

  // Reverse: If teaching P3-4, can't have taught P1-2
  if (startPeriod >= 1 && startPeriod <= 2) {
    if (schedule.has(`${day}-3`) || schedule.has(`${day}-4`)) {
      return false
    }
  }

  return true
}
```

### Theory Course Scheduling

```typescript
private findTheorySlot(course: CourseAssignment, periods: number): SlotResult | null {
  const theoryRooms = this.classrooms.filter((r) => 
    r.roomType === "theory" && r.capacity >= course.studentCount
  )

  const daysToTry: DayOfWeek[] = [0, 1, 2, 3, 4, 5]

  for (const day of daysToTry) {
    // Saturday restriction for non-first-year
    const maxPeriod = day === 5 && course.yearLevel !== 1 ? 4 : 8

    for (let start = 1; start <= maxPeriod - periods + 1; start++) {
      const end = start + periods - 1
      if (end > maxPeriod) continue

      // Check daily theory limit
      if (!this.canScheduleTheoryOnDay(course.sectionId, day, periods)) {
        continue
      }

      const slot = this.tryTheorySlot(course, theoryRooms, day, start, end)
      if (slot) return slot
    }
  }

  return null
}

// Max 2 theory periods per subject per day
private canScheduleTheoryOnDay(sectionId: string, day: DayOfWeek, additionalPeriods: number): boolean {
  const schedule = this.sectionSchedule.get(sectionId) || new Set()

  let periodsOnDay = 0
  for (let p = 1; p <= 8; p++) {
    if (schedule.has(`${day}-${p}`)) {
      periodsOnDay++
    }
  }

  return periodsOnDay + additionalPeriods <= RULES.MAX_THEORY_PERIODS_PER_DAY
}
```

### Adding Slots and Updating Schedules

```typescript
private addSlot(
  course: CourseAssignment,
  day: DayOfWeek,
  startPeriod: Period,
  endPeriod: Period,
  classroomId: string
): void {
  // Add to timetable
  this.timetable.push({
    sectionId: course.sectionId,
    subjectId: course.subjectId,
    facultyId: course.facultyId,
    classroomId,
    day,
    startPeriod,
    endPeriod,
  })

  // Update all tracking maps to prevent future conflicts
  for (let p = startPeriod; p <= endPeriod; p++) {
    const key = `${day}-${p}`
    
    // Mark faculty as busy
    this.facultySchedule.get(course.facultyId)!.add(key)
    
    // Mark room as busy
    this.roomSchedule.get(classroomId)!.add(key)
    
    // Mark section as busy
    this.sectionSchedule.get(course.sectionId)!.add(key)
  }
}
```

## Response Format

```typescript
// Success response
{
  success: true,
  jobId: "uuid",
  slotsGenerated: 45,
  generationTime: 1234  // milliseconds
}

// Slots in database (timetable_base)
{
  id: "uuid",
  job_id: "uuid",
  section_id: "uuid",
  subject_id: "uuid",
  faculty_id: "uuid",
  classroom_id: "uuid",
  day_of_week: 0,       // Monday
  start_period: 1,
  end_period: 4,        // 4-period lab
  created_by: "admin-uuid"
}
```

## Algorithm Summary

1. **Prioritization**: Labs scheduled before theory (harder constraints)
2. **Greedy Search**: Try slots in priority order until one works
3. **Constraint Tracking**: Maps track all bookings to prevent conflicts
4. **Backtracking**: None - pure greedy (may fail for complex problems)
5. **Fallback**: Edge function has external ILP solver for complex cases
