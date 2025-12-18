# Complete Flow: From Request to Schedule

## Overview

This document traces the complete flow of timetable generation from user click to final display.

## Sequence Diagram

```
User                Frontend               API Route           Generator            ILP Solver (Render)
  │                    │                      │                   │                      │
  │ Click "Generate"   │                      │                   │                      │
  │ ─────────────────► │                      │                   │                      │
  │                    │                      │                   │                      │
  │                    │ POST /generate-base  │                   │                      │
  │                    │ ───────────────────► │                   │                      │
  │                    │                      │                   │                      │
  │                    │                      │ Create Job        │                      │
  │                    │                      │ ───────────────►  │                      │
  │                    │                      │                   │                      │
  │                    │                      │ Fetch Data        │                      │
  │                    │                      │ ◄───────────────  │                      │
  │                    │                      │                   │                      │
  │                    │                      │ new Generator()   │                      │
  │                    │                      │ ───────────────►  │                      │
  │                    │                      │                   │                      │
  │                    │                      │                   │ POST /solve-labs    │
  │                    │                      │                   │ ──────────────────► │
  │                    │                      │                   │                      │
  │                    │                      │                   │  OR-Tools CP-SAT    │
  │                    │                      │                   │  ◄──────────────────│
  │                    │                      │                   │                      │
  │                    │                      │                   │  Lab Assignments    │
  │                    │                      │                   │ ◄────────────────── │
  │                    │                      │                   │                      │
  │                    │                      │                   │ Schedule Theory     │
  │                    │                      │                   │ ───────────────────►│
  │                    │                      │                   │                      │
  │                    │                      │ TimetableSlots[]  │                      │
  │                    │                      │ ◄───────────────  │                      │
  │                    │                      │                   │                      │
  │                    │                      │ Save to DB        │                      │
  │                    │                      │ ───────────────►  │                      │
  │                    │                      │                   │                      │
  │                    │ { success, jobId }   │                   │                      │
  │                    │ ◄─────────────────── │                   │                      │
  │                    │                      │                   │                      │
  │                    │ POST /optimize       │                   │                      │
  │                    │ ───────────────────► │                   │                      │
  │                    │                      │                   │                      │
  │                    │                      │ Load base slots   │                      │
  │                    │                      │ ───────────────►  │                      │
  │                    │                      │                   │                      │
  │                    │                      │ new GAOptimizer() │                      │
  │                    │                      │ ───────────────►  │                      │
  │                    │                      │                   │                      │
  │                    │                      │ optimize()        │                      │
  │                    │                      │ (100 generations) │                      │
  │                    │                      │ ◄───────────────  │                      │
  │                    │                      │                   │                      │
  │                    │                      │ Save optimized    │                      │
  │                    │                      │ ───────────────►  │                      │
  │                    │                      │                   │                      │
  │                    │ { success, fitness } │                   │                      │
  │                    │ ◄─────────────────── │                   │                      │
  │                    │                      │                   │                      │
  │ Display Timetable  │                      │                   │                      │
  │ ◄───────────────── │                      │                   │                      │
```

## Step-by-Step Walkthrough

### Step 1: User Initiates Generation

**Location:** `components/generate-timetable.tsx`

```typescript
const handleGenerate = async () => {
  setIsGenerating(true)
  setProgress(0)
  setStatus("Starting generation...")

  try {
    // Call base generation API
    const response = await fetch("/api/timetable/generate-base", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminId: user.id }),
    })

    const result = await response.json()
    
    if (result.success) {
      setJobId(result.jobId)
      setStatus("Base timetable generated!")
      setProgress(50)
    }
  } catch (error) {
    setStatus("Generation failed")
  }
}
```

### Step 2: API Creates Job and Fetches Data

**Location:** `app/api/timetable/generate-base/route.ts`

```typescript
export async function POST(request: Request) {
  const { adminId } = await request.json()
  const supabase = await getSupabaseServerClient()

  // 1. Delete previous timetables
  await supabase.from("timetable_base").delete().eq("created_by", adminId)

  // 2. Create tracking job
  const { data: job } = await supabase
    .from("timetable_jobs")
    .insert({
      status: "generating_base",
      progress: 10,
      created_by: adminId
    })
    .select()
    .single()

  // 3. Fetch all required data
  const { data: sectionSubjects } = await supabase
    .from("section_subjects")
    .select("*, sections(*), subjects(*), faculty(*)")

  const { data: classrooms } = await supabase
    .from("classrooms")
    .select("*")
    .eq("created_by", adminId)

  const { data: availability } = await supabase
    .from("faculty_availability")
    .select("*")
```

### Step 3: Data Transformation

**Location:** `app/api/timetable/generate-base/route.ts`

