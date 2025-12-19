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
  LAB_PERIODS: 3, // 3 consecutive periods = 2.25 hours (once per week)
  PERIOD_DURATION_MINS: 45,
  LUNCH_START_PERIOD: 4.5,
  LUNCH_END_PERIOD: 5,
  MAX_THEORY_PERIODS_PER_DAY_PER_SUBJECT: 2, // CRITICAL: Theory subject max 2 periods/day (prevents 3-period blocks on same day)
  MAX_THEORY_BLOCK_SIZE: 2, // Max periods to schedule in one block (changed from 3 to 2)
  MAX_SECTION_PERIODS_PER_DAY: 6, // Total periods per section per day (allows 4-5 subjects)
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
  
  // FACULTY WORKLOAD: For day-balancing constraint
  // Stores total theory periods each faculty needs to teach
  private facultyTotalWorkload: Map<string, number> = new Map()  // facultyId -> total theory periods needed
  private facultyMaxPerDay: Map<string, number> = new Map()      // facultyId -> max periods per day (calculated)
  
  // RELAXED MODE: Disables day-balancing constraint for more flexibility
  private relaxedMode: boolean = false
  
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
    // CRITICAL: Initialize for ALL faculty (including theory-only faculty not in initial courses)
    const allFacultyIds = new Set<string>()
    
    // Add faculty from courses
    for (const course of courses) {
      allFacultyIds.add(course.facultyId)
    }
    
    // Add faculty from facultyAvailability array (includes theory-only faculty)
    for (const slot of facultyAvailability) {
      allFacultyIds.add(slot.facultyId)
    }
    
    console.log(`[Init] Initializing dynamic availability for ${allFacultyIds.size} faculty members`)
    
    for (const facultyId of allFacultyIds) {
      if (!this.facultyDynamicAvailability.has(facultyId)) {
        const availableSlots = new Set<string>()
        const facultyAvail = this.facultyAvailability.get(facultyId) || []
        
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
        
        this.facultyDynamicAvailability.set(facultyId, availableSlots)
        console.log(`[Init] Faculty ${facultyId}: ${availableSlots.size} available slots`)
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
    
    // Calculate faculty THEORY workload for day-balancing
    // This ensures high-workload faculty spread their teaching across all days
    const theoryCourses = courses.filter(c => c.subjectType === 'theory')
    for (const course of theoryCourses) {
      const current = this.facultyTotalWorkload.get(course.facultyId) || 0
      this.facultyTotalWorkload.set(course.facultyId, current + course.periodsPerWeek)
    }
    
    // Calculate max periods per day for each faculty
    // Formula: ceil(totalWorkload / 6 days) + 3 buffer
    // This prevents over-scheduling on certain days while allowing flexibility
    for (const [facultyId, totalWorkload] of this.facultyTotalWorkload.entries()) {
      // For faculty with 32 periods: 32/6 = 5.3 -> ceil = 6, +3 buffer = 9
      // For faculty with 28 periods: 28/6 = 4.7 -> ceil = 5, +3 buffer = 8
      // This allows imbalance but prevents extreme clustering
      const maxPerDay = Math.ceil(totalWorkload / 6) + 3
      this.facultyMaxPerDay.set(facultyId, maxPerDay)
      console.log(`[Init] Faculty ${facultyId}: ${totalWorkload} theory periods, max ${maxPerDay}/day`)
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

  // ==========================================
  // ENHANCED GREEDY: Theory Course Prioritization
  // ==========================================
  
  private prioritizeTheoryCourses(theoryCourses: CourseAssignment[]): CourseAssignment[] {
    // Calculate difficulty score for each course
    // Higher score = harder to schedule = higher priority
    
    // CRITICAL: Calculate faculty workload first (total periods they need to teach)
    const facultyWorkload = new Map<string, number>()
    for (const course of theoryCourses) {
      const current = facultyWorkload.get(course.facultyId) || 0
      facultyWorkload.set(course.facultyId, current + course.periodsPerWeek)
    }
    
    const courseDifficulty = new Map<string, number>()
    
    for (const course of theoryCourses) {
      let difficulty = 0
      
      // 1. More periods per week = harder (weight: 10 per period)
      difficulty += course.periodsPerWeek * 10
      
      // 2. Larger student count = fewer room options (weight: 0.1 per student)
      difficulty += course.studentCount * 0.1
      
      // 3. Faculty with limited availability = harder (weight: 5 per missing slot)
      const facultySlots = this.facultyAvailability.get(course.facultyId)
      const maxSlots = 6 * 8 // 6 days × 8 periods
      const availableSlots = facultySlots?.reduce((sum, slot) => 
        sum + (slot.endPeriod - slot.startPeriod + 1), 0) || maxSlots
      difficulty += (maxSlots - availableSlots) * 0.5
      
      // 4. Sections with many courses = harder (weight: 3 per course)
      const sectionCourseCount = theoryCourses.filter(c => c.sectionId === course.sectionId).length
      difficulty += sectionCourseCount * 3
      
      // 5. Year 1 courses have Saturday restrictions (weight: 5)
      if (course.yearLevel === 1) {
        difficulty += 5
      }
      
      // 6. CRITICAL: Faculty with high workload = much harder (weight: 2 per period)
      // This ensures heavily-loaded faculty get scheduled first
      const workload = facultyWorkload.get(course.facultyId) || 0
      difficulty += workload * 2
      
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

  // Store ILP error for diagnostics
  private ilpError: string | null = null
  
  getILPError(): string | null {
    return this.ilpError
  }

  /**
   * STRATEGY 1: Section-First Ordering
   * Schedule ALL courses for each section together before moving to next section.
   * Within each section, prioritize high-workload faculty first.
   * This prevents section fragmentation - ensures each section's schedule is built coherently.
   */
  private orderBySectionFirst(theoryCourses: CourseAssignment[]): CourseAssignment[] {
    // Calculate faculty workload for prioritization
    const facultyWorkload = new Map<string, number>()
    for (const course of theoryCourses) {
      const current = facultyWorkload.get(course.facultyId) || 0
      facultyWorkload.set(course.facultyId, current + course.periodsPerWeek)
    }
    
    // Group courses by section
    const coursesBySection = new Map<string, CourseAssignment[]>()
    for (const course of theoryCourses) {
      const existing = coursesBySection.get(course.sectionId) || []
      existing.push(course)
      coursesBySection.set(course.sectionId, existing)
    }
    
    // Sort sections by total faculty workload (sections with busier faculty first)
    const sortedSections = Array.from(coursesBySection.entries())
      .sort((a, b) => {
        const aTotalWorkload = a[1].reduce((sum, c) => facultyWorkload.get(c.facultyId) || 0, 0)
        const bTotalWorkload = b[1].reduce((sum, c) => facultyWorkload.get(c.facultyId) || 0, 0)
        return bTotalWorkload - aTotalWorkload
      })
    
    // Within each section, sort by faculty workload (highest first)
    const result: CourseAssignment[] = []
    for (const [, courses] of sortedSections) {
      const sortedCourses = courses.slice().sort((a, b) => {
        const aWorkload = facultyWorkload.get(a.facultyId) || 0
        const bWorkload = facultyWorkload.get(b.facultyId) || 0
        return bWorkload - aWorkload
      })
      result.push(...sortedCourses)
    }
    
    console.log(`[Phase 2A] Section-first: ${sortedSections.length} sections, high-workload faculty first within each`)
    return result
  }

  /**
   * STRATEGY 2: Faculty-Interleaved Ordering
   * Schedule one section per faculty at a time in round-robin.
   * Prevents any single faculty from having all their sections scheduled consecutively.
   */
  private orderByFacultyInterleaved(theoryCourses: CourseAssignment[]): CourseAssignment[] {
    // Group courses by faculty
    const coursesByFaculty = new Map<string, CourseAssignment[]>()
    for (const course of theoryCourses) {
      const existing = coursesByFaculty.get(course.facultyId) || []
      existing.push(course)
      coursesByFaculty.set(course.facultyId, existing)
    }
    
    // Sort faculty by workload (highest first) to prioritize busy faculty
    const sortedFaculty = Array.from(coursesByFaculty.entries())
      .sort((a, b) => {
        const aWorkload = a[1].reduce((sum, c) => sum + c.periodsPerWeek, 0)
        const bWorkload = b[1].reduce((sum, c) => sum + c.periodsPerWeek, 0)
        return bWorkload - aWorkload
      })
    
    // Interleave: take one course from each faculty in round-robin fashion
    const result: CourseAssignment[] = []
    let maxCourses = 0
    for (const [, courses] of sortedFaculty) {
      maxCourses = Math.max(maxCourses, courses.length)
    }
    
    for (let i = 0; i < maxCourses; i++) {
      for (const [, courses] of sortedFaculty) {
        if (i < courses.length) {
          result.push(courses[i])
        }
      }
    }
    
    console.log(`[Phase 2A] Faculty-interleaved: ${sortedFaculty.length} faculty, ${result.length} courses`)
    return result
  }

  /**
   * STRATEGY 3: Most Constrained First (MCV Heuristic)
   * Schedule courses where faculty has the LEAST remaining availability first.
   * This is a constraint satisfaction heuristic - most constrained variable first.
   */
  private orderByMostConstrainedFirst(theoryCourses: CourseAssignment[]): CourseAssignment[] {
    // Calculate effective availability for each course
    // Lower = more constrained = higher priority
    const courseConstraint = new Map<string, number>()
    
    for (const course of theoryCourses) {
      const courseId = `${course.sectionId}-${course.subjectId}`
      
      // Get faculty's available slots
      const facultySlots = this.facultyDynamicAvailability.get(course.facultyId)?.size || 48
      
      // Get section's available slots (48 - already scheduled)
      const sectionScheduled = this.sectionSchedule.get(course.sectionId)?.size || 0
      const sectionSlots = 48 - sectionScheduled
      
      // Constraint = minimum of faculty and section availability
      // Divide by periods needed to get "flexibility"
      const flexibility = Math.min(facultySlots, sectionSlots) / course.periodsPerWeek
      
      courseConstraint.set(courseId, flexibility)
    }
    
    // Sort by flexibility (lowest first = most constrained first)
    return theoryCourses.slice().sort((a, b) => {
      const aId = `${a.sectionId}-${a.subjectId}`
      const bId = `${b.sectionId}-${b.subjectId}`
      return (courseConstraint.get(aId) || 0) - (courseConstraint.get(bId) || 0)
    })
  }

  // Fisher-Yates shuffle for randomized ordering
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = array.slice()
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  // Track which courses had periods reduced for reporting
  private reducedCourses: { courseId: string; originalPeriods: number; newPeriods: number }[] = []
  private fallbackApplied: boolean = false
  
  getReducedCourses(): { courseId: string; originalPeriods: number; newPeriods: number }[] {
    return this.reducedCourses
  }

  isFallbackApplied(): boolean {
    return this.fallbackApplied
  }

  /**
   * FALLBACK: Reduce theory periods when ILP fails or allocation is too tight
   * NEW STRATEGY: 1 subject per section reduced from 4 to 2 periods/week
   * This gives each section: (4 subjects × 4 periods) + (1 subject × 2 periods) = 18 periods/week
   * For 15 sections: 15 × 18 = 270 periods (vs 288 available = 93.75% utilization)
   */
  private applyTheoryPeriodReductionFallback(theoryCourses: CourseAssignment[], theoryRooms: ClassroomOption[]): CourseAssignment[] {
    // Calculate theory capacity
    const theoryPeriodsAvailable = theoryRooms.length * 48 // 6 days * 8 periods per room
    const theoryPeriodsNeeded = theoryCourses.reduce((sum, c) => sum + c.periodsPerWeek, 0)
    const utilization = theoryPeriodsNeeded / theoryPeriodsAvailable
    
    console.log(`[Fallback] Theory capacity check: ${theoryPeriodsNeeded} periods needed, ${theoryPeriodsAvailable} available (${(utilization * 100).toFixed(0)}% utilization)`)
    
    // Only apply fallback if utilization exceeds 95%
    if (utilization <= 0.95) {
      console.log(`[Fallback] Utilization ${(utilization * 100).toFixed(0)}% <= 95%, no reduction needed`)
      return theoryCourses
    }
    
    console.log(`[Fallback] ⚠️ Utilization ${(utilization * 100).toFixed(0)}% > 95% - applying period reduction fallback`)
    this.fallbackApplied = true
    
    // Group theory courses by section
    const coursesBySection = new Map<string, CourseAssignment[]>()
    for (const course of theoryCourses) {
      if (!coursesBySection.has(course.sectionId)) {
        coursesBySection.set(course.sectionId, [])
      }
      coursesBySection.get(course.sectionId)!.push(course)
    }
    
    // NEW STRATEGY: Reduce exactly 1 subject per section from 4 to 2 periods
    // This saves 2 periods per section (4-2=2)
    const modifiedCourses: CourseAssignment[] = []
    
    for (const [sectionId, sectionCourses] of coursesBySection) {
      // Sort by faculty availability - reduce subjects with most flexible faculty first
      const sortedCourses = sectionCourses.slice().sort((a, b) => {
        const aAvail = this.facultyAvailability.get(a.facultyId)?.length || 48
        const bAvail = this.facultyAvailability.get(b.facultyId)?.length || 48
        return bAvail - aAvail // Higher availability = reduce first
      })
      
      let reductionApplied = false
      
      for (const course of sortedCourses) {
        // Reduce exactly 1 course per section from 4 to 2 periods
        if (!reductionApplied && course.periodsPerWeek >= 4) {
          const newPeriods = 2 // Reduce from 4 to 2 periods/week
          
          this.reducedCourses.push({
            courseId: `${course.subjectCode} (${course.sectionName})`,
            originalPeriods: course.periodsPerWeek,
            newPeriods: newPeriods
          })
          
          console.log(`[Fallback] 📉 Reducing ${course.subjectCode} (${course.sectionName}): ${course.periodsPerWeek} → ${newPeriods} periods/week`)
          
          modifiedCourses.push({
            ...course,
            periodsPerWeek: newPeriods
          })
          
          reductionApplied = true
        } else {
          // Keep original periods
          modifiedCourses.push(course)
        }
      }
    }
    
    const newTotalPeriods = modifiedCourses.reduce((sum, c) => sum + c.periodsPerWeek, 0)
    const newUtilization = newTotalPeriods / theoryPeriodsAvailable
    const periodsSaved = theoryPeriodsNeeded - newTotalPeriods
    
    console.log(`[Fallback] ✅ After reduction: ${newTotalPeriods} periods needed (${(newUtilization * 100).toFixed(0)}% utilization)`)
    console.log(`[Fallback] Reduced ${this.reducedCourses.length} courses, saved ${periodsSaved} periods`)
    
    return modifiedCourses
  }

  async generate(): Promise<TimetableSlot[]> {
    console.log(`[Generation] Starting - ${this.courses.length} courses (${this.courses.filter(c => c.subjectType === "lab").length} labs, ${this.courses.filter(c => c.subjectType === "theory").length} theory)`)

    const labCourses = this.courses.filter((c) => c.subjectType === "lab")
    let theoryCourses = this.courses.filter((c) => c.subjectType === "theory")
    
    // Get theory rooms for capacity check
    const theoryRooms = this.classrooms.filter((c) => c.roomType === "theory")

    // PRIORITIZATION: Sort labs by difficulty
    const prioritizedLabs = this.prioritizeLabCourses(labCourses)

    console.log("[Phase 1] Scheduling labs using ILP solver...")
    
    let ilpFailed = false
    try {
      const labsScheduled = await this.scheduleLabsWithExternalSolver(prioritizedLabs)
      console.log(`[Phase 1] ✅ Complete - ${labsScheduled}/${prioritizedLabs.length} labs scheduled`)
    } catch (error) {
      ilpFailed = true
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.ilpError = errorMessage
      console.error(`[ERROR] ILP solver failed:`, errorMessage)
      console.log(`[Phase 1] Falling back to greedy algorithm...`)
      
      let labsScheduled = 0
      for (const course of labCourses) {
        const scheduled = this.scheduleLabCourse(course)
        if (scheduled) labsScheduled++
      }
      console.log(`[Phase 1] Greedy fallback: ${labsScheduled}/${labCourses.length} labs scheduled`)
      
      // If greedy also failed to schedule all labs, this is a critical error
      if (labsScheduled < labCourses.length) {
        console.error(`[Phase 1] ❌ CRITICAL: Only ${labsScheduled}/${labCourses.length} labs scheduled. Lab room shortage likely.`)
      }
    }

    // ==========================================
    // PHASE 2: THEORY SCHEDULING
    // Strategy: Use GREEDY first, then ILP fallback if greedy fails
    // ==========================================
    console.log(`[Phase 2] Theory scheduling: ${theoryCourses.length} courses...`)
    
    // Save current state (after labs are scheduled)
    const labTimetable = [...this.timetable]
    const labFacultySchedule = new Map(this.facultySchedule)
    const labRoomSchedule = new Map(this.roomSchedule)
    const labSectionSchedule = new Map(this.sectionSchedule)
    const labFacultyDynamic = new Map(this.facultyDynamicAvailability)
    const labRoomDynamic = new Map(this.roomDynamicAvailability)
    
    // ==========================================
    // CRITICAL: Log faculty availability AFTER labs are scheduled
    // ==========================================
    console.warn(`[Phase 2] 📊 FACULTY AVAILABILITY AFTER LABS:`)
    
    // Calculate theory periods needed per faculty
    const facultyTheoryNeeded = new Map<string, number>()
    const facultyTheorySections = new Map<string, string[]>()
    for (const course of theoryCourses) {
      const current = facultyTheoryNeeded.get(course.facultyId) || 0
      facultyTheoryNeeded.set(course.facultyId, current + course.periodsPerWeek)
      
      const sections = facultyTheorySections.get(course.facultyId) || []
      sections.push(`${course.sectionName}-${course.subjectCode}`)
      facultyTheorySections.set(course.facultyId, sections)
    }
    
    // Log faculty with heavy theory load and their remaining availability
    for (const [facultyId, periodsNeeded] of facultyTheoryNeeded.entries()) {
      if (periodsNeeded >= 16) { // Faculty with 4+ sections (4 periods each)
        const remainingSlots = labFacultyDynamic.get(facultyId)?.size || 0
        const labSlotsTaken = labFacultySchedule.get(facultyId)?.size || 0
        const course = theoryCourses.find(c => c.facultyId === facultyId)
        const facultyCode = course?.facultyCode || facultyId
        
        if (remainingSlots < periodsNeeded) {
          console.error(`[Phase 2] ❌ OVERLOAD: Faculty ${facultyCode} needs ${periodsNeeded} theory periods but only has ${remainingSlots} slots remaining (${labSlotsTaken} used by labs)`)
          const sections = facultyTheorySections.get(facultyId) || []
          console.error(`[Phase 2]    Courses: ${sections.join(', ')}`)
        } else {
          console.warn(`[Phase 2] ⚠️ Heavy Load: Faculty ${facultyCode} needs ${periodsNeeded} theory periods, has ${remainingSlots} remaining (${labSlotsTaken} used by labs)`)
        }
      }
    }

    // Calculate available slots after lab scheduling
    const totalPeriodsNeeded = theoryCourses.reduce((sum, c) => sum + c.periodsPerWeek, 0)
    
    // ==========================================
    // PHASE 2A: GREEDY SCHEDULING for theory (Primary approach)
    // ==========================================
    console.log(`[Phase 2A] Enhanced Greedy: Scheduling theory courses...`)
    let greedyTheorySuccess = false
    let bestGreedyResult: {
      timetable: TimetableSlot[]
      totalPeriods: number
      fullyScheduled: number
      partiallyScheduled: number
      failed: number
    } | null = null
    
    // Multiple attempts with different orderings to find best schedule
    // More attempts = better chance of finding valid schedule
    // Attempts 1-10: Normal mode with day-balancing
    // Attempts 11-15: Relaxed mode without day-balancing constraint
    const NUM_ATTEMPTS = 15
    
    for (let attempt = 1; attempt <= NUM_ATTEMPTS; attempt++) {
      // Reset to post-lab state for each attempt
      this.timetable = [...labTimetable]
      this.facultySchedule = new Map([...labFacultySchedule].map(([k, v]) => [k, new Set(v)]))
      this.roomSchedule = new Map([...labRoomSchedule].map(([k, v]) => [k, new Set(v)]))
      this.sectionSchedule = new Map([...labSectionSchedule].map(([k, v]) => [k, new Set(v)]))
      this.facultyDynamicAvailability = new Map([...labFacultyDynamic].map(([k, v]) => [k, new Set(v)]))
      this.roomDynamicAvailability = new Map([...labRoomDynamic].map(([k, v]) => [k, new Set(v)]))
      this.courseProgress = new Map()
      
      // RELAXED MODE: Disable day-balancing for attempts 11+
      // This gives more flexibility when strict constraints fail
      this.relaxedMode = attempt > 10
      if (this.relaxedMode && attempt === 11) {
        console.log(`[Phase 2A] 🔓 Entering RELAXED MODE (no day-balancing constraint)`)
      }
      
      // Determine ordering strategy for this attempt
      // Each strategy addresses different types of conflicts
      let orderedCourses: CourseAssignment[]
      switch (attempt) {
        case 1:
          // Strategy 1: Section-First - schedule all courses for each section together
          // Prevents section fragmentation (CSE-2A gets all its courses before CSE-2B)
          orderedCourses = this.orderBySectionFirst(theoryCourses)
          console.log(`[Phase 2A] Attempt ${attempt}/${NUM_ATTEMPTS}: Section-first ordering`)
          break
        case 2:
          // Strategy 2: Most Constrained First - prioritize courses with fewest options
          orderedCourses = this.orderByMostConstrainedFirst(theoryCourses)
          console.log(`[Phase 2A] Attempt ${attempt}/${NUM_ATTEMPTS}: Most-constrained-first ordering`)
          break
        case 3:
          // Strategy 3: Faculty-interleaved - spread sections across faculty
          orderedCourses = this.orderByFacultyInterleaved(theoryCourses)
          console.log(`[Phase 2A] Attempt ${attempt}/${NUM_ATTEMPTS}: Faculty-interleaved ordering`)
          break
        case 4:
          // Strategy 4: Priority-based (hardest courses first)
          orderedCourses = this.prioritizeTheoryCourses(theoryCourses)
          console.log(`[Phase 2A] Attempt ${attempt}/${NUM_ATTEMPTS}: Priority-based ordering`)
          break
        case 5:
          // Strategy 5: Reverse section-first (last sections first)
          orderedCourses = this.orderBySectionFirst(theoryCourses).reverse()
          console.log(`[Phase 2A] Attempt ${attempt}/${NUM_ATTEMPTS}: Reverse section-first ordering`)
          break
        case 11:
          // Relaxed: Section-first without day-balancing
          orderedCourses = this.orderBySectionFirst(theoryCourses)
          console.log(`[Phase 2A] Attempt ${attempt}/${NUM_ATTEMPTS}: RELAXED Section-first`)
          break
        case 12:
          // Relaxed: Most constrained first
          orderedCourses = this.orderByMostConstrainedFirst(theoryCourses)
          console.log(`[Phase 2A] Attempt ${attempt}/${NUM_ATTEMPTS}: RELAXED Most-constrained-first`)
          break
        default:
          // Remaining attempts: Randomized ordering for diversity
          orderedCourses = this.shuffleArray(theoryCourses)
          console.log(`[Phase 2A] Attempt ${attempt}/${NUM_ATTEMPTS}: Randomized ordering`)
      }
      
      // Schedule theory courses with this ordering
      let fullyScheduled = 0
      let partiallyScheduled = 0
      let failed = 0
      let totalPeriodsScheduled = 0
      
      for (const course of orderedCourses) {
        const progress = this.scheduleTheoryCourse(course)
        totalPeriodsScheduled += progress
        
        if (progress === course.periodsPerWeek) {
          fullyScheduled++
        } else if (progress >= 1) {
          partiallyScheduled++
        } else {
          failed++
        }
      }
      
      const successRate = (totalPeriodsScheduled / totalPeriodsNeeded * 100).toFixed(1)
      console.log(`[Phase 2A] Attempt ${attempt} result: ${fullyScheduled} full, ${partiallyScheduled} partial, ${failed} failed (${successRate}% periods scheduled)`)
      
      // Check if this is the best result so far
      if (!bestGreedyResult || totalPeriodsScheduled > bestGreedyResult.totalPeriods) {
        bestGreedyResult = {
          timetable: [...this.timetable],
          totalPeriods: totalPeriodsScheduled,
          fullyScheduled,
          partiallyScheduled,
          failed
        }
        console.log(`[Phase 2A] ⭐ New best result: ${successRate}% periods scheduled`)
        
        // Early exit if we achieved 100% scheduling
        if (totalPeriodsScheduled === totalPeriodsNeeded) {
          console.log(`[Phase 2A] 🎯 Perfect schedule achieved! Skipping remaining attempts.`)
          greedyTheorySuccess = true
          break
        }
      }
    }
    
    // Use best greedy result
    if (bestGreedyResult) {
      this.timetable = bestGreedyResult.timetable
      const finalSuccessRate = (bestGreedyResult.totalPeriods / totalPeriodsNeeded * 100).toFixed(1)
      console.log(`[Phase 2A] ✅ Greedy complete - Best result: ${bestGreedyResult.fullyScheduled} fully scheduled, ${bestGreedyResult.partiallyScheduled} partial, ${bestGreedyResult.failed} failed`)
      console.log(`[Phase 2A] 📊 Greedy success rate: ${finalSuccessRate}% (${bestGreedyResult.totalPeriods}/${totalPeriodsNeeded} periods)`)
      
      // Check if greedy was successful enough (≥80%)
      if (bestGreedyResult.totalPeriods / totalPeriodsNeeded >= 0.8) {
        greedyTheorySuccess = true
        console.log(`[Phase 2A] ✅ Greedy achieved ≥80% success - proceeding without ILP fallback`)
      }
    }

    // ==========================================
    // PHASE 2B: ILP FALLBACK for theory (only if greedy failed)
    // ==========================================
    if (!greedyTheorySuccess) {
      console.warn(`[Phase 2B] ⚠️ Greedy success rate below 80% - triggering ILP fallback for theory scheduling...`)
      
      // Reset to post-lab state
      this.timetable = [...labTimetable]
      this.facultySchedule = new Map([...labFacultySchedule].map(([k, v]) => [k, new Set(v)]))
      this.roomSchedule = new Map([...labRoomSchedule].map(([k, v]) => [k, new Set(v)]))
      this.sectionSchedule = new Map([...labSectionSchedule].map(([k, v]) => [k, new Set(v)]))
      this.facultyDynamicAvailability = new Map([...labFacultyDynamic].map(([k, v]) => [k, new Set(v)]))
      this.roomDynamicAvailability = new Map([...labRoomDynamic].map(([k, v]) => [k, new Set(v)]))
      this.courseProgress = new Map()
      
      try {
        console.log(`[Phase 2B] 🔄 Attempting ILP solver for theory courses...`)
        const ilpResult = await this.scheduleTheoryWithILP(theoryCourses)
        
        if (ilpResult.success && ilpResult.periodsScheduled > 0) {
          // ILP succeeded - use its results
          for (const slot of ilpResult.slots) {
            this.timetable.push(slot)
            // Update tracking
            const slotKey = `${slot.day}-${slot.startPeriod}`
            if (!this.facultySchedule.has(slot.facultyId)) this.facultySchedule.set(slot.facultyId, new Set())
            if (!this.roomSchedule.has(slot.classroomId)) this.roomSchedule.set(slot.classroomId, new Set())
            if (!this.sectionSchedule.has(slot.sectionId)) this.sectionSchedule.set(slot.sectionId, new Set())
            this.facultySchedule.get(slot.facultyId)!.add(slotKey)
            this.roomSchedule.get(slot.classroomId)!.add(slotKey)
            this.sectionSchedule.get(slot.sectionId)!.add(slotKey)
          }
          
          const successRate = (ilpResult.periodsScheduled / totalPeriodsNeeded * 100).toFixed(1)
          console.log(`[Phase 2B] ✅ ILP theory scheduling succeeded: ${ilpResult.periodsScheduled}/${totalPeriodsNeeded} periods (${successRate}%)`)
        } else {
          console.warn(`[Phase 2B] ⚠️ ILP solver returned no valid solution`)
        }
      } catch (ilpError) {
        const errorMsg = ilpError instanceof Error ? ilpError.message : String(ilpError)
        console.warn(`[Phase 2B] ⚠️ ILP theory solver failed: ${errorMsg}`)
        
        // Check if it's INFEASIBLE - apply fallback
        if (errorMsg.includes('INFEASIBLE') || errorMsg.includes('No valid slots')) {
          console.log(`[Phase 2B] 🔄 ILP INFEASIBLE - Applying period reduction fallback...`)
          
          // Apply fallback: reduce 1 subject per section from 4 to 2 periods
          theoryCourses = this.applyTheoryPeriodReductionFallback(theoryCourses, theoryRooms)
          
          // Retry ILP with reduced courses
          console.log(`[Phase 2B] 🔄 Retrying ILP with reduced theory courses...`)
          try {
            const retryResult = await this.scheduleTheoryWithILP(theoryCourses)
            
            if (retryResult.success && retryResult.periodsScheduled > 0) {
              // Reset to lab state and apply retry result
              this.timetable = [...labTimetable]
              this.facultySchedule = new Map([...labFacultySchedule].map(([k, v]) => [k, new Set(v)]))
              this.roomSchedule = new Map([...labRoomSchedule].map(([k, v]) => [k, new Set(v)]))
              this.sectionSchedule = new Map([...labSectionSchedule].map(([k, v]) => [k, new Set(v)]))
              
              for (const slot of retryResult.slots) {
                this.timetable.push(slot)
                const slotKey = `${slot.day}-${slot.startPeriod}`
                if (!this.facultySchedule.has(slot.facultyId)) this.facultySchedule.set(slot.facultyId, new Set())
                if (!this.roomSchedule.has(slot.classroomId)) this.roomSchedule.set(slot.classroomId, new Set())
                if (!this.sectionSchedule.has(slot.sectionId)) this.sectionSchedule.set(slot.sectionId, new Set())
                this.facultySchedule.get(slot.facultyId)!.add(slotKey)
                this.roomSchedule.get(slot.classroomId)!.add(slotKey)
                this.sectionSchedule.get(slot.sectionId)!.add(slotKey)
              }
              
              const newTotal = theoryCourses.reduce((sum, c) => sum + c.periodsPerWeek, 0)
              const successRate = (retryResult.periodsScheduled / newTotal * 100).toFixed(1)
              console.log(`[Phase 2B] ✅ ILP retry succeeded after fallback: ${retryResult.periodsScheduled}/${newTotal} periods (${successRate}%)`)
            }
          } catch (retryError) {
            console.warn(`[Phase 2B] ⚠️ ILP retry also failed:`, retryError instanceof Error ? retryError.message : String(retryError))
            // Fall back to best greedy result
            if (bestGreedyResult) {
              console.log(`[Phase 2B] 🔄 Reverting to greedy result...`)
              this.timetable = bestGreedyResult.timetable
            }
          }
        } else {
          // Non-INFEASIBLE error, fall back to greedy
          if (bestGreedyResult) {
            console.log(`[Phase 2B] 🔄 ILP failed, using greedy result...`)
            this.timetable = bestGreedyResult.timetable
          }
        }
      }
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
    console.log(`[ILP] 🔍 Lab rooms being sent:`, labRooms.map(r => ({ id: r.id, name: r.name, capacity: r.capacity })))

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
        // Provide detailed error for INFEASIBLE problems
        const labBlocksNeeded = labCourses.length
        const labBlocksAvailable = labRooms.length * 12 // 2 blocks/day * 6 days
        const utilizationPercent = (labBlocksNeeded / labBlocksAvailable * 100).toFixed(0)
        
        let detailedMessage = result.message || "Solver failed to find a solution"
        if (result.status === "INFEASIBLE" || detailedMessage.includes("INFEASIBLE")) {
          detailedMessage = `Lab scheduling INFEASIBLE: ${labRooms.length} lab rooms provide ${labBlocksAvailable} blocks, but ${labBlocksNeeded} labs need scheduling (${utilizationPercent}% utilization). `
          if (labBlocksNeeded >= labBlocksAvailable) {
            const roomsNeeded = Math.ceil(labBlocksNeeded / 12 * 1.5) // 50% slack
            detailedMessage += `Add ${roomsNeeded - labRooms.length} more lab room(s) to achieve 50% slack.`
          } else {
            detailedMessage += `Faculty conflicts may be preventing valid assignments. Check if the same faculty teaches too many sections.`
          }
        }
        throw new Error(detailedMessage)
      }

      console.log(`[ILP] Solution status: ${result.status}`)
      console.log(`[ILP] Processing ${result.assignments.length} lab assignments...`)

      // 🔍 DEBUG: Log first few assignments to see format
      console.log("[ILP] 🔍 DEBUG - Sample assignments from solver:")
      for (let i = 0; i < Math.min(3, result.assignments.length); i++) {
        const a = result.assignments[i]
        console.log(`  Assignment ${i}: Section=${a.sectionId}, Subject=${a.subjectId}, Day=${a.day}, Periods=${a.startPeriod}-${a.endPeriod}, Room=${a.roomId}`)
      }

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

        console.log(`[ILP] Processing ${course.subjectCode} (${course.sectionName}): Day ${assignment.day}, P${assignment.startPeriod}-${assignment.endPeriod}, Room=${assignment.roomId}`)

        // 🔍 CRITICAL: Validate that the assigned room exists in our filtered classroom list
        const assignedRoom = this.classrooms.find(r => r.id === assignment.roomId)
        if (!assignedRoom) {
          console.error(`[ERROR] 🚨 ILP solver assigned invalid room ${assignment.roomId} - not in our filtered classroom list!`)
          console.error(`[ERROR] Available rooms:`, this.classrooms.map(r => ({ id: r.id, name: r.name })))
          skippedLabs++
          skippedDetails.push(`${course.subjectCode} (${course.sectionName}) - Invalid room ${assignment.roomId}`)
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

  /**
   * ILP FALLBACK for Theory Scheduling
   * Called when greedy algorithm achieves < 80% success rate
   * Uses external ILP solver to optimally schedule remaining theory courses
   */
  private async scheduleTheoryWithILP(theoryCourses: CourseAssignment[]): Promise<{
    success: boolean
    periodsScheduled: number
    slots: TimetableSlot[]
  }> {
    if (theoryCourses.length === 0) {
      return { success: true, periodsScheduled: 0, slots: [] }
    }

    const theoryRooms = this.classrooms.filter((r) => r.roomType === "theory")
    console.log(`[ILP Theory] Sending ${theoryCourses.length} theory courses to solver (${theoryRooms.length} rooms available)`)

    // Get existing assignments (labs + already scheduled theory) for constraint checking
    const existingAssignments = this.timetable.map((slot) => ({
      sectionId: slot.sectionId,
      day: slot.day,
      startPeriod: slot.startPeriod,
      endPeriod: slot.endPeriod,
      facultyId: slot.facultyId,
      roomId: slot.classroomId,
    }))

    // Prepare problem data for theory ILP solver
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
        periodsPerWeek: c.periodsPerWeek, // Theory has variable periods
      })),
      rooms: theoryRooms.map((r) => ({
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
      existingAssignments,
      rules: {
        daysPerWeek: 6,
        periodsPerDay: 8,
        maxPeriodsPerBlock: RULES.MAX_THEORY_BLOCK_SIZE,
        maxPeriodsPerDay: RULES.MAX_SECTION_PERIODS_PER_DAY,
      },
    }

    // Call external ILP solver service
    const startTime = Date.now()
    try {
      const response = await fetch(`${ILP_SOLVER_URL}/solve-theory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(problemData),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[ILP Theory] ❌ Solver returned ${response.status}:`, errorText)
        return { success: false, periodsScheduled: 0, slots: [] }
      }

      const result = await response.json()
      const solveTime = Date.now() - startTime
      console.log(`[ILP Theory] Solver completed in ${solveTime}ms - Status: ${result.status}`)

      if (!result.success || !result.assignments || result.assignments.length === 0) {
        console.warn(`[ILP Theory] No solution found:`, result.message)
        return { success: false, periodsScheduled: 0, slots: [] }
      }

      console.log(`[ILP Theory] Processing ${result.assignments.length} theory assignments...`)

      // Process solution from solver
      const newSlots: TimetableSlot[] = []
      let totalPeriods = 0

      for (const assignment of result.assignments) {
        const course = theoryCourses.find(
          (c) => c.sectionId === assignment.sectionId && c.subjectId === assignment.subjectId
        )
        if (!course) {
          console.error(`[ILP Theory] Course not found for assignment:`, assignment)
          continue
        }

        const periods = (assignment.endPeriod as number) - (assignment.startPeriod as number) + 1
        totalPeriods += periods

        // Create slot (don't add to tracking maps, just return the slots)
        newSlots.push({
          sectionId: course.sectionId,
          subjectId: course.subjectId,
          facultyId: course.facultyId,
          classroomId: assignment.roomId,
          day: assignment.day as DayOfWeek,
          startPeriod: assignment.startPeriod as Period,
          endPeriod: assignment.endPeriod as Period,
        })
      }

      console.log(`[ILP Theory] ✅ Successfully processed ${newSlots.length} blocks (${totalPeriods} periods)`)
      return { success: true, periodsScheduled: totalPeriods, slots: newSlots }

    } catch (fetchError) {
      console.error(`[ILP Theory] ❌ Failed to call solver:`, fetchError instanceof Error ? fetchError.message : String(fetchError))
      return { success: false, periodsScheduled: 0, slots: [] }
    }
  }

  private scheduleLabCourse(course: CourseAssignment): boolean {
    const courseId = `${course.sectionId}-${course.subjectId}`
    console.log(`[Edge Function] Scheduling LAB ${course.subjectCode} for ${course.sectionName}`)

    const slot = this.findLabSlot(course)
    if (slot) {
      this.addSlot(course, slot.day, slot.startPeriod, slot.endPeriod, slot.classroomId)
      this.courseProgress.set(courseId, course.periodsPerWeek) // Use actual periods from course
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
    
    const labPeriods = course.periodsPerWeek // Use actual periods (3 for labs)
    const daysToTry: DayOfWeek[] = [0, 1, 2, 3, 4, 5]

    for (const day of daysToTry) {
      if (day === 5) {
        // Saturday: morning slots
        for (let start = 1; start <= 4 - labPeriods + 1; start++) {
          const end = start + labPeriods - 1
          const slot = this.tryLabSlot(course, labRooms, day, start as Period, end as Period)
          if (slot) return slot
        }
        // Saturday afternoon for first year only
        if (course.yearLevel === 1) {
          for (let start = 5; start <= 8 - labPeriods + 1; start++) {
            const end = start + labPeriods - 1
            const afternoonSlot = this.tryLabSlot(course, labRooms, day, start as Period, end as Period)
            if (afternoonSlot) return afternoonSlot
          }
        }
      } else {
        // Weekdays: try all possible lab period slots
        for (let start = 1; start <= 8 - labPeriods + 1; start++) {
          const end = start + labPeriods - 1
          const slot = this.tryLabSlot(course, labRooms, day, start as Period, end as Period)
          if (slot) return slot
        }
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
    // Faculty gap rule is soft - don't block labs for this

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
      `[Theory] 🔵 START: ${course.subjectCode} (${course.subjectName}) for ${course.sectionName}`,
    )
    console.log(
      `[Theory]   Faculty: ${course.facultyCode} | Students: ${course.studentCount} | Periods: ${periodsNeeded}`,
    )

    // Try to schedule in blocks (2 periods ONLY per day, never 3)
    // Theory constraint: MAX 2 periods per day per subject
    // So for 3-period subjects, we schedule 2+2 (impossible) or 2 (and leave 1 unscheduled)
    // Better: schedule 2 periods at a time across multiple days
    let attempts = 0
    const maxAttempts = 50 // Prevent infinite loops
    
    while (periodsScheduled < periodsNeeded && attempts < maxAttempts) {
      attempts++
      const remainingPeriods = periodsNeeded - periodsScheduled
      
      // Determine block size: ALWAYS schedule 2 periods max per day
      // NEVER schedule single-period theory blocks
      // NEVER schedule 3 periods in one day (violates constraint)
      let periodsToSchedule: number
      if (remainingPeriods >= 2) {
        periodsToSchedule = 2  // Always 2 periods per day max
      } else if (remainingPeriods === 1) {
        // Cannot schedule 1 period - theory minimum is 2 periods
        console.warn(`[Edge Function] ⚠️ ${course.subjectCode} has 1 remaining period - cannot schedule (min 2 periods)`)
        break
      } else {
        break
      }

      const slot = this.findTheorySlot(course, periodsToSchedule)
      if (slot) {
        const success = this.addSlot(course, slot.day, slot.startPeriod, slot.endPeriod, slot.classroomId)
        if (success) {
          periodsScheduled += periodsToSchedule
          console.log(`[Theory]   ✅ Assigned ${periodsToSchedule} periods: Day ${slot.day}, Periods ${slot.startPeriod}-${slot.endPeriod}, Room ${slot.classroomId}`)
        } else {
          console.error(`[Theory]   ❌ Failed to add slot despite finding one - Day ${slot.day}, Periods ${slot.startPeriod}-${slot.endPeriod}`)
          break
        }
      } else {
        console.warn(`[Theory]   ⚠️ No valid slot found for ${periodsToSchedule} periods (${periodsScheduled}/${periodsNeeded} scheduled so far)`)
        break
      }
    }

    this.courseProgress.set(courseId, periodsScheduled)
    
    if (periodsScheduled === periodsNeeded) {
      console.log(`[Theory] ✅ COMPLETE: ${course.subjectCode} fully scheduled (${periodsScheduled}/${periodsNeeded} periods)`)
    } else if (periodsScheduled > 0) {
      console.warn(`[Theory] ⚠️ PARTIAL: ${course.subjectCode} (${course.sectionName}) partially scheduled (${periodsScheduled}/${periodsNeeded} periods)`)
    } else {
      // DETAILED ERROR LOGGING for failed scheduling
      console.error(`[Theory] ❌ FAILED: ${course.subjectCode} (${course.sectionName}) - NO periods scheduled`)
      console.error(`[Theory] ❌ ERROR DETAILS:`)
      console.error(`[Theory]   - Faculty: ${course.facultyCode} (${course.facultyId})`)
      console.error(`[Theory]   - Section: ${course.sectionName} (${course.sectionId})`)
      console.error(`[Theory]   - Periods needed: ${periodsNeeded}`)
      
      // Log faculty availability
      const facultyAvail = this.facultyDynamicAvailability.get(course.facultyId)
      const facultySlotsRemaining = facultyAvail ? facultyAvail.size : 0
      console.error(`[Theory]   - Faculty slots remaining: ${facultySlotsRemaining}`)
      if (facultyAvail) {
        const daySlots: Map<number, number> = new Map()
        for (const slot of facultyAvail) {
          const day = parseInt(slot.split('-')[0])
          daySlots.set(day, (daySlots.get(day) || 0) + 1)
        }
        console.error(`[Theory]   - Faculty availability by day: ${JSON.stringify(Object.fromEntries(daySlots))}`)
      }
      
      // Log section schedule
      const sectionSched = this.sectionSchedule.get(course.sectionId)
      const sectionSlotsTaken = sectionSched ? sectionSched.size : 0
      console.error(`[Theory]   - Section slots taken: ${sectionSlotsTaken}`)
      if (sectionSched) {
        const daySlots: Map<number, number> = new Map()
        for (const slot of sectionSched) {
          const day = parseInt(slot.split('-')[0])
          daySlots.set(day, (daySlots.get(day) || 0) + 1)
        }
        console.error(`[Theory]   - Section schedule by day: ${JSON.stringify(Object.fromEntries(daySlots))}`)
      }
      
      // Log faculty total workload
      const facultyTotalSlots = this.facultySchedule.get(course.facultyId)
      const facultySlotsTaken = facultyTotalSlots ? facultyTotalSlots.size : 0
      console.error(`[Theory]   - Faculty total slots taken: ${facultySlotsTaken}/48`)
    }
    
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
    
    console.log(`[Theory]   🔍 Finding slot for ${periodsNeeded} periods...`)
    console.log(`[Theory]   Available rooms: ${theoryRooms.length} (need capacity ≥${course.studentCount})`)
    
    if (theoryRooms.length === 0) {
      console.error(`[Theory]   ❌ NO ROOMS: No theory rooms with capacity ≥${course.studentCount} available`)
      console.error(`[Theory]   All rooms: ${this.classrooms.filter(r => r.roomType === "theory").map(r => `${r.name}(${r.capacity})`).join(", ")}`)
      return null
    }

    // ==========================================
    // ENHANCED SLOT FINDING: Better Distribution
    // ==========================================
    
    // 1. Calculate section's current load per day (for distribution)
    const sectionDayLoad = this.getSectionDayLoad(course.sectionId)
    
    // 2. Calculate FACULTY's current load per day (CRITICAL for preventing fragmentation)
    const facultyDayLoad = this.getFacultyDayLoad(course.facultyId)
    
    // 3. Sort days by COMBINED load (prefer days where BOTH section AND faculty are less busy)
    // This prevents faculty from being scheduled too heavily on certain days
    const daysToTry: DayOfWeek[] = ([0, 1, 2, 3, 4, 5] as DayOfWeek[])
      .sort((a, b) => {
        const aLoad = (sectionDayLoad.get(a) || 0) + (facultyDayLoad.get(a) || 0)
        const bLoad = (sectionDayLoad.get(b) || 0) + (facultyDayLoad.get(b) || 0)
        return aLoad - bLoad
      })
    
    // 3. Preferred time slots (morning first, then afternoon)
    // Slots ordered by preference: 1-2, 1-3, 2-3, 2-4, 5-6, 5-7, 6-7, 6-8
    const timeSlotPriority: { start: number; end: number }[] = [
      // Morning preference (periods 1-4)
      { start: 1, end: 2 },
      { start: 1, end: 3 },
      { start: 2, end: 3 },
      { start: 2, end: 4 },
      { start: 1, end: 4 },
      { start: 3, end: 4 },
      // Afternoon slots (periods 5-8)
      { start: 5, end: 6 },
      { start: 5, end: 7 },
      { start: 6, end: 7 },
      { start: 6, end: 8 },
      { start: 5, end: 8 },
      { start: 7, end: 8 },
    ]
    
    // Filter slots that match the needed periods
    const validTimeSlots = timeSlotPriority.filter(slot => 
      (slot.end - slot.start + 1) === periodsNeeded
    )
    
    // PASS 1: Try preferred time slots (morning first) - NO gap rule (handled in optimization)
    console.log(`[Theory]   📍 PASS 1: Trying preferred time slots...`)
    let pass1Attempts = 0
    for (const day of daysToTry) {
      const maxPeriod = day === 5 && course.yearLevel !== 1 ? 4 : 8

      for (const timeSlot of validTimeSlots) {
        const start = timeSlot.start
        const end = timeSlot.end
        
        if (end > maxPeriod) continue
        pass1Attempts++
        
        // NO gap rule check - optimization phase handles faculty gaps
        const slot = this.tryTheorySlot(course, theoryRooms, day as DayOfWeek, start as Period, end as Period)
        if (slot) {
          console.log(`[Theory]   ✅ PASS 1 SUCCESS after ${pass1Attempts} attempts`)
          return slot
        }
      }
    }
    console.log(`[Theory]   ⚠️ PASS 1 FAILED: No slot found after ${pass1Attempts} attempts`)
    
    // PASS 2: Try all sequential slots (any day, any valid time)
    console.log(`[Theory]   📍 PASS 2: Trying all sequential slots...`)
    let pass2Attempts = 0
    for (const day of daysToTry) {
      const maxPeriod = day === 5 && course.yearLevel !== 1 ? 4 : 8

      for (let start = 1; start <= maxPeriod - periodsNeeded + 1; start++) {
        const end = start + periodsNeeded - 1
        if (end > maxPeriod) continue

        // Don't split across lunch (periods 4 and 5)
        if (start <= 4 && end > 4) continue
        pass2Attempts++

        const slot = this.tryTheorySlot(course, theoryRooms, day as DayOfWeek, start as Period, end as Period)
        if (slot) {
          console.log(`[Theory]   ✅ PASS 2 SUCCESS after ${pass2Attempts} attempts`)
          return slot
        }
      }
    }
    console.log(`[Theory]   ❌ PASS 2 FAILED: No valid slot found after ${pass2Attempts} attempts`)
    console.error(`[Theory]   ❌ ALL PASSES FAILED: Cannot schedule ${periodsNeeded} periods for ${course.subjectCode}`)
    
    // Detailed failure analysis
    console.error(`[Theory]   ❌ FAILURE ANALYSIS for ${course.subjectCode} (${course.sectionName}):`)
    const facultyAvail = this.facultyDynamicAvailability.get(course.facultyId)
    console.error(`[Theory]   Faculty ${course.facultyCode}: ${facultyAvail?.size || 0} slots remaining`)
    
    // Check each day individually
    for (const day of daysToTry) {
      const maxPeriod = day === 5 && course.yearLevel !== 1 ? 4 : 8
      let dayReason = ''
      
      // Check faculty availability on this day
      let facultyAvailOnDay = 0
      for (let p = 1; p <= maxPeriod; p++) {
        if (facultyAvail?.has(`${day}-${p}`)) facultyAvailOnDay++
      }
      
      // Check section availability on this day
      const sectionSched = this.sectionSchedule.get(course.sectionId)
      let sectionBusyOnDay = 0
      for (let p = 1; p <= maxPeriod; p++) {
        if (sectionSched?.has(`${day}-${p}`)) sectionBusyOnDay++
      }
      
      if (facultyAvailOnDay < periodsNeeded) {
        dayReason = `Faculty only has ${facultyAvailOnDay}/${periodsNeeded} periods available`
      } else if (sectionBusyOnDay >= maxPeriod - periodsNeeded + 1) {
        dayReason = `Section already has ${sectionBusyOnDay}/${maxPeriod} periods scheduled`
      } else {
        dayReason = 'Room conflicts or constraint violations'
      }
      console.error(`[Theory]     Day ${day}: ${dayReason}`)
    }

    return null
  }
  
  // Helper: Get current load per day for a section
  private getSectionDayLoad(sectionId: string): Map<DayOfWeek, number> {
    const dayLoad = new Map<DayOfWeek, number>()
    const schedule = this.sectionSchedule.get(sectionId)
    
    if (!schedule) return dayLoad
    
    for (const key of schedule) {
      const day = parseInt(key.split('-')[0]) as DayOfWeek
      dayLoad.set(day, (dayLoad.get(day) || 0) + 1)
    }
    
    return dayLoad
  }

  // Helper: Get current load per day for a faculty member (ALL periods - labs + theory)
  private getFacultyDayLoad(facultyId: string): Map<DayOfWeek, number> {
    const dayLoad = new Map<DayOfWeek, number>()
    const schedule = this.facultySchedule.get(facultyId)
    
    if (!schedule) return dayLoad
    
    for (const key of schedule) {
      const day = parseInt(key.split('-')[0]) as DayOfWeek
      dayLoad.set(day, (dayLoad.get(day) || 0) + 1)
    }
    
    return dayLoad
  }

  // Helper: Get THEORY-ONLY load per day for a faculty member
  // This excludes lab periods which are scheduled separately
  // Used for day-balancing constraint during theory scheduling
  private getFacultyTheoryDayLoad(facultyId: string): Map<DayOfWeek, number> {
    const dayLoad = new Map<DayOfWeek, number>()
    
    // Only count theory slots from the timetable
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

  private tryTheorySlot(
    course: CourseAssignment,
    rooms: ClassroomOption[],
    day: DayOfWeek,
    start: Period,
    end: Period,
  ): { day: DayOfWeek; startPeriod: Period; endPeriod: Period; classroomId: string } | null {
    // CRITICAL CHECK 1: Is section already scheduled at this time?
    if (this.isSectionAlreadyScheduled(course.sectionId, day, start, end)) {
      // Don't log - too verbose for normal operation
      return null
    }

    // CRITICAL CHECK 2: Check faculty DYNAMIC availability (updated after each assignment)
    if (!this.isFacultyDynamicallyAvailable(course.facultyId, day, start, end)) {
      // Don't log - too verbose for normal operation
      return null
    }

    // Check total section periods per day (not too many classes in one day)
    // AND check that this specific subject doesn't exceed 2 periods per day
    if (!this.canScheduleTheoryOnDay(course.sectionId, day, end - start + 1, course.subjectId)) {
      // Don't log - too verbose for normal operation
      return null
    }
    
    // CRITICAL CHECK 4: Day-balancing for high-workload faculty
    // Prevents over-scheduling on certain days, leaving room for all sections
    if (!this.canFacultyTeachMoreOnDay(course.facultyId, day, end - start + 1)) {
      // Don't log - too verbose for normal operation
      return null
    }

    // Check faculty gap rule (soft - only for theory, skip if no other option)
    // This is handled separately in findTheorySlot with fallback

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
      console.error(`[ERROR] No dynamic availability found for faculty ${facultyId}`)
      return false
    }

    // Check if faculty is available for ALL periods in the slot
    for (let p = start; p <= end; p++) {
      const key = `${day}-${p}`
      if (!availableSlots.has(key)) {
        // Don't log every check - too verbose
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

  /**
   * Day-balancing constraint for high-workload faculty
   * Prevents faculty from teaching too many THEORY periods on any single day
   * This ensures slots remain available for all sections
   * DISABLED in relaxed mode for more flexibility
   * 
   * NOTE: Uses getFacultyTheoryDayLoad() to count ONLY theory periods,
   * NOT lab periods. This is because maxPerDay is calculated from theory
   * workload only, so we must compare apples-to-apples.
   */
  private canFacultyTeachMoreOnDay(facultyId: string, day: DayOfWeek, additionalPeriods: number): boolean {
    // In relaxed mode, skip this constraint entirely
    if (this.relaxedMode) return true
    
    const maxPerDay = this.facultyMaxPerDay.get(facultyId)
    if (!maxPerDay) return true // No limit for faculty not in workload map
    
    // Count current THEORY periods this faculty has on this day (excludes labs)
    // This is critical - maxPerDay is calculated from theory workload only,
    // so we must only count theory periods to avoid false constraint violations
    const facultyTheoryDayLoad = this.getFacultyTheoryDayLoad(facultyId)
    const currentLoad = facultyTheoryDayLoad.get(day) || 0
    
    // Allow if adding these periods stays within daily limit
    return (currentLoad + additionalPeriods) <= maxPerDay
  }

  // Check if section can have more theory on this day (total section limit)
  private canScheduleTheoryOnDay(sectionId: string, day: DayOfWeek, additionalPeriods: number, subjectId?: string): boolean {
    const schedule = this.sectionSchedule.get(sectionId)
    if (!schedule) return true

    let periodsOnDay = 0
    let subjectPeriodsOnDay = 0
    
    for (let p = 1; p <= 8; p++) {
      if (schedule.has(`${day}-${p}`)) {
        periodsOnDay++
        
        // Count periods for THIS specific subject on this day
        if (subjectId) {
          const existingSlot = this.timetable.find(
            slot => slot.sectionId === sectionId && 
                   slot.subjectId === subjectId && 
                   slot.day === day && 
                   p >= slot.startPeriod && 
                   p <= slot.endPeriod
          )
          if (existingSlot) {
            subjectPeriodsOnDay++
          }
        }
      }
    }

    // Section can have up to MAX_SECTION_PERIODS_PER_DAY total (includes labs)
    if (periodsOnDay + additionalPeriods > RULES.MAX_SECTION_PERIODS_PER_DAY) {
      return false
    }
    
    // CRITICAL: Theory subjects must have MAX 2 periods per day
    if (subjectId && subjectPeriodsOnDay + additionalPeriods > 2) {
      return false
    }
    
    return true
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

  /**
   * Detect all conflicts in the generated timetable
   * Returns array of conflict descriptions
   */
  detectConflicts(slots: TimetableSlot[]): string[] {
    const conflicts: string[] = []
    
    // Maps to track occupancy
    const facultyOccupied = new Map<string, Set<string>>() // facultyId -> Set of "day-period"
    const roomOccupied = new Map<string, Set<string>>() // roomId -> Set of "day-period"
    const sectionOccupied = new Map<string, Set<string>>() // sectionId -> Set of "day-period"
    
    for (const slot of slots) {
      const course = this.courses.find(c => c.sectionId === slot.sectionId && c.subjectId === slot.subjectId)
      if (!course) continue
      
      // Check each period in the slot
      for (let p = slot.startPeriod; p <= slot.endPeriod; p++) {
        const key = `${slot.day}-${p}`
        
        // Check faculty conflict
        if (!facultyOccupied.has(slot.facultyId)) {
          facultyOccupied.set(slot.facultyId, new Set())
        }
        if (facultyOccupied.get(slot.facultyId)!.has(key)) {
          conflicts.push(`Faculty ${course.facultyCode} has overlapping classes at Day ${slot.day} Period ${p}`)
        }
        facultyOccupied.get(slot.facultyId)!.add(key)
        
        // Check room conflict
        if (!roomOccupied.has(slot.classroomId)) {
          roomOccupied.set(slot.classroomId, new Set())
        }
        if (roomOccupied.get(slot.classroomId)!.has(key)) {
          conflicts.push(`Room ${slot.classroomId} has overlapping classes at Day ${slot.day} Period ${p}`)
        }
        roomOccupied.get(slot.classroomId)!.add(key)
        
        // Check section conflict
        if (!sectionOccupied.has(slot.sectionId)) {
          sectionOccupied.set(slot.sectionId, new Set())
        }
        if (sectionOccupied.get(slot.sectionId)!.has(key)) {
          const existingSlot = slots.find(s => 
            s.sectionId === slot.sectionId && 
            s.day === slot.day && 
            s.startPeriod <= p && 
            s.endPeriod >= p &&
            s !== slot
          )
          const existingCourse = existingSlot ? this.courses.find(c => 
            c.sectionId === existingSlot.sectionId && c.subjectId === existingSlot.subjectId
          ) : null
          
          conflicts.push(`Section ${course.sectionName} has overlapping classes at Day ${slot.day} Period ${p}: ${course.subjectCode} conflicts with ${existingCourse?.subjectCode || 'unknown'}`)
        }
        sectionOccupied.get(slot.sectionId)!.add(key)
      }
    }
    
    return conflicts
  }
}

// Validation function to check schedule completeness
async function validateScheduleCompleteness(
  supabase: any,
  expectedCourses: CourseAssignment[],
  generatedSlots: TimetableSlot[],
  jobId: string,
  classrooms: ClassroomOption[],
  facultyAvailability: FacultyAvailabilitySlot[],
  ilpError?: string | null,
  reducedCourses?: { courseId: string; originalPeriods: number; newPeriods: number }[]
): Promise<{ complete: boolean; missing: any[]; diagnostics: any }> {
  const missing: any[] = []
  
  // Group slots by section+subject
  const slotsBySubject = new Map<string, number>()
  for (const slot of generatedSlots) {
    const key = `${slot.sectionId}-${slot.subjectId}`
    const periods = slot.endPeriod - slot.startPeriod + 1
    slotsBySubject.set(key, (slotsBySubject.get(key) || 0) + periods)
  }
  
  // Track failure types for diagnostics
  let labFailures = 0
  let theoryFailures = 0
  const failedFaculty = new Set<string>()
  
  // Check each expected course - MINIMUM 1 period for theory, full block for labs
  for (const course of expectedCourses) {
    const key = `${course.sectionId}-${course.subjectId}`
    const scheduledPeriods = slotsBySubject.get(key) || 0
    
    if (course.subjectType === 'lab') {
      // Labs MUST have exactly 1 block (4 periods)
      if (scheduledPeriods === 0) {
        labFailures++
        failedFaculty.add(course.facultyId)
        missing.push({
          section: course.sectionName,
          subject: course.subjectCode,
          faculty: course.facultyCode,
          type: 'lab',
          expected: '1 lab block (4 periods)',
          scheduled: 0,
          reason: 'Lab not scheduled - check lab room availability or faculty conflicts'
        })
      }
    } else {
      // Theory: Accept partial schedules but MINIMUM 1 period (45 mins/week)
      if (scheduledPeriods === 0) {
        theoryFailures++
        failedFaculty.add(course.facultyId)
        missing.push({
          section: course.sectionName,
          subject: course.subjectCode,
          faculty: course.facultyCode,
          type: 'theory',
          expected: course.periodsPerWeek,
          scheduled: 0,
          reason: 'Theory not scheduled - check classroom availability or faculty conflicts'
        })
      }
      // Log warning for partial schedules but don't fail
      if (scheduledPeriods > 0 && scheduledPeriods < course.periodsPerWeek) {
        console.log(`[WARNING] Theory ${course.subjectCode} (${course.sectionName}): Partial schedule ${scheduledPeriods}/${course.periodsPerWeek} periods`)
      }
    }
  }
  
  // Generate diagnostics and suggestions
  const diagnostics = generateDiagnostics(
    expectedCourses,
    classrooms,
    facultyAvailability,
    labFailures,
    theoryFailures,
    failedFaculty,
    ilpError,
    reducedCourses
  )
  
  return {
    complete: missing.length === 0,
    missing,
    diagnostics
  }
}

// Generate diagnostic information and suggestions
function generateDiagnostics(
  courses: CourseAssignment[],
  classrooms: ClassroomOption[],
  facultyAvailability: FacultyAvailabilitySlot[],
  labFailures: number,
  theoryFailures: number,
  failedFaculty: Set<string>,
  ilpError?: string | null,
  reducedCourses?: { courseId: string; originalPeriods: number; newPeriods: number }[]
): any {
  const labCourses = courses.filter(c => c.subjectType === 'lab')
  const theoryCourses = courses.filter(c => c.subjectType === 'theory')
  const labRooms = classrooms.filter(r => r.roomType === 'lab')
  const theoryRooms = classrooms.filter(r => r.roomType === 'theory')
  
  // Calculate capacity metrics
  const labBlocksNeeded = labCourses.length // Each lab needs 1 block of 4 periods
  const labBlocksAvailable = labRooms.length * 12 // 2 possible blocks per day * 6 days
  const labUtilization = labBlocksNeeded / labBlocksAvailable * 100
  
  const theoryPeriodsNeeded = theoryCourses.reduce((sum, c) => sum + c.periodsPerWeek, 0)
  const theoryPeriodsAvailable = theoryRooms.length * 48 // 8 periods * 6 days
  const theoryUtilization = theoryPeriodsNeeded / theoryPeriodsAvailable * 100
  
  // Check faculty availability issues
  const facultyWithLimitedAvailability: string[] = []
  const uniqueFaculty = [...new Set(courses.map(c => c.facultyId))]
  for (const facultyId of uniqueFaculty) {
    const avail = facultyAvailability.filter(a => a.facultyId === facultyId)
    const totalSlots = avail.reduce((sum, a) => sum + (a.endPeriod - a.startPeriod + 1), 0)
    if (totalSlots < 24) { // Less than 4 hours per day average
      const course = courses.find(c => c.facultyId === facultyId)
      facultyWithLimitedAvailability.push(course?.facultyCode || facultyId)
    }
  }
  
  // Generate suggestions based on failures
  const suggestions: string[] = []
  
  // Add ILP solver error to suggestions if present
  if (ilpError) {
    suggestions.unshift(`🔴 ILP Solver Error: ${ilpError}`)
  }
  
  if (labFailures > 0) {
    if (labUtilization >= 100) {
      const roomsNeeded = Math.ceil(labBlocksNeeded / 12 * 1.5) // Target 67% utilization
      suggestions.push(`🔴 CRITICAL: Lab room shortage! ${labRooms.length} lab rooms provide ${labBlocksAvailable} blocks, but ${labBlocksNeeded} labs need scheduling (${labUtilization.toFixed(0)}% utilization = NO SLACK!). Add ${roomsNeeded - labRooms.length} more lab room(s) for 50% slack.`)
    } else if (labUtilization > 80) {
      suggestions.push(`🔴 CRITICAL: Lab room shortage! ${labRooms.length} lab rooms can only fit ${labBlocksAvailable} blocks, but ${labBlocksNeeded} are needed (${labUtilization.toFixed(0)}% utilization). Add ${Math.ceil((labBlocksNeeded - labBlocksAvailable * 0.8) / 12)} more lab room(s).`)
    } else {
      suggestions.push(`⚠️ Lab scheduling failed despite capacity. Check if same faculty teaches too many sections (faculty can't be in two places at once).`)
    }
  }
  
  if (theoryFailures > 0) {
    if (theoryUtilization > 80) {
      suggestions.push(`🔴 CRITICAL: Theory room shortage! ${theoryRooms.length} theory rooms provide ${theoryPeriodsAvailable} slots, but ${theoryPeriodsNeeded} are needed (${theoryUtilization.toFixed(0)}% utilization). Add ${Math.ceil((theoryPeriodsNeeded - theoryPeriodsAvailable * 0.7) / 48)} more theory room(s).`)
    } else {
      suggestions.push(`⚠️ Theory scheduling failed despite capacity. Check for faculty conflicts or section schedule fragmentation.`)
    }
  }
  
  if (failedFaculty.size > 0 && facultyWithLimitedAvailability.length > 0) {
    const limitedFacultyInFailures = facultyWithLimitedAvailability.filter(f => 
      [...failedFaculty].some(fid => courses.find(c => c.facultyId === fid)?.facultyCode === f)
    )
    if (limitedFacultyInFailures.length > 0) {
      suggestions.push(`⚠️ Faculty availability issue: ${limitedFacultyInFailures.join(', ')} have limited available time slots. Increase their availability in the faculty management.`)
    }
  }
  
  if (suggestions.length === 0 && (labFailures > 0 || theoryFailures > 0)) {
    suggestions.push(`ℹ️ Scheduling failed due to complex constraint interactions. Try reducing the number of sections or subjects.`)
  }
  
  // Add info about reduced courses if fallback was applied
  if (reducedCourses && reducedCourses.length > 0) {
    const reducedCount = reducedCourses.length
    const totalPeriodsReduced = reducedCourses.reduce((sum, c) => sum + (c.originalPeriods - c.newPeriods), 0)
    suggestions.unshift(`🔄 FALLBACK APPLIED: Reduced ${reducedCount} theory subject(s) from 4→2 periods/week (saved ${totalPeriodsReduced} periods) to fit within room capacity.`)
  }
  
  return {
    summary: {
      labRooms: labRooms.length,
      theoryRooms: theoryRooms.length,
      labBlocksNeeded,
      labBlocksAvailable,
      labUtilization: `${labUtilization.toFixed(1)}%`,
      theoryPeriodsNeeded,
      theoryPeriodsAvailable,
      theoryUtilization: `${theoryUtilization.toFixed(1)}%`,
    },
    issues: {
      labFailures,
      theoryFailures,
      facultyWithLimitedAvailability: facultyWithLimitedAvailability.length,
      ilpError: ilpError || null,
    },
    reducedCourses: reducedCourses || [],
    suggestions
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

    // Parse request body for adminId (multi-tenant support)
    let adminId: string | null = null
    try {
      const body = await req.json()
      adminId = body?.adminId || null
      console.log("[Edge Function] Request body:", JSON.stringify(body))
    } catch {
      // No body or invalid JSON - that's okay, adminId will be null
      console.log("[Edge Function] No request body or invalid JSON")
    }

    console.log("[Edge Function] Starting base timetable generation", adminId ? `for admin: ${adminId}` : "(no admin filter)")

    // If adminId is provided, delete old timetable data first
    if (adminId) {
      console.log("[Edge Function] Cleaning up old timetable data for admin:", adminId)
      
      // Get old job IDs for this admin
      const { data: oldJobs } = await supabase
        .from("timetable_jobs")
        .select("id")
        .eq("created_by", adminId)
      
      if (oldJobs && oldJobs.length > 0) {
        const oldJobIds = oldJobs.map(j => j.id)
        console.log("[Edge Function] Found", oldJobIds.length, "old jobs to clean up")
        
        // Delete optimized timetable data
        await supabase
          .from("timetable_optimized")
          .delete()
          .in("job_id", oldJobIds)
        
        // Delete base timetable data
        await supabase
          .from("timetable_base")
          .delete()
          .in("job_id", oldJobIds)
        
        // Delete old jobs
        await supabase
          .from("timetable_jobs")
          .delete()
          .eq("created_by", adminId)
        
        console.log("[Edge Function] Old timetable data cleaned up")
      }
    }

    // Create a new job with created_by if adminId is provided
    const jobInsertData: any = {
      status: "generating_base",
      progress: 10,
      message: "Fetching data...",
    }
    if (adminId) {
      jobInsertData.created_by = adminId
    }

    const { data: job, error: jobError } = await supabase
      .from("timetable_jobs")
      .insert(jobInsertData)
      .select()
      .single()

    if (jobError) {
      console.error("[Edge Function] Job creation error:", jobError)
      throw jobError
    }

    console.log("[Edge Function] Job created:", job.id)

    // Fetch all data needed for generation - with optional admin filtering
    let sectionSubjectsQuery = supabase
      .from("section_subjects")
      .select("*, sections(*), subjects(*), faculty(*)")
    
    let classroomsQuery = supabase.from("classrooms").select("*")
    
    let availabilityQuery = supabase.from("faculty_availability").select("*, faculty(*)")
    
    // If adminId is provided, filter data by admin's created entities
    if (adminId) {
      console.log("[Edge Function] Filtering data by admin:", adminId)
      
      // First, get sections created by this admin
      const { data: adminSections } = await supabase
        .from("sections")
        .select("id")
        .eq("created_by", adminId)
      
      const sectionIds = adminSections?.map(s => s.id) || []
      console.log("[Edge Function] Admin's sections:", sectionIds.length)
      
      // Get faculty created by this admin
      const { data: adminFaculty } = await supabase
        .from("faculty")
        .select("id")
        .eq("created_by", adminId)
      
      const facultyIds = adminFaculty?.map(f => f.id) || []
      console.log("[Edge Function] Admin's faculty:", facultyIds.length)
      
      // Filter queries
      if (sectionIds.length > 0) {
        sectionSubjectsQuery = sectionSubjectsQuery.in("section_id", sectionIds)
      } else {
        // No sections - return empty results
        sectionSubjectsQuery = sectionSubjectsQuery.eq("section_id", "00000000-0000-0000-0000-000000000000")
      }
      
      classroomsQuery = classroomsQuery.eq("created_by", adminId)
      
      if (facultyIds.length > 0) {
        availabilityQuery = availabilityQuery.in("faculty_id", facultyIds)
      } else {
        // No faculty - return empty results
        availabilityQuery = availabilityQuery.eq("faculty_id", "00000000-0000-0000-0000-000000000000")
      }
    }

    const [sectionSubjectsResult, classroomsResult, availabilityResult] = await Promise.all([
      sectionSubjectsQuery,
      classroomsQuery,
      availabilityQuery,
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

    // 🔍 DEBUG: Log classrooms being used
    console.log("[Edge Function] 🔍 DEBUG - Classrooms fetched:", classrooms?.length || 0)
    console.log("[Edge Function] 🔍 DEBUG - Classroom details:", JSON.stringify(classrooms?.map(r => ({
      id: r.id,
      name: r.name,
      type: r.room_type,
      capacity: r.capacity,
      created_by: r.created_by
    })), null, 2))

    if (!sectionSubjects || !classrooms) {
      await supabase
        .from("timetable_jobs")
        .update({ status: "failed", message: "Missing required data" })
        .eq("id", job.id)
      
      return new Response(
        JSON.stringify({ success: false, error: "Missing required data", jobId: job.id }),
        {
          status: 200, // Return 200 so frontend can parse error details
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
    
    // 🔍 DEBUG: Analyze generated timetable
    const labSlotCount = timetableSlots.filter(s => (s.endPeriod - s.startPeriod + 1) === 4).length
    const theorySlotCount = timetableSlots.filter(s => (s.endPeriod - s.startPeriod + 1) < 4).length
    console.log(`[Edge Function] 🔍 DEBUG - Generated slots: ${timetableSlots.length} total (${labSlotCount} labs with 4 periods, ${theorySlotCount} theory/partial)`)
    
    // Log first few lab slots
    const labSlots = timetableSlots.filter(s => (s.endPeriod - s.startPeriod + 1) === 4)
    console.log(`[Edge Function] 🔍 DEBUG - Sample lab slots from timetable:`)
    for (let i = 0; i < Math.min(3, labSlots.length); i++) {
      const s = labSlots[i]
      console.log(`  Lab ${i}: Day=${s.day}, Periods=${s.startPeriod}-${s.endPeriod} (${s.endPeriod - s.startPeriod + 1} periods)`)
    }

    // Update progress
    await supabase
      .from("timetable_jobs")
      .update({ progress: 80, message: "Saving timetable..." })
      .eq("id", job.id)

    // Save to database - include created_by if adminId is provided
    const slotsToInsert = timetableSlots.map((slot) => {
      const slotData: any = {
        job_id: job.id,
        section_id: slot.sectionId,
        subject_id: slot.subjectId,
        faculty_id: slot.facultyId,
        classroom_id: slot.classroomId,
        day_of_week: slot.day,
        start_period: slot.startPeriod,
        end_period: slot.endPeriod,
      }
      if (adminId) {
        slotData.created_by = adminId
      }
      return slotData
    })

    // 🔍 DEBUG: Log sample slots before database insert
    console.log(`[Edge Function] 🔍 DEBUG - Preparing to insert ${slotsToInsert.length} slots`)
    const labSlotsToInsert = slotsToInsert.filter(s => {
      const slot = timetableSlots.find(ts => 
        ts.sectionId === s.section_id && 
        ts.subjectId === s.subject_id &&
        ts.day === s.day_of_week &&
        ts.startPeriod === s.start_period
      )
      // Find if this is a lab by checking if it's 4 periods
      return slot && (slot.endPeriod - slot.startPeriod + 1) === 4
    })
    console.log(`[Edge Function] 🔍 DEBUG - Lab slots to insert: ${labSlotsToInsert.length}`)
    for (let i = 0; i < Math.min(3, labSlotsToInsert.length); i++) {
      const s = labSlotsToInsert[i]
      console.log(`  Lab ${i}: Day=${s.day_of_week}, Periods=${s.start_period}-${s.end_period} (${s.end_period - s.start_period + 1} periods)`)
    }

    // 🔍 CRITICAL: Validate for conflicts BEFORE database insert
    console.log("[Edge Function] 🔍 Validating timetable for conflicts before insert...")
    const conflicts = generator.detectConflicts(timetableSlots)
    
    if (conflicts.length > 0) {
      console.error(`[Edge Function] ❌ CRITICAL: Found ${conflicts.length} conflicts in generated timetable!`)
      conflicts.forEach((c, i) => {
        console.error(`  Conflict ${i + 1}: ${c}`)
      })
      
      await supabase
        .from("timetable_jobs")
        .update({ 
          status: "failed", 
          message: `Timetable generation failed: ${conflicts.length} conflicts detected. ${conflicts[0]}` 
        })
        .eq("id", job.id)
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "CONFLICTS_DETECTED",
          conflicts: conflicts.slice(0, 10),
          jobId: job.id,
          message: `Generated timetable contains ${conflicts.length} conflicts` 
        }),
        {
          status: 200, // Return 200 so frontend can parse error details
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      )
    }
    
    console.log("[Edge Function] ✅ No conflicts detected - proceeding with database insert")

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
    const ilpError = generator.getILPError()
    const reducedCourses = generator.getReducedCourses()
    const validation = await validateScheduleCompleteness(supabase, courses, timetableSlots, job.id, classroomOptions, facultyAvailability, ilpError, reducedCourses)
    
    if (!validation.complete) {
      console.error("[Edge Function] ❌ INCOMPLETE SCHEDULE:", validation.missing)
      console.error("[Edge Function] 📊 Diagnostics:", JSON.stringify(validation.diagnostics, null, 2))
      await supabase
        .from("timetable_jobs")
        .update({
          status: "failed",
          message: `Incomplete schedule: ${validation.missing.length} subject(s) not fully scheduled. ${validation.diagnostics.suggestions[0] || ''}`,
        })
        .eq("id", job.id)
      
      return new Response(
        JSON.stringify({
          success: false,
          error: "INCOMPLETE_SCHEDULE",
          details: validation.missing,
          diagnostics: validation.diagnostics,
          jobId: job.id,
          message: `Generated timetable is incomplete. ${validation.missing.length} subject(s) not fully scheduled.`,
        }),
        {
          status: 200, // Return 200 so frontend can parse error details
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
    
    // Include reduced courses info in success response
    const reducedCoursesInfo = reducedCourses.length > 0 ? {
      reducedCourses,
      fallbackMessage: `⚠️ Due to tight room capacity, ${reducedCourses.length} theory subject(s) were reduced from 4 to 2 periods/week to fit the schedule`
    } : null

    return new Response(
      JSON.stringify({
        success: true,
        jobId: job.id,
        slotsGenerated: timetableSlots.length,
        generationTime,
        ...(reducedCoursesInfo && { reducedCoursesInfo }),
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
