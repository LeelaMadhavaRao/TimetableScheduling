// Supabase Edge Function for Base Timetable Generation using ILP Microservice
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

// Types
type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5
type Period = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
type SubjectType = "theory" | "lab"

interface SolverLabAssignment {
  sectionId: string
  subjectId: string
  day: DayOfWeek
  startPeriod: Period
  endPeriod: Period
  roomId: string
}

interface CourseAssignment {
  sectionId: string
  sectionName: string
  subjectId: string
  subjectName: string
  subjectCode: string
  subjectType: SubjectType
  periodsPerWeek: number
  facultyId: string
  facultyCode: string
  studentCount: number
  yearLevel: number
}

interface ClassroomOption {
  id: string
  name: string
  capacity: number
  roomType: "lab" | "theory"
}

interface FacultyAvailabilitySlot {
  facultyId: string
  dayOfWeek: DayOfWeek
  startPeriod: Period
  endPeriod: Period
}

interface TimetableSlot {
  sectionId: string
  subjectId: string
  facultyId: string
  classroomId: string
  day: DayOfWeek
  startPeriod: Period
  endPeriod: Period
}



// Constants
const RULES = {
  LAB_PERIODS: 4,
  PERIOD_DURATION_MINS: 45,
  LUNCH_START_PERIOD: 4.5,
  LUNCH_END_PERIOD: 5,
  MAX_THEORY_PERIODS_PER_DAY: 2,
  THEORY_BLOCK_OPTIONS: [1.5, 2.25, 3], // hours per week
}

// ILP Solver Service Configuration
const ILP_SOLVER_URL = Deno.env.get("ILP_SOLVER_URL") || "https://timetablescheduling.onrender.com"

// ILP-based constraint satisfaction solver
class ILPTimetableGenerator {
  private courses: CourseAssignment[]
  private classrooms: ClassroomOption[]
  private facultyAvailability: Map<string, FacultyAvailabilitySlot[]>
  private timetable: TimetableSlot[] = []
  
  // CRITICAL: These maps track ALL scheduled slots to prevent overlaps
  // Key format: "day-period" (e.g., "0-1" = Monday Period 1)
  private facultySchedule: Map<string, Set<string>> = new Map()  // facultyId -> Set of "day-period"
  private roomSchedule: Map<string, Set<string>> = new Map()     // roomId -> Set of "day-period"
  private sectionSchedule: Map<string, Set<string>> = new Map()  // sectionId -> Set of "day-period"
  
  // DYNAMIC AVAILABILITY: Updated as assignments are made
  // Stores remaining available slots for each faculty/room
  private facultyDynamicAvailability: Map<string, Set<string>> = new Map()  // facultyId -> Set of "day-period" available
  private roomDynamicAvailability: Map<string, Set<string>> = new Map()     // roomId -> Set of "day-period" available
  
  private courseProgress: Map<string, number> = new Map()