```typescript
// Transform database records to solver format
const courses: CourseAssignment[] = sectionSubjects.map((ss) => ({
  sectionId: ss.section_id,
  sectionName: ss.sections.name,
  subjectId: ss.subject_id,
  subjectName: ss.subjects.name,
  subjectCode: ss.subjects.code,
  subjectType: ss.subjects.subject_type,
  periodsPerWeek: ss.subjects.periods_per_week,
  facultyId: ss.faculty_id,
  facultyCode: ss.faculty.code,
  studentCount: ss.sections.student_count,
  yearLevel: ss.sections.year_level,
}))

const classroomOptions: ClassroomOption[] = classrooms.map((c) => ({
  id: c.id,
  name: c.name,
  capacity: c.capacity,
  roomType: c.room_type,
}))
```

### Step 4: Generator Initialization

**Location:** `lib/ilp-generator.ts`

```typescript
const generator = new ILPTimetableGenerator(
  courses,
  classroomOptions,
  facultyAvailability
)

// Constructor sets up tracking maps
constructor(courses, classrooms, facultyAvailability) {
  this.courses = courses
  this.classrooms = classrooms
  
  // Group faculty availability by faculty ID
  for (const slot of facultyAvailability) {
    if (!this.facultyAvailability.has(slot.facultyId)) {
      this.facultyAvailability.set(slot.facultyId, [])
    }
    this.facultyAvailability.get(slot.facultyId).push(slot)
  }
  
  // Initialize tracking
  for (const course of courses) {
    const courseId = `${course.sectionId}-${course.subjectId}`
    this.courseProgress.set(courseId, 0)
  }
}
```

### Step 5: Phase 1 - Lab Scheduling

**Location:** `lib/ilp-generator.ts`

```typescript
generate(): TimetableSlot[] {
  // Separate course types
  const labCourses = this.courses.filter((c) => c.subjectType === "lab")
  const theoryCourses = this.courses.filter((c) => c.subjectType === "theory")

  // Phase 1: Schedule labs first (harder constraint)
  for (const course of labCourses) {
    this.scheduleCourse(course)
  }
  
  // ...
}

private scheduleCourse(course: CourseAssignment): void {
  if (course.subjectType === "lab") {
    const slot = this.findLabSlot(course)
    if (slot) {
      this.addSlot(course, slot.day, slot.startPeriod, slot.endPeriod, slot.classroomId)
    }
  }
}
```

### Step 6: Lab Slot Finding

```typescript
private findLabSlot(course): SlotResult | null {
  // Filter suitable rooms
  const labRooms = this.classrooms.filter((r) => 
    r.roomType === "lab" && r.capacity >= course.studentCount
  )

  // Try each day
  for (const day of [0, 1, 2, 3, 4, 5]) {
    // Try each possible block
    for (let start = 1; start <= 5; start++) {
      const end = start + 3
      if (end <= 8) {
        // Check all constraints
        if (this.isFacultyAvailable(course.facultyId, day, start, end) &&
            this.isSectionAvailable(course.sectionId, day, start, end)) {
          
          // Find available room
          for (const room of labRooms) {
            if (this.isRoomAvailable(room.id, day, start, end)) {
              return { day, startPeriod: start, endPeriod: end, classroomId: room.id }
            }
          }
        }
      }
    }
  }
  return null
}
```

### Step 7: Slot Assignment

```typescript
private addSlot(
  course: CourseAssignment,
  day: DayOfWeek,
  startPeriod: Period,
  endPeriod: Period,
  classroomId: string
): void {
  // Add to result timetable
  this.timetable.push({
    sectionId: course.sectionId,
    subjectId: course.subjectId,
    facultyId: course.facultyId,
    classroomId,
    day,
    startPeriod,
    endPeriod,
  })

  // Mark resources as busy
  for (let p = startPeriod; p <= endPeriod; p++) {
    const key = `${day}-${p}`
    this.facultySchedule.get(course.facultyId)!.add(key)
    this.roomSchedule.get(classroomId)!.add(key)
    this.sectionSchedule.get(course.sectionId)!.add(key)
  }
}
```

### Step 8: Phase 2 - Theory Scheduling

```typescript
generate(): TimetableSlot[] {
  // ... (labs done)
  
  // Phase 2: Schedule theory courses
  for (const course of theoryCourses) {
    this.scheduleCourse(course)
  }

  return this.timetable
}

private scheduleCourse(course): void {
  if (course.subjectType === "theory") {
    let periodsScheduled = 0
    
    while (periodsScheduled < course.periodsPerWeek) {
      const remainingPeriods = course.periodsPerWeek - periodsScheduled
      const periodsToSchedule = Math.min(2, remainingPeriods)  // Max 2 per day
      
      const slot = this.findTheorySlot(course, periodsToSchedule)
      if (slot) {
        this.addSlot(course, slot.day, slot.startPeriod, slot.endPeriod, slot.classroomId)
        periodsScheduled += periodsToSchedule
      } else {
        break  // No more valid slots
      }
    }
  }
}
```

### Step 9: Save Base Timetable

**Location:** `app/api/timetable/generate-base/route.ts`

