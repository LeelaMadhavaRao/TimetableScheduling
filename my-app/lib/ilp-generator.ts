import type { DayOfWeek, Period, SubjectType } from "./database"
import { RULES } from "./timetable"

// Types for the ILP solver
export interface CourseAssignment {
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

export interface ClassroomOption {
  id: string
  name: string
  capacity: number
  roomType: "lab" | "theory"
}

export interface FacultyAvailabilitySlot {
  facultyId: string
  dayOfWeek: DayOfWeek
  startPeriod: Period
  endPeriod: Period
}

export interface TimeSlot {
  day: DayOfWeek
  period: Period
}

export interface TimetableSlot {
  sectionId: string
  subjectId: string
  facultyId: string
  classroomId: string
  day: DayOfWeek
  startPeriod: Period
  endPeriod: Period
}

// ILP-based constraint satisfaction solver
export class ILPTimetableGenerator {
  private courses: CourseAssignment[]
  private classrooms: ClassroomOption[]
  private facultyAvailability: Map<string, FacultyAvailabilitySlot[]>
  private timetable: TimetableSlot[] = []

  // Constraint tracking
  private facultySchedule: Map<string, Set<string>> = new Map() // faculty -> set of "day-period"
  private roomSchedule: Map<string, Set<string>> = new Map() // room -> set of "day-period"
  private sectionSchedule: Map<string, Set<string>> = new Map() // section -> set of "day-period"
  private courseProgress: Map<string, number> = new Map() // courseId -> periods scheduled

  constructor(
    courses: CourseAssignment[],
    classrooms: ClassroomOption[],
    facultyAvailability: FacultyAvailabilitySlot[],
  ) {
    this.courses = courses
    this.classrooms = classrooms

    // Group faculty availability by faculty ID
    this.facultyAvailability = new Map()
    for (const slot of facultyAvailability) {
      if (!this.facultyAvailability.has(slot.facultyId)) {
        this.facultyAvailability.set(slot.facultyId, [])
      }
      this.facultyAvailability.get(slot.facultyId)!.push(slot)
    }

    // Initialize tracking
    for (const course of courses) {
      const courseId = `${course.sectionId}-${course.subjectId}`
      this.courseProgress.set(courseId, 0)
    }
  }

  // Main generation method
  generate(): TimetableSlot[] {
    console.log("[v0] Starting ILP-based timetable generation")
    console.log("[v0] Total courses to schedule:", this.courses.length)

    // Phase 1: Schedule all labs first
    const labCourses = this.courses.filter((c) => c.subjectType === "lab")
    const theoryCourses = this.courses.filter((c) => c.subjectType === "theory")

    console.log("[v0] Phase 1: Scheduling", labCourses.length, "lab courses")
    for (const course of labCourses) {
      this.scheduleCourse(course)
    }

    // Prioritize theory courses by faculty workload (heaviest workload first)
    const sortedTheoryCourses = this.prioritizeTheoryCourses(theoryCourses)
    console.log("[v0] Phase 2: Scheduling", sortedTheoryCourses.length, "theory courses (prioritized by faculty workload)")
    for (const course of sortedTheoryCourses) {
      this.scheduleCourse(course)
    }

    console.log("[v0] Generation complete. Total slots:", this.timetable.length)
    return this.timetable
  }

  // Prioritize theory courses by faculty workload - heavily-loaded faculty get scheduled first
  private prioritizeTheoryCourses(theoryCourses: CourseAssignment[]): CourseAssignment[] {
    // Calculate faculty workload (total periods they need to teach)
    const facultyWorkload = new Map<string, number>()
    for (const course of theoryCourses) {
      const current = facultyWorkload.get(course.facultyId) || 0
      facultyWorkload.set(course.facultyId, current + course.periodsPerWeek)
    }

    // Sort by faculty workload (highest first) - this ensures overloaded faculty get scheduled first
    return theoryCourses.slice().sort((a, b) => {
      const aWorkload = facultyWorkload.get(a.facultyId) || 0
      const bWorkload = facultyWorkload.get(b.facultyId) || 0
      
      // Primary: higher workload first
      if (bWorkload !== aWorkload) {
        return bWorkload - aWorkload
      }
      
      // Secondary: more periods per week first
      return b.periodsPerWeek - a.periodsPerWeek
    })
  }