  constructor(
    courses: CourseAssignment[],
    classrooms: ClassroomOption[],
    facultyAvailability: FacultyAvailabilitySlot[],
  ) {
    this.courses = courses
    this.classrooms = classrooms

    this.facultyAvailability = new Map()
    for (const slot of facultyAvailability) {
      if (!this.facultyAvailability.has(slot.facultyId)) {
        this.facultyAvailability.set(slot.facultyId, [])
      }
      this.facultyAvailability.get(slot.facultyId)!.push(slot)
    }

    for (const course of courses) {
      const courseId = `${course.sectionId}-${course.subjectId}`
      this.courseProgress.set(courseId, 0)
    }
    
    // Initialize empty sets for all resources
    for (const course of courses) {
      if (!this.facultySchedule.has(course.facultyId)) {
        this.facultySchedule.set(course.facultyId, new Set())
      }
      if (!this.sectionSchedule.has(course.sectionId)) {
        this.sectionSchedule.set(course.sectionId, new Set())
      }
    }
    for (const room of classrooms) {
      if (!this.roomSchedule.has(room.id)) {
        this.roomSchedule.set(room.id, new Set())
      }
    }
    
    // Initialize DYNAMIC availability from declared availability
    // If no availability declared, assume ALL periods are available
    for (const course of courses) {
      if (!this.facultyDynamicAvailability.has(course.facultyId)) {
        const availableSlots = new Set<string>()
        const facultyAvail = this.facultyAvailability.get(course.facultyId) || []
        
        if (facultyAvail.length === 0) {
          // No restrictions - all periods on all days available
          for (let day = 0; day <= 5; day++) {
            for (let period = 1; period <= 8; period++) {
              availableSlots.add(`${day}-${period}`)
            }
          }
        } else {
          // Add only declared available periods
          for (const avail of facultyAvail) {
            for (let p = avail.startPeriod; p <= avail.endPeriod; p++) {
              availableSlots.add(`${avail.dayOfWeek}-${p}`)
            }
          }
        }
        
        this.facultyDynamicAvailability.set(course.facultyId, availableSlots)
      }
    }
    
    // Initialize room dynamic availability - all rooms available at all times initially
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

  // Prioritize labs: Multi-lab sections first, then by constraints
  private prioritizeLabCourses(labCourses: CourseAssignment[]): CourseAssignment[] {
    // Count labs per section
    const labsPerSection = new Map<string, number>()
    for (const lab of labCourses) {
      labsPerSection.set(lab.sectionId, (labsPerSection.get(lab.sectionId) || 0) + 1)
    }
    
    // Sort by:
    // 1. Sections with multiple labs first (harder to schedule)
    // 2. Year level (ascending - Year 1 needs Saturday afternoon slots)
    // 3. Faculty with limited availability
    return labCourses.slice().sort((a, b) => {
      const aLabCount = labsPerSection.get(a.sectionId) || 0
      const bLabCount = labsPerSection.get(b.sectionId) || 0
      
      if (aLabCount !== bLabCount) {
        return bLabCount - aLabCount // More labs first
      }
      
      if (a.yearLevel !== b.yearLevel) {
        return a.yearLevel - b.yearLevel // Year 1 first
      }
      
      // Faculty availability (fewer slots = higher priority)
      const aAvailability = this.facultyAvailability.get(a.facultyId)?.length || 0
      const bAvailability = this.facultyAvailability.get(b.facultyId)?.length || 0
      
      if (aAvailability !== bAvailability) {
        return aAvailability - bAvailability // Constrained faculty first
      }
      
      return 0
    })
  }

  async generate(): Promise<TimetableSlot[]> {
    console.log(`[Generation] Starting - ${this.courses.length} courses (${this.courses.filter(c => c.subjectType === "lab").length} labs, ${this.courses.filter(c => c.subjectType === "theory").length} theory)`)

    const labCourses = this.courses.filter((c) => c.subjectType === "lab")
    const theoryCourses = this.courses.filter((c) => c.subjectType === "theory")

    // PRIORITIZATION: Sort labs by difficulty
    const prioritizedLabs = this.prioritizeLabCourses(labCourses)

    console.log("[Phase 1] Scheduling labs using ILP solver...")
    
    try {
      const labsScheduled = await this.scheduleLabsWithExternalSolver(prioritizedLabs)
      console.log(`[Phase 1] ✅ Complete - ${labsScheduled}/${prioritizedLabs.length} labs scheduled`)
    } catch (error) {
      console.error(`[ERROR] ILP solver failed:`, error instanceof Error ? error.message : String(error))
      console.log(`[Phase 1] Falling back to greedy algorithm...`)
      
      let labsScheduled = 0
      for (const course of labCourses) {
        const scheduled = this.scheduleLabCourse(course)
        if (scheduled) labsScheduled++
      }
      console.log(`[Phase 1] Greedy fallback: ${labsScheduled}/${labCourses.length} labs scheduled`)
    }

    console.log(`[Phase 2] Scheduling ${theoryCourses.length} theory courses...`)
    let theoryScheduled = 0
    let theoryFailed = 0
    
    for (const course of theoryCourses) {
      const progress = this.scheduleTheoryCourse(course)
      if (progress === course.periodsPerWeek) {
        theoryScheduled++
      } else {
        theoryFailed++
        console.error(`[ERROR] Theory ${course.subjectCode} (${course.sectionName}): ${progress}/${course.periodsPerWeek} periods scheduled`)
      }
    }
    
    console.log(`[Phase 2] ✅ Complete - ${theoryScheduled}/${theoryCourses.length} theory courses fully scheduled`)
    
    if (theoryFailed > 0) {
      console.error(`[ERROR] ${theoryFailed} theory courses incomplete`)
    }

    // Validate no overlaps
    this.validateNoOverlaps()
    
    console.log(`[Generation] ✅ Complete - ${this.timetable.length} total time slots created`)
    
    return this.timetable
  }

  async scheduleLabsWithExternalSolver(labCourses: CourseAssignment[]): Promise<number> {
    if (labCourses.length === 0) return 0

    const labRooms = this.classrooms.filter((r) => r.roomType === "lab")
    console.log(`[ILP] Sending ${labCourses.length} labs to solver (${labRooms.length} rooms available)`)

    // Serialize problem data as JSON
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
      facultyAvailability: Array.from(this.facultyAvailability.entries()).map(([facultyId, slots]) => ({
        facultyId,
        slots: slots.map((s) => ({
          dayOfWeek: s.dayOfWeek,
          startPeriod: s.startPeriod,
          endPeriod: s.endPeriod,
        })),
      })),
      rules: {
        labPeriods: RULES.LAB_PERIODS,
        daysPerWeek: 6, // Mon-Sat
        periodsPerDay: 8,
      },
    }

    // Call external ILP solver service
    const startTime = Date.now()
    try {
      const response = await fetch(`${ILP_SOLVER_URL}/solve-labs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(problemData),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[ERROR] Solver returned ${response.status}:`, errorText)
        throw new Error(`Solver service returned ${response.status}: ${errorText}`)
      }

      const result = await response.json()
      const solveTime = Date.now() - startTime
      console.log(`[ILP] Solver completed in ${solveTime}ms - Status: ${result.status}`)
      
      if (!result.success) {
        throw new Error(result.message || "Solver failed to find a solution")
      }

      console.log(`[ILP] Solution status: ${result.status}`)
      console.log(`[ILP] Processing ${result.assignments.length} lab assignments...`)

      // Process solution from solver
      let assignedLabs = 0
      let skippedLabs = 0
      const skippedDetails: string[] = []
      
      for (const assignment of result.assignments) {
        const course = labCourses.find(
          (c) => c.sectionId === assignment.sectionId && c.subjectId === assignment.subjectId
        )
        if (!course) {
          console.error(`[ERROR] Lab course not found for assignment - Section: ${assignment.sectionId}, Subject: ${assignment.subjectId}`)
          skippedLabs++
          continue
        }

        const success = this.addSlot(
          course,
          assignment.day as DayOfWeek,
          assignment.startPeriod as Period,
          assignment.endPeriod as Period,
          assignment.roomId
        )
        
        if (success) {
          assignedLabs++
        } else {
          skippedLabs++
          skippedDetails.push(`${course.subjectCode} (${course.sectionName}) - Day ${assignment.day}, Periods ${assignment.startPeriod}-${assignment.endPeriod}`)
        }
      }
      
      console.log(`[ILP] ✅ Lab scheduling complete: ${assignedLabs}/${result.assignments.length} assigned`)
      
      if (skippedLabs > 0) {
        console.error(`[ERROR] Skipped ${skippedLabs} labs due to conflicts:`)
        skippedDetails.forEach(detail => console.error(`  - ${detail}`))
      }

      return assignedLabs
    } catch (fetchError) {
      console.error(`[ILP] ❌ Failed to call solver at ${ILP_SOLVER_URL}:`, fetchError instanceof Error ? fetchError.message : String(fetchError))
      throw new Error(`Failed to call ILP solver: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`)
    }
  }

  private scheduleLabCourse(course: CourseAssignment): boolean {
    const courseId = `${course.sectionId}-${course.subjectId}`
    console.log(`[Edge Function] Scheduling LAB ${course.subjectCode} for ${course.sectionName}`)

    const slot = this.findLabSlot(course)
    if (slot) {
      this.addSlot(course, slot.day, slot.startPeriod, slot.endPeriod, slot.classroomId)
      this.courseProgress.set(courseId, RULES.LAB_PERIODS)
      console.log(
        `[Edge Function] ✅ SUCCESSFULLY scheduled LAB at Day ${slot.day}, Periods ${slot.startPeriod}-${slot.endPeriod}`
      )
      return true
    } else {
      console.error(`[Edge Function] ❌ FAILED to schedule LAB ${course.subjectCode} for ${course.sectionName}`)
      return false
    }
  }

  private findLabSlot(course: CourseAssignment): {
    day: DayOfWeek
    startPeriod: Period
    endPeriod: Period
    classroomId: string
  } | null {
    const labRooms = this.classrooms.filter((r) => r.roomType === "lab" && r.capacity >= course.studentCount)
    if (labRooms.length === 0) return null

    const daysToTry: DayOfWeek[] = [0, 1, 2, 3, 4, 5]

    for (const day of daysToTry) {
      if (day === 5) {
        const slot = this.tryLabSlot(course, labRooms, day, 1, 4)
        if (slot) return slot
        if (course.yearLevel === 1) {
          const afternoonSlot = this.tryLabSlot(course, labRooms, day, 5, 8)
          if (afternoonSlot) return afternoonSlot
        }
      } else {
        const morningSlot = this.tryLabSlot(course, labRooms, day, 1, 4)
        if (morningSlot) return morningSlot
        const afternoonSlot = this.tryLabSlot(course, labRooms, day, 5, 8)
        if (afternoonSlot) return afternoonSlot
      }
    }

    return null
  }

  private tryLabSlot(
    course: CourseAssignment,
    rooms: ClassroomOption[],
    day: DayOfWeek,
    start: Period,
    end: Period
  ): { day: DayOfWeek; startPeriod: Period; endPeriod: Period; classroomId: string } | null {
    if (this.isSectionAlreadyScheduled(course.sectionId, day, start, end)) return null
    if (!this.isFacultyDynamicallyAvailable(course.facultyId, day, start, end)) return null
    if (!this.checkFacultyGapRule(course.facultyId, day, start, end)) return null

    for (const room of rooms) {
      if (this.isRoomDynamicallyAvailable(room.id, day, start, end)) {
        return { day, startPeriod: start, endPeriod: end, classroomId: room.id }
      }
    }

    return null
  }

  private validateNoOverlaps(): void {
    console.log("[Edge Function] Post-generation validation: checking for overlaps...")
    
    let hasErrors = false
    const facultySlots = new Map<string, Set<string>>()
    const roomSlots = new Map<string, Set<string>>()
    const sectionSlots = new Map<string, Set<string>>()
    
    for (const slot of this.timetable) {
      for (let p = slot.startPeriod; p <= slot.endPeriod; p++) {
        const key = `${slot.day}-${p}`
        
        // Check faculty
        if (!facultySlots.has(slot.facultyId)) {
          facultySlots.set(slot.facultyId, new Set())
        }
        if (facultySlots.get(slot.facultyId)!.has(key)) {
          console.error(`[Edge Function] ❌ VALIDATION ERROR: Faculty ${slot.facultyId} overlap at ${key}`)
          hasErrors = true
        }
        facultySlots.get(slot.facultyId)!.add(key)
        
        // Check room
        if (!roomSlots.has(slot.classroomId)) {
          roomSlots.set(slot.classroomId, new Set())
        }
        if (roomSlots.get(slot.classroomId)!.has(key)) {
          console.error(`[Edge Function] ❌ VALIDATION ERROR: Room ${slot.classroomId} overlap at ${key}`)
          hasErrors = true
        }
        roomSlots.get(slot.classroomId)!.add(key)
        
        // Check section
        if (!sectionSlots.has(slot.sectionId)) {
          sectionSlots.set(slot.sectionId, new Set())
        }
        if (sectionSlots.get(slot.sectionId)!.has(key)) {
          console.error(`[Edge Function] ❌ VALIDATION ERROR: Section ${slot.sectionId} overlap at ${key}`)
          hasErrors = true
        }
        sectionSlots.get(slot.sectionId)!.add(key)
      }
    }
    
    if (!hasErrors) {
      console.log("[Edge Function] ✅ Validation passed: No overlaps detected")
    } else {
      console.error("[Edge Function] ⚠️ Validation found errors - check logs above")
    }
  }

  private scheduleTheoryCourse(course: CourseAssignment): number {
    const courseId = `${course.sectionId}-${course.subjectId}`
    const periodsNeeded = course.periodsPerWeek
    let periodsScheduled = 0

    console.log(
      `[Edge Function] Scheduling THEORY ${course.subjectCode} for ${course.sectionName} - ${periodsNeeded} periods needed`,
    )

    // Try to schedule in blocks (1.5hr, 2.25hr, or 3hr = 2, 3, or 4 periods)
    let attempts = 0
    const maxAttempts = 50 // Prevent infinite loops
    
    while (periodsScheduled < periodsNeeded && attempts < maxAttempts) {
      attempts++
      const remainingPeriods = periodsNeeded - periodsScheduled
      const periodsToSchedule = Math.min(RULES.MAX_THEORY_PERIODS_PER_DAY, remainingPeriods)

      const slot = this.findTheorySlot(course, periodsToSchedule)
      if (slot) {
        this.addSlot(course, slot.day, slot.startPeriod, slot.endPeriod, slot.classroomId)
        periodsScheduled += periodsToSchedule
        console.log(
          `[Edge Function]   ✓ Theory block at Day ${slot.day}, Periods ${slot.startPeriod}-${slot.endPeriod} (${periodsScheduled}/${periodsNeeded})`,
        )
      } else {
        // FAIL HARD: Cannot meet periods_per_week requirement
        const errorMsg = `INCOMPLETE SCHEDULE: Cannot schedule ${course.subjectCode} for ${course.sectionName}. ` +
          `Scheduled ${periodsScheduled}/${periodsNeeded} periods. ` +
          `Reasons: (1) No available theory rooms, (2) Faculty conflicts, (3) Section schedule full, (4) Day period limits exceeded.`
        console.error(`[Edge Function] ❌ ${errorMsg}`)
        throw new Error(errorMsg)
      }
    }

    // Double-check we scheduled all periods
    if (periodsScheduled < periodsNeeded) {
      throw new Error(
        `COVERAGE CONSTRAINT VIOLATED: ${course.subjectCode} (${course.sectionName}) scheduled ${periodsScheduled}/${periodsNeeded} periods`
      )
    }

    this.courseProgress.set(courseId, periodsScheduled)
    console.log(`[Edge Function] ✅ Completed ${course.subjectCode}: ${periodsScheduled}/${periodsNeeded} periods`)
    return periodsScheduled
  }

  private findTheorySlot(
    course: CourseAssignment,
    periodsNeeded: number,
  ): {
    day: DayOfWeek
    startPeriod: Period
    endPeriod: Period
    classroomId: string
  } | null {
    const theoryRooms = this.classrooms.filter((r) => r.roomType === "theory" && r.capacity >= course.studentCount)

    // Days to try: Mon(0) to Fri(4), then Sat(5)
    const daysToTry: DayOfWeek[] = [0, 1, 2, 3, 4, 5]

    for (const day of daysToTry) {
      // Saturday only half day for non-first years
      const maxPeriod = day === 5 && course.yearLevel !== 1 ? 4 : 8

      // Try different starting positions for the required periods
      for (let start = 1; start <= maxPeriod - periodsNeeded + 1; start++) {
        const end = start + periodsNeeded - 1
        if (end > maxPeriod) continue

        // Don't split across lunch (periods 4 and 5)
        if (start <= 4 && end > 4) continue

        const slot = this.tryTheorySlot(course, theoryRooms, day as DayOfWeek, start as Period, end as Period)
        if (slot) return slot
      }
    }

    return null
  }

  private tryTheorySlot(
    course: CourseAssignment,
    rooms: ClassroomOption[],
    day: DayOfWeek,
    start: Period,
    end: Period,
  ): { day: DayOfWeek; startPeriod: Period; endPeriod: Period; classroomId: string } | null {
    // CRITICAL CHECK 1: Is section already scheduled at this time?
    if (this.isSectionAlreadyScheduled(course.sectionId, day, start, end)) {
      return null
    }

    // CRITICAL CHECK 2: Check faculty DYNAMIC availability (updated after each assignment)
    if (!this.isFacultyDynamicallyAvailable(course.facultyId, day, start, end)) {
      return null
    }

    // Check theory periods per day constraint
    if (!this.canScheduleTheoryOnDay(course.sectionId, day, end - start + 1)) {
      return null
    }

    // Check faculty gap rule
    if (!this.checkFacultyGapRule(course.facultyId, day, start, end)) {
      return null
    }

    // CRITICAL CHECK 3: Find room with DYNAMIC availability
    for (const room of rooms) {
      if (this.isRoomDynamicallyAvailable(room.id, day, start, end)) {
        return { day, startPeriod: start, endPeriod: end, classroomId: room.id }
      }
    }

    return null
  }

  // ==========================================
  // AVAILABILITY CHECK FUNCTIONS
  // ==========================================

  private isSectionAlreadyScheduled(sectionId: string, day: DayOfWeek, start: Period, end: Period): boolean {
    const schedule = this.sectionSchedule.get(sectionId)
    if (!schedule) return false

    for (let p = start; p <= end; p++) {
      const key = `${day}-${p}`
      if (schedule.has(key)) {
        return true  // CONFLICT: Section already scheduled
      }
    }
    return false
  }

  // Check DYNAMIC availability (updated after each assignment)
  private isFacultyDynamicallyAvailable(facultyId: string, day: DayOfWeek, start: Period, end: Period): boolean {
    const availableSlots = this.facultyDynamicAvailability.get(facultyId)
    if (!availableSlots) {
      console.error(`[ILP] No dynamic availability found for faculty ${facultyId}`)
      return false
    }

    // Check if faculty is available for ALL periods in the slot
    for (let p = start; p <= end; p++) {
      const key = `${day}-${p}`
      if (!availableSlots.has(key)) {
        console.log(`[ILP] Faculty ${facultyId} NOT dynamically available at ${key}`)
        return false
      }
    }

    return true
  }
  
  // Check DYNAMIC room availability
  private isRoomDynamicallyAvailable(roomId: string, day: DayOfWeek, start: Period, end: Period): boolean {
    const availableSlots = this.roomDynamicAvailability.get(roomId)
    if (!availableSlots) {
      console.error(`[ILP] No dynamic availability found for room ${roomId}`)
      return false
    }

    // Check if room is available for ALL periods in the slot
    for (let p = start; p <= end; p++) {
      const key = `${day}-${p}`
      if (!availableSlots.has(key)) {
        return false
      }
    }

    return true
  }

  // Check faculty gap rule (no mixing periods 1-2 with 3-4)
  private checkFacultyGapRule(facultyId: string, day: DayOfWeek, start: Period, end: Period): boolean {
    const schedule = this.facultySchedule.get(facultyId)
    if (!schedule) return true

    const hasPeriods1or2 = schedule.has(`${day}-1`) || schedule.has(`${day}-2`)
    const hasPeriods3or4 = schedule.has(`${day}-3`) || schedule.has(`${day}-4`)

    // If scheduling periods 3-4 and already has 1-2, reject
    if ((start === 3 || start === 4 || end === 3 || end === 4) && hasPeriods1or2) {
      return false
    }

    // If scheduling periods 1-2 and already has 3-4, reject  
    if ((start === 1 || start === 2 || end === 1 || end === 2) && hasPeriods3or4) {
      return false
    }

    return true
  }

  private canScheduleTheoryOnDay(sectionId: string, day: DayOfWeek, additionalPeriods: number): boolean {
    const schedule = this.sectionSchedule.get(sectionId)
    if (!schedule) return true

    let periodsOnDay = 0
    for (let p = 1; p <= 8; p++) {
      if (schedule.has(`${day}-${p}`)) {
        periodsOnDay++
      }
    }

    return periodsOnDay + additionalPeriods <= RULES.MAX_THEORY_PERIODS_PER_DAY
  }

  private addSlot(
    course: CourseAssignment,
    day: DayOfWeek,
    startPeriod: Period,
    endPeriod: Period,
    classroomId: string,
  ): boolean {
    // Double-check for conflicts before adding (safety check)
    for (let p = startPeriod; p <= endPeriod; p++) {
      const key = `${day}-${p}`
      
      const facultySchedule = this.facultySchedule.get(course.facultyId) || new Set()
      const roomSchedule = this.roomSchedule.get(classroomId) || new Set()
      const sectionSchedule = this.sectionSchedule.get(course.sectionId) || new Set()
      
      if (facultySchedule.has(key)) {
        console.error(`[ERROR] Faculty ${course.facultyCode} conflict at Day ${day} Period ${p} - Skipping ${course.subjectCode} (${course.sectionName})`)
        return false
      }
      if (roomSchedule.has(key)) {
        console.error(`[ERROR] Room ${classroomId} conflict at Day ${day} Period ${p} - Skipping ${course.subjectCode} (${course.sectionName})`)
        return false
      }
      if (sectionSchedule.has(key)) {
        console.error(`[ERROR] Section ${course.sectionName} conflict at Day ${day} Period ${p} - Skipping ${course.subjectCode}`)
        return false
      }
    }

    // Add to main timetable
    this.timetable.push({
      sectionId: course.sectionId,
      subjectId: course.subjectId,
      facultyId: course.facultyId,
      classroomId,
      day,
      startPeriod,
      endPeriod,
    })

    // Update schedules AND remove from dynamic availability
    for (let p = startPeriod; p <= endPeriod; p++) {
      const key = `${day}-${p}`
      
      // Update faculty schedule
      if (!this.facultySchedule.has(course.facultyId)) {
        this.facultySchedule.set(course.facultyId, new Set())
      }
      this.facultySchedule.get(course.facultyId)!.add(key)
      
      // REMOVE from faculty dynamic availability
      const facultyAvail = this.facultyDynamicAvailability.get(course.facultyId)
      if (facultyAvail) {
        facultyAvail.delete(key)
      }

      // Update room schedule
      if (!this.roomSchedule.has(classroomId)) {
        this.roomSchedule.set(classroomId, new Set())
      }
      this.roomSchedule.get(classroomId)!.add(key)
      
      // REMOVE from room dynamic availability
      const roomAvail = this.roomDynamicAvailability.get(classroomId)
      if (roomAvail) {
        roomAvail.delete(key)
      }

      // Update section schedule
      if (!this.sectionSchedule.has(course.sectionId)) {
        this.sectionSchedule.set(course.sectionId, new Set())
      }
      this.sectionSchedule.get(course.sectionId)!.add(key)
    }
    
    return true
  }
}