```typescript
// Generator returns slots
const timetableSlots = generator.generate()

// Transform and save
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

// Update job status
await supabase
  .from("timetable_jobs")
  .update({
    status: "base_complete",
    progress: 100,
    message: `Generated ${timetableSlots.length} slots`
  })
  .eq("id", job.id)

return NextResponse.json({ success: true, jobId: job.id })
```

### Step 10: Trigger Optimization

**Location:** `components/generate-timetable.tsx`

```typescript
// After base generation success
const handleOptimize = async () => {
  const response = await fetch("/api/timetable/optimize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId, adminId: user.id }),
  })

  const result = await response.json()
  
  if (result.success) {
    setStatus(`Optimized! Fitness: ${result.finalFitness.toFixed(4)}`)
    setProgress(100)
  }
}
```

### Step 11: Load Base for Optimization

**Location:** `app/api/timetable/optimize/route.ts`

```typescript
export async function POST(request: Request) {
  const { jobId, adminId } = await request.json()
  const supabase = await getSupabaseServerClient()

  // Load base timetable
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
```

### Step 12: GA Optimization

**Location:** `lib/ga-optimizer.ts`

```typescript
const optimizer = new GATimetableOptimizer(timetableSlots)
const { optimizedSchedule, finalFitness } = optimizer.optimize()

// Inside optimize():
optimize() {
  // Initialize population
  this.initializePopulation()  // 50 chromosomes

  let bestFitness = -Infinity
  let bestSchedule = []

  // Run for 100 generations
  for (let gen = 0; gen < 100; gen++) {
    // Evaluate all chromosomes
    for (let i = 0; i < this.population.length; i++) {
      const fitness = this.calculateFitness(this.population[i])
      this.fitnessScores.set(i, fitness)

      if (fitness > bestFitness) {
        bestFitness = fitness
        bestSchedule = [...this.population[i]]
      }
    }

    // Create next generation
    const newPopulation = []
    
    // Elitism (keep top 10%)
    const elite = this.getTopPerformers(5)
    newPopulation.push(...elite)

    // Generate offspring
    while (newPopulation.length < 50) {
      const parent1 = this.tournamentSelection()
      const parent2 = this.tournamentSelection()
      let offspring = this.crossover(parent1, parent2)
      offspring = this.mutate(offspring)
      newPopulation.push(offspring)
    }

    this.population = newPopulation
  }

  return { optimizedSchedule: bestSchedule, finalFitness: bestFitness }
}
```

### Step 13: Save Optimized Timetable

**Location:** `app/api/timetable/optimize/route.ts`

```typescript
// Save optimized slots
const optimizedSlots = optimizedSchedule.map((slot) => ({
  job_id: jobId,
  section_id: slot.sectionId,
  subject_id: slot.subjectId,
  faculty_id: slot.facultyId,
  classroom_id: slot.classroomId,
  day_of_week: slot.day,
  start_period: slot.startPeriod,
  end_period: slot.endPeriod,
  fitness_score: finalFitness,
  created_by: adminId
}))

await supabase.from("timetable_optimized").insert(optimizedSlots)

// Update job status
await supabase
  .from("timetable_jobs")
  .update({
    status: "completed",
    progress: 100,
    message: `Fitness: ${finalFitness.toFixed(4)}`,
    optimization_time: optimizationTime
  })
  .eq("id", jobId)

return NextResponse.json({
  success: true,
  finalFitness,
  optimizationTime,
  slotsOptimized: optimizedSchedule.length,
})
```

### Step 14: Display Timetable

**Location:** `components/timetable-viewer.tsx`

```typescript
// Fetch optimized timetable
useEffect(() => {
  const fetchTimetable = async () => {
    const { data } = await supabase
      .from("timetable_optimized")
      .select(`
        *,
        sections(*),
        subjects(*),
        faculty(*),
        classrooms(*)
      `)
      .eq("job_id", jobId)

    setSlots(data)
  }

  fetchTimetable()
}, [jobId])

// Render as grid
return (
  <table>
    <thead>
      <tr>
        <th>Period</th>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
          <th key={day}>{day}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {[1, 2, 3, 4, 5, 6, 7, 8].map(period => (
        <tr key={period}>
          <td>P{period}</td>
          {[0, 1, 2, 3, 4, 5].map(day => (
            <td key={day}>
              {getSlotAt(day, period)}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
)
```

## Timeline Summary

| Step | Duration | Action |
|------|----------|--------|
| 1 | 0ms | User clicks Generate |
| 2 | ~100ms | Create job, fetch data |
| 3 | ~50ms | Transform data |
| 4 | ~10ms | Initialize generator |
| 5-7 | ~500-2000ms | Schedule labs (or call ILP solver) |
| 8 | ~200-500ms | Schedule theory |
| 9 | ~100ms | Save base timetable |
| 10 | 0ms | Auto-trigger optimization |
| 11 | ~100ms | Load base slots |
| 12 | ~2000-10000ms | Run GA (100 generations) |
| 13 | ~100ms | Save optimized timetable |
| 14 | ~200ms | Fetch and display |

**Total: ~5-15 seconds** depending on problem size.