  private scheduleCourse(course: CourseAssignment): void {
    const courseId = `${course.sectionId}-${course.subjectId}`
    const periodsNeeded = course.periodsPerWeek
    let periodsScheduled = 0

    console.log(
      `[v0] Scheduling ${course.subjectName} (${course.subjectType}) for ${course.sectionName} - ${periodsNeeded} periods`,
    )

    if (course.subjectType === "lab") {
      // Labs require 3 consecutive periods (2.25 hours) once per week
      const slot = this.findLabSlot(course)
      if (slot) {
        this.addSlot(course, slot.day, slot.startPeriod, slot.endPeriod, slot.classroomId)
        periodsScheduled = course.periodsPerWeek // Use actual periods from course definition
      } else {
        console.log("[v0] WARNING: Could not schedule lab for", course.sectionName, course.subjectName)
      }
    } else {
      // Theory classes: distribute across days, max 2 periods per day
      while (periodsScheduled < periodsNeeded) {
        const remainingPeriods = periodsNeeded - periodsScheduled
        const periodsToSchedule = Math.min(RULES.MAX_THEORY_PERIODS_PER_DAY, remainingPeriods)

        const slot = this.findTheorySlot(course, periodsToSchedule)
        if (slot) {
          this.addSlot(course, slot.day, slot.startPeriod, slot.endPeriod, slot.classroomId)
          periodsScheduled += periodsToSchedule
        } else {
          console.log(
            "[v0] WARNING: Could not complete theory schedule for",
            course.sectionName,
            course.subjectName,
            `(${periodsScheduled}/${periodsNeeded})`,
          )
          break
        }
      }
    }

    this.courseProgress.set(courseId, periodsScheduled)
  }

