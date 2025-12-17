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

    console.log("[v0] Phase 2: Scheduling", theoryCourses.length, "theory courses")
    for (const course of theoryCourses) {
      this.scheduleCourse(course)
    }

    console.log("[v0] Generation complete. Total slots:", this.timetable.length)
    return this.timetable
  }

  private scheduleCourse(course: CourseAssignment): void {
    const courseId = `${course.sectionId}-${course.subjectId}`
    const periodsNeeded = course.periodsPerWeek
    let periodsScheduled = 0

    console.log(
      `[v0] Scheduling ${course.subjectName} (${course.subjectType}) for ${course.sectionName} - ${periodsNeeded} periods`,
    )

    if (course.subjectType === "lab") {
      // Labs require 4 consecutive periods (3 hours)
      const slot = this.findLabSlot(course)
      if (slot) {
        this.addSlot(course, slot.day, slot.startPeriod, slot.endPeriod, slot.classroomId)
        periodsScheduled = RULES.LAB_PERIODS
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

    // Priority order: Mon-Fri morning, Sat morning, then Sat afternoon (only for first year)
    const daysToTry: DayOfWeek[] = [0, 1, 2, 3, 4] // Mon-Fri

    // Add Saturday morning
    daysToTry.push(5)

    // Saturday afternoon only for first year if needed
    if (course.yearLevel === 1) {
      // Will try afternoon slots if morning fails
    }

    for (const day of daysToTry) {
      // Try morning slots (P1-4, P2-5, etc.)
      if (day === 5) {
        // Saturday: only morning (P1-4)
        const slot = this.tryLabSlot(course, labRooms, day, 1, 4)
        if (slot) return slot

        // Saturday afternoon for first year only
        if (course.yearLevel === 1) {
          const afternoonSlot = this.tryLabSlot(course, labRooms, day, 5, 8)
          if (afternoonSlot) return afternoonSlot
        }
      } else {
        // Weekdays: try all possible 4-period slots
        for (let start = 1; start <= 5; start++) {
          const end = start + 3
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

    // Try to avoid days where this section already has this subject
    const daysToTry: DayOfWeek[] = [0, 1, 2, 3, 4, 5]

    for (const day of daysToTry) {
      // For Saturday and other years (2-4), only try morning
      const maxPeriod = day === 5 && course.yearLevel !== 1 ? 4 : 8

      for (let start = 1; start <= maxPeriod - periods + 1; start++) {
        const end = start + periods - 1
        if (end > maxPeriod) continue

        // Check if this would exceed daily theory limit for this section
        if (!this.canScheduleTheoryOnDay(course.sectionId, day, periods)) {
          continue
        }

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

  private canScheduleTheoryOnDay(sectionId: string, day: DayOfWeek, additionalPeriods: number): boolean {
    const schedule = this.sectionSchedule.get(sectionId) || new Set()

    // Count how many periods this section already has on this day
    let periodsOnDay = 0
    for (let p = 1; p <= 8; p++) {
      if (schedule.has(`${day}-${p}`)) {
        periodsOnDay++
      }
    }

    // Check if adding more periods would exceed the daily limit
    return periodsOnDay + additionalPeriods <= RULES.MAX_THEORY_PERIODS_PER_DAY
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