// Validation function to check schedule completeness
async function validateScheduleCompleteness(
  supabase: any,
  expectedCourses: CourseAssignment[],
  generatedSlots: TimetableSlot[],
  jobId: string
): Promise<{ complete: boolean; missing: any[] }> {
  const missing: any[] = []
  
  // Group slots by section+subject
  const slotsBySubject = new Map<string, number>()
  for (const slot of generatedSlots) {
    const key = `${slot.sectionId}-${slot.subjectId}`
    const periods = slot.endPeriod - slot.startPeriod + 1
    slotsBySubject.set(key, (slotsBySubject.get(key) || 0) + periods)
  }
  
  // Check each expected course
  for (const course of expectedCourses) {
    const key = `${course.sectionId}-${course.subjectId}`
    const scheduledPeriods = slotsBySubject.get(key) || 0
    
    if (course.subjectType === 'lab') {
      // Labs should have exactly 1 block (4 periods)
      if (scheduledPeriods === 0) {
        missing.push({
          section: course.sectionName,
          subject: course.subjectCode,
          type: 'lab',
          expected: '1 lab block (4 periods)',
          scheduled: 0,
          reason: 'Lab not scheduled'
        })
      }
    } else {
      // Theory should match periods_per_week
      if (scheduledPeriods < course.periodsPerWeek) {
        missing.push({
          section: course.sectionName,
          subject: course.subjectCode,
          type: 'theory',
          expected: course.periodsPerWeek,
          scheduled: scheduledPeriods,
          reason: 'Insufficient theory periods'
        })
      }
    }
  }
  
  return {
    complete: missing.length === 0,
    missing
  }
}