  private findLabSlot(course: CourseAssignment): {
    day: DayOfWeek
    startPeriod: Period
    endPeriod: Period
    classroomId: string
  } | null {
    const labRooms = this.classrooms.filter((r) => r.roomType === "lab" && r.capacity >= course.studentCount)
    const labPeriods = RULES.LAB_PERIODS // 3 consecutive periods

    // Priority order: Mon-Fri morning, Sat morning, then Sat afternoon (only for first year)
    const daysToTry: DayOfWeek[] = [0, 1, 2, 3, 4] // Mon-Fri

    // Add Saturday morning
    daysToTry.push(5)

    // Saturday afternoon only for first year if needed
    if (course.yearLevel === 1) {
      // Will try afternoon slots if morning fails
    }

    for (const day of daysToTry) {
      // Try all possible 3-period lab slots
      if (day === 5) {
        // Saturday: morning slots (P1-3, P2-4)
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
        // Weekdays: try all possible 3-period slots
        for (let start = 1; start <= 8 - labPeriods + 1; start++) {
          const end = start + labPeriods - 1
          if (end <= 8) {
            const slot = this.tryLabSlot(course, labRooms, day as DayOfWeek, start as Period, end as Period)
            if (slot) return slot
          }
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
    end: Period,
  ): { day: DayOfWeek; startPeriod: Period; endPeriod: Period; classroomId: string } | null {
    // Check faculty availability
    if (!this.isFacultyAvailable(course.facultyId, day, start, end)) {
      return null
    }

    // Check for faculty consecutive rule and gaps
    if (!this.checkFacultyConsecutiveRule(course.facultyId, day, start)) {
      return null
    }

    // Check section availability
    if (!this.isSectionAvailable(course.sectionId, day, start, end)) {
      return null
    }

    // Find available room
    for (const room of rooms) {
      if (this.isRoomAvailable(room.id, day, start, end)) {
        return { day, startPeriod: start, endPeriod: end, classroomId: room.id }
      }
    }

    return null
  }

  private findTheorySlot(
    course: CourseAssignment,
    periods: number,
  ): {
    day: DayOfWeek
    startPeriod: Period
    endPeriod: Period
    classroomId: string
  } | null {
    const theoryRooms = this.classrooms.filter((r) => r.roomType === "theory" && r.capacity >= course.studentCount)

    if (theoryRooms.length === 0) {
      console.log(`[v0] ERROR: No theory rooms available for ${course.sectionName} (need capacity ${course.studentCount})`)
      return null
    }

    // Try to avoid days where this section already has this subject
    const daysToTry: DayOfWeek[] = [0, 1, 2, 3, 4, 5]

    let failureReason = ""
    for (const day of daysToTry) {
      // For Saturday and other years (2-4), only try morning
      const maxPeriod = day === 5 && course.yearLevel !== 1 ? 4 : 8

      for (let start = 1; start <= maxPeriod - periods + 1; start++) {
        const end = start + periods - 1
        if (end > maxPeriod) continue

        // Check if this would exceed daily theory limit for this section
        if (!this.canScheduleTheoryOnDay(course.sectionId, day, periods, course.subjectId)) {
          failureReason = "daily limit exceeded"
          continue
        }

        const slot = this.tryTheorySlot(course, theoryRooms, day as DayOfWeek, start as Period, end as Period)
        if (slot) return slot
      }
    }

    // Log detailed failure info
    console.log(`[v0] DIAGNOSTIC: Failed to find slot for ${course.sectionName} - ${course.subjectCode} (${course.facultyCode})`)
    console.log(`[v0]   Faculty ${course.facultyCode} schedule:`, Array.from(this.facultySchedule.get(course.facultyId) || []).join(', '))
    console.log(`[v0]   Rooms available: ${theoryRooms.length}, Failure: ${failureReason || 'no available faculty/room combo'}`)

    return null
  }

  private tryTheorySlot(
    course: CourseAssignment,
    rooms: ClassroomOption[],
    day: DayOfWeek,
    start: Period,
    end: Period,
  ): { day: DayOfWeek; startPeriod: Period; endPeriod: Period; classroomId: string } | null {
    if (!this.isFacultyAvailable(course.facultyId, day, start, end)) {
      return null
    }

    if (!this.checkFacultyConsecutiveRule(course.facultyId, day, start)) {
      return null
    }

    if (!this.isSectionAvailable(course.sectionId, day, start, end)) {
      return null
    }

    for (const room of rooms) {
      if (this.isRoomAvailable(room.id, day, start, end)) {
        return { day, startPeriod: start, endPeriod: end, classroomId: room.id }
      }
    }

    return null
  }

  private isFacultyAvailable(facultyId: string, day: DayOfWeek, start: Period, end: Period): boolean {
    // CRITICAL: First check if faculty is already scheduled at this time
    const schedule = this.facultySchedule.get(facultyId)
    if (schedule) {
      for (let p = start; p <= end; p++) {
        if (schedule.has(`${day}-${p}`)) {
          return false // Faculty is already teaching at this time
        }
      }
    }
    
    // Then check declared availability slots
    const availability = this.facultyAvailability.get(facultyId)
    if (!availability || availability.length === 0) return true // No restrictions

    // Check if the requested time falls within any availability slot
    return availability.some((slot) => slot.dayOfWeek === day && slot.startPeriod <= start && slot.endPeriod >= end)
  }

  private checkFacultyConsecutiveRule(facultyId: string, day: DayOfWeek, startPeriod: Period): boolean {
    // Rule: If faculty teaches P1-2, they can't teach P3-4 (must wait until P5+)
    const schedule = this.facultySchedule.get(facultyId)
    if (!schedule) return true

    const key = `${day}-${startPeriod}`

    // Check if faculty has P1-2 and trying to schedule P3-4
    if (startPeriod >= 3 && startPeriod <= 4) {
      if (schedule.has(`${day}-1`) || schedule.has(`${day}-2`)) {
        return false // Faculty taught P1-2, can't teach P3-4
      }
    }

    // Check if faculty has P3-4 and trying to schedule P1-2
    if (startPeriod >= 1 && startPeriod <= 2) {
      if (schedule.has(`${day}-3`) || schedule.has(`${day}-4`)) {
        return false // Faculty will teach P3-4, can't teach P1-2
      }
    }

    return true
  }

  private isSectionAvailable(sectionId: string, day: DayOfWeek, start: Period, end: Period): boolean {
    const schedule = this.sectionSchedule.get(sectionId) || new Set()

    for (let p = start; p <= end; p++) {
      if (schedule.has(`${day}-${p}`)) {
        return false
      }
    }
    return true
  }

  private isRoomAvailable(roomId: string, day: DayOfWeek, start: Period, end: Period): boolean {
    const schedule = this.roomSchedule.get(roomId) || new Set()

    for (let p = start; p <= end; p++) {
      if (schedule.has(`${day}-${p}`)) {
        return false
      }
    }
    return true
  }

  private canScheduleTheoryOnDay(sectionId: string, day: DayOfWeek, additionalPeriods: number, subjectId?: string): boolean {
    const schedule = this.sectionSchedule.get(sectionId) || new Set()

    // Count how many periods this section already has on this day
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

    // Section can have up to 6 periods total per day (includes labs)
    const MAX_SECTION_PERIODS_PER_DAY = 6
    if (periodsOnDay + additionalPeriods > MAX_SECTION_PERIODS_PER_DAY) {
      return false
    }
    
    // CRITICAL: Theory subjects must have MAX 2 periods per day (per subject)
    if (subjectId && subjectPeriodsOnDay + additionalPeriods > RULES.MAX_THEORY_PERIODS_PER_DAY) {
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
  ): void {
    this.timetable.push({
      sectionId: course.sectionId,
      subjectId: course.subjectId,
      facultyId: course.facultyId,
      classroomId,
      day,
      startPeriod,
      endPeriod,
    })

    // Update schedules
    if (!this.facultySchedule.has(course.facultyId)) {
      this.facultySchedule.set(course.facultyId, new Set())
    }
    if (!this.roomSchedule.has(classroomId)) {
      this.roomSchedule.set(classroomId, new Set())
    }
    if (!this.sectionSchedule.has(course.sectionId)) {
      this.sectionSchedule.set(course.sectionId, new Set())
    }

    for (let p = startPeriod; p <= endPeriod; p++) {
      const key = `${day}-${p}`
      this.facultySchedule.get(course.facultyId)!.add(key)
      this.roomSchedule.get(classroomId)!.add(key)
      this.sectionSchedule.get(course.sectionId)!.add(key)
    }

    console.log(
      `[v0] Scheduled: ${course.sectionName} - ${course.subjectName} on Day ${day}, P${startPeriod}-${endPeriod}`,
    )
  }
}