// Main Edge Function Handler
Deno.serve(async (req) => {
  try {
    // CORS headers
    if (req.method === "OPTIONS") {
      return new Response("ok", {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        },
      })
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log("[Edge Function] Starting base timetable generation")

    // Create a new job
    const { data: job, error: jobError } = await supabase
      .from("timetable_jobs")
      .insert({
        status: "generating_base",
        progress: 10,
        message: "Fetching data...",
      })
      .select()
      .single()

    if (jobError) {
      console.error("[Edge Function] Job creation error:", jobError)
      throw jobError
    }

    console.log("[Edge Function] Job created:", job.id)

    // Fetch all data needed for generation
    const [sectionSubjectsResult, classroomsResult, availabilityResult] = await Promise.all([
      supabase.from("section_subjects").select("*, sections(*), subjects(*), faculty(*)"),
      supabase.from("classrooms").select("*"),
      supabase.from("faculty_availability").select("*"),
    ])

    const sectionSubjects = sectionSubjectsResult.data
    const classrooms = classroomsResult.data
    const availability = availabilityResult.data

    // Check for database errors
    if (sectionSubjectsResult.error) {
      console.error("[Edge Function] Error fetching section_subjects:", sectionSubjectsResult.error)
      throw new Error(`Database error: ${sectionSubjectsResult.error.message}`)
    }
    if (classroomsResult.error) {
      console.error("[Edge Function] Error fetching classrooms:", classroomsResult.error)
      throw new Error(`Database error: ${classroomsResult.error.message}`)
    }
    if (availabilityResult.error) {
      console.error("[Edge Function] Error fetching availability:", availabilityResult.error)
      throw new Error(`Database error: ${availabilityResult.error.message}`)
    }

    // 🔍 DEBUG: Log raw faculty availability from database
    console.log("[Edge Function] 🔍 DEBUG - Faculty Availability from DB:", JSON.stringify(availability, null, 2))
    const mechF003Avail = availability?.filter(a => {
      // Find MECH-F003 by matching faculty_id
      const facultyMatch = sectionSubjects?.find(ss => ss.faculty?.code === 'MECH-F003')
      return facultyMatch && a.faculty_id === facultyMatch.faculty_id
    })
    const cseF005Avail = availability?.filter(a => {
      const facultyMatch = sectionSubjects?.find(ss => ss.faculty?.code === 'CSE-F005')
      return facultyMatch && a.faculty_id === facultyMatch.faculty_id
    })
    console.log("[Edge Function] 🔍 DEBUG - MECH-F003 availability windows:", mechF003Avail?.length || 0, mechF003Avail)
    console.log("[Edge Function] 🔍 DEBUG - CSE-F005 availability windows:", cseF005Avail?.length || 0, cseF005Avail)

    if (!sectionSubjects || !classrooms) {
      await supabase
        .from("timetable_jobs")
        .update({ status: "failed", message: "Missing required data" })
        .eq("id", job.id)
      
      return new Response(
        JSON.stringify({ error: "Missing required data" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      )
    }

    // Update progress
    await supabase
      .from("timetable_jobs")
      .update({ progress: 30, message: "Preparing course assignments..." })
      .eq("id", job.id)

    // Transform data for ILP solver
    const courses: CourseAssignment[] = sectionSubjects.map((ss: any) => ({
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

    const classroomOptions: ClassroomOption[] = classrooms.map((c: any) => ({
      id: c.id,
      name: c.name,
      capacity: c.capacity,
      roomType: c.room_type,
    }))

    const facultyAvailability: FacultyAvailabilitySlot[] =
      availability?.map((a: any) => ({
        facultyId: a.faculty_id,
        dayOfWeek: a.day_of_week,
        startPeriod: a.start_period,
        endPeriod: a.end_period,
      })) || []

    // Update progress
    await supabase
      .from("timetable_jobs")
      .update({ progress: 50, message: "Running ILP solver..." })
      .eq("id", job.id)

    // Run ILP generation
    const startTime = Date.now()
    const generator = new ILPTimetableGenerator(courses, classroomOptions, facultyAvailability)
    const timetableSlots = await generator.generate()
    const generationTime = Date.now() - startTime

    console.log("[Edge Function] Generation completed in", generationTime, "ms")

    // Update progress
    await supabase
      .from("timetable_jobs")
      .update({ progress: 80, message: "Saving timetable..." })
      .eq("id", job.id)

    // Save to database
    const slotsToInsert = timetableSlots.map((slot) => ({
      job_id: job.id,
      section_id: slot.sectionId,
      subject_id: slot.subjectId,
      faculty_id: slot.facultyId,
      classroom_id: slot.classroomId,
      day_of_week: slot.day,
      start_period: slot.startPeriod,
      end_period: slot.endPeriod,
    }))

    const { error: insertError } = await supabase.from("timetable_base").insert(slotsToInsert)

    if (insertError) {
      console.error("[Edge Function] Insert error:", insertError)
      await supabase
        .from("timetable_jobs")
        .update({ status: "failed", message: "Error saving timetable: " + insertError.message })
        .eq("id", job.id)
      
      return new Response(
        JSON.stringify({ error: insertError.message }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      )
    }

    // VALIDATION: Check completeness
    console.log("[Edge Function] Validating schedule completeness...")
    const validation = await validateScheduleCompleteness(supabase, courses, timetableSlots, job.id)
    
    if (!validation.complete) {
      console.error("[Edge Function] ❌ INCOMPLETE SCHEDULE:", validation.missing)
      await supabase
        .from("timetable_jobs")
        .update({
          status: "failed",
          message: `Incomplete schedule: ${validation.missing.length} subject(s) not fully scheduled`,
        })
        .eq("id", job.id)
      
      return new Response(
        JSON.stringify({
          success: false,
          error: "INCOMPLETE_SCHEDULE",
          details: validation.missing,
          message: `Generated timetable is incomplete. ${validation.missing.length} subject(s) not fully scheduled.`,
        }),
        {
          status: 422,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      )
    }
    
    console.log("[Edge Function] ✅ Schedule completeness validated")

    // Update job status
    await supabase
      .from("timetable_jobs")
      .update({
        status: "base_complete",
        progress: 100,
        message: `Base timetable generated successfully (${timetableSlots.length} slots in ${generationTime}ms)`,
        base_generation_time: generationTime,
      })
      .eq("id", job.id)

    console.log("[Edge Function] Job completed successfully")

    return new Response(
      JSON.stringify({
        success: true,
        jobId: job.id,
        slotsGenerated: timetableSlots.length,
        generationTime,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    )
  } catch (error) {
    console.error("[Edge Function] Error:", error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    )
  }
})
