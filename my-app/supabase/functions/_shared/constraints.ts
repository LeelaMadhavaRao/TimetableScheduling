// Hard-constraint model (HC1-HC10 of the research paper) shared by every algorithm.
// Both the baseline and the enhanced pipelines are judged with the same evaluator.

import {
  ClassroomOption,
  CourseAssignment,
  courseKey,
  DAYS_PER_WEEK,
  FacultyAvailabilitySlot,
  Occupancy,
  PERIODS_PER_DAY,
  slotKey,
  slotPeriods,
  TimetableSlot,
} from "./scheduling-types.ts"

export const HARD_RULES = {
  LAB_PERIODS: 3,
  LUNCH_AFTER_PERIOD: 4,
  SATURDAY: 5,
  SATURDAY_LAST_PERIOD_NON_FIRST_YEAR: 4,
  MAX_THEORY_PERIODS_PER_DAY_PER_SUBJECT: 2,
  ROOM_CAPACITY_TOLERANCE: 0.85,
}

export interface SchedulingContext {
  courses: CourseAssignment[]
  courseByKey: Map<string, CourseAssignment>
  rooms: Map<string, ClassroomOption>
  /** Declared availability; a faculty member absent from the map is available at all times */
  facultyAvailable: Map<string, Set<string>>
  occupancy: Occupancy
}

export function buildSchedulingContext(
  courses: CourseAssignment[],
  rooms: ClassroomOption[],
  availability: FacultyAvailabilitySlot[],
  occupancy: Occupancy,
): SchedulingContext {
  const courseByKey = new Map<string, CourseAssignment>()
  for (const c of courses) courseByKey.set(courseKey(c.sectionId, c.subjectId), c)

  const facultyAvailable = new Map<string, Set<string>>()
  for (const a of availability) {
    if (!facultyAvailable.has(a.facultyId)) facultyAvailable.set(a.facultyId, new Set())
    for (let p = a.startPeriod; p <= a.endPeriod; p++) facultyAvailable.get(a.facultyId)!.add(slotKey(a.dayOfWeek, p))
  }

  return {
    courses,
    courseByKey,
    rooms: new Map(rooms.map((r) => [r.id, r])),
    facultyAvailable,
    occupancy,
  }
}

export function isFacultyDeclaredAvailable(ctx: SchedulingContext, facultyId: string, key: string): boolean {
  const declared = ctx.facultyAvailable.get(facultyId)
  return !declared || declared.has(key)
}

/** Day/period placement rules that do not depend on other slots (HC8, HC9, lunch) */
export function respectsCalendarRules(slot: TimetableSlot, yearLevel: number): boolean {
  if (slot.startPeriod < 1 || slot.endPeriod > PERIODS_PER_DAY || slot.endPeriod < slot.startPeriod) return false
  if (slot.day < 0 || slot.day >= DAYS_PER_WEEK) return false
  if (slot.startPeriod <= HARD_RULES.LUNCH_AFTER_PERIOD && slot.endPeriod > HARD_RULES.LUNCH_AFTER_PERIOD) return false
  if (slot.day === HARD_RULES.SATURDAY && yearLevel !== 1 && slot.endPeriod > HARD_RULES.SATURDAY_LAST_PERIOD_NON_FIRST_YEAR) {
    return false
  }
  return true
}

export interface HardConstraintReport {
  facultyOverlap: number
  roomOverlap: number
  sectionOverlap: number
  crossDepartmentClash: number
  facultyAvailability: number
  calendarRules: number
  theoryDailyLimit: number
  roomTypeOrCapacity: number
  coverageDeficitPeriods: number
  coverageSurplusPeriods: number
  /** Double bookings of any kind: these make a timetable unusable */
  criticalViolations: number
  totalViolations: number
  requiredPeriods: number
  scheduledPeriods: number
  coveragePercent: number
}

export function evaluateHardConstraints(slots: TimetableSlot[], ctx: SchedulingContext): HardConstraintReport {
  const report: HardConstraintReport = {
    facultyOverlap: 0,
    roomOverlap: 0,
    sectionOverlap: 0,
    crossDepartmentClash: 0,
    facultyAvailability: 0,
    calendarRules: 0,
    theoryDailyLimit: 0,
    roomTypeOrCapacity: 0,
    coverageDeficitPeriods: 0,
    coverageSurplusPeriods: 0,
    criticalViolations: 0,
    totalViolations: 0,
    requiredPeriods: 0,
    scheduledPeriods: 0,
    coveragePercent: 0,
  }

  const faculty = new Map<string, Set<string>>()
  const rooms = new Map<string, Set<string>>()
  const sections = new Map<string, Set<string>>()
  const subjectDay = new Map<string, number>()
  const periodsPerCourse = new Map<string, number>()

  const occupy = (map: Map<string, Set<string>>, id: string, key: string): boolean => {
    if (!map.has(id)) map.set(id, new Set())
    const set = map.get(id)!
    if (set.has(key)) return false
    set.add(key)
    return true
  }

  for (const slot of slots) {
    const ck = courseKey(slot.sectionId, slot.subjectId)
    const course = ctx.courseByKey.get(ck)
    const room = ctx.rooms.get(slot.classroomId)
    periodsPerCourse.set(ck, (periodsPerCourse.get(ck) || 0) + slotPeriods(slot))

    if (!respectsCalendarRules(slot, course?.yearLevel ?? 1)) report.calendarRules++

    if (course && room) {
      const typeOk = room.roomType === course.subjectType
      const capacityOk = room.capacity >= Math.floor(course.studentCount * HARD_RULES.ROOM_CAPACITY_TOLERANCE)
      if (!typeOk || !capacityOk) report.roomTypeOrCapacity++
    }

    if (course?.subjectType === "theory") {
      const dk = `${ck}|${slot.day}`
      subjectDay.set(dk, (subjectDay.get(dk) || 0) + slotPeriods(slot))
    }

    for (let p = slot.startPeriod; p <= slot.endPeriod; p++) {
      const key = slotKey(slot.day, p)
      if (!occupy(faculty, slot.facultyId, key)) report.facultyOverlap++
      if (!occupy(rooms, slot.classroomId, key)) report.roomOverlap++
      if (!occupy(sections, slot.sectionId, key)) report.sectionOverlap++
      if (ctx.occupancy.facultyBusy.get(slot.facultyId)?.has(key) || ctx.occupancy.roomBusy.get(slot.classroomId)?.has(key)) {
        report.crossDepartmentClash++
      }
      if (!isFacultyDeclaredAvailable(ctx, slot.facultyId, key)) report.facultyAvailability++
    }
  }

  for (const periods of subjectDay.values()) {
    if (periods > HARD_RULES.MAX_THEORY_PERIODS_PER_DAY_PER_SUBJECT) report.theoryDailyLimit++
  }

  for (const course of ctx.courses) {
    const ck = courseKey(course.sectionId, course.subjectId)
    const scheduled = periodsPerCourse.get(ck) || 0
    report.requiredPeriods += course.periodsPerWeek
    report.scheduledPeriods += Math.min(scheduled, course.periodsPerWeek)
    if (scheduled < course.periodsPerWeek) report.coverageDeficitPeriods += course.periodsPerWeek - scheduled
    if (scheduled > course.periodsPerWeek) report.coverageSurplusPeriods += scheduled - course.periodsPerWeek
  }

  report.coveragePercent = report.requiredPeriods > 0 ? (report.scheduledPeriods / report.requiredPeriods) * 100 : 100
  report.criticalViolations = report.facultyOverlap + report.roomOverlap + report.sectionOverlap + report.crossDepartmentClash
  report.totalViolations =
    report.criticalViolations +
    report.facultyAvailability +
    report.calendarRules +
    report.theoryDailyLimit +
    report.roomTypeOrCapacity +
    report.coverageDeficitPeriods +
    report.coverageSurplusPeriods
  return report
}

/**
 * Incremental occupancy grid used by the enhanced operators (SCPX, block mutation,
 * incremental rescheduling). A move is applied only if every hard constraint still
 * holds, so offspring never need repair.
 */
export class FeasibilityGrid {
  private faculty = new Map<string, Uint8Array>()
  private rooms = new Map<string, Uint8Array>()
  private sections = new Map<string, Uint8Array>()
  private subjectDay = new Map<string, Uint8Array>()
  private roomTypeUse = { theory: new Uint16Array(DAYS_PER_WEEK * PERIODS_PER_DAY), lab: new Uint16Array(DAYS_PER_WEEK * PERIODS_PER_DAY) }
  /** When true the college-wide room reservation is ignored (only real room availability counts) */
  borrowReserve = false

  constructor(private ctx: SchedulingContext) {}

  static fromSlots(ctx: SchedulingContext, slots: TimetableSlot[]): FeasibilityGrid {
    const grid = new FeasibilityGrid(ctx)
    for (const s of slots) grid.add(s)
    return grid
  }

  private cells(map: Map<string, Uint8Array>, id: string, size: number): Uint8Array {
    let arr = map.get(id)
    if (!arr) {
      arr = new Uint8Array(size)
      map.set(id, arr)
    }
    return arr
  }

  private index(day: number, period: number): number {
    return day * PERIODS_PER_DAY + (period - 1)
  }

  add(slot: TimetableSlot): void {
    this.update(slot, 1)
  }

  remove(slot: TimetableSlot): void {
    this.update(slot, -1)
  }

  private update(slot: TimetableSlot, delta: number): void {
    const size = DAYS_PER_WEEK * PERIODS_PER_DAY
    const f = this.cells(this.faculty, slot.facultyId, size)
    const r = this.cells(this.rooms, slot.classroomId, size)
    const s = this.cells(this.sections, slot.sectionId, size)
    const roomType = this.ctx.rooms.get(slot.classroomId)?.roomType
    for (let p = slot.startPeriod; p <= slot.endPeriod; p++) {
      const i = this.index(slot.day, p)
      f[i] += delta
      r[i] += delta
      s[i] += delta
      if (roomType) this.roomTypeUse[roomType][i] += delta
    }
    const course = this.ctx.courseByKey.get(courseKey(slot.sectionId, slot.subjectId))
    if (course?.subjectType === "theory") {
      const sd = this.cells(this.subjectDay, courseKey(slot.sectionId, slot.subjectId), DAYS_PER_WEEK)
      sd[slot.day] += delta * slotPeriods(slot)
    }
  }

  /**
   * Room-independent part of canPlace (calendar rules, section and faculty free, faculty
   * availability, other departments' occupancy, 2 periods/day). Cheap array lookups, used
   * to screen candidate positions before any room search.
   */
  timeFree(slot: TimetableSlot): boolean {
    const course = this.ctx.courseByKey.get(courseKey(slot.sectionId, slot.subjectId))
    if (!respectsCalendarRules(slot, course?.yearLevel ?? 1)) return false

    if (course?.subjectType === "theory") {
      const used = this.subjectDay.get(courseKey(slot.sectionId, slot.subjectId))?.[slot.day] || 0
      if (used + slotPeriods(slot) > HARD_RULES.MAX_THEORY_PERIODS_PER_DAY_PER_SUBJECT) return false
    }

    const f = this.faculty.get(slot.facultyId)
    const s = this.sections.get(slot.sectionId)
    const facultyBusy = this.ctx.occupancy.facultyBusy.get(slot.facultyId)
    for (let p = slot.startPeriod; p <= slot.endPeriod; p++) {
      const i = this.index(slot.day, p)
      if ((f && f[i] > 0) || (s && s[i] > 0)) return false
      const key = slotKey(slot.day, p)
      if (facultyBusy?.has(key)) return false
      if (!isFacultyDeclaredAvailable(this.ctx, slot.facultyId, key)) return false
    }
    return true
  }

  /** Room part of canPlace: right type, enough seats, free in this and other departments' timetables */
  roomFree(slot: TimetableSlot): boolean {
    const course = this.ctx.courseByKey.get(courseKey(slot.sectionId, slot.subjectId))
    const room = this.ctx.rooms.get(slot.classroomId)
    if (course && room) {
      if (room.roomType !== course.subjectType) return false
      if (room.capacity < Math.floor(course.studentCount * HARD_RULES.ROOM_CAPACITY_TOLERANCE)) return false
    }
    const r = this.rooms.get(slot.classroomId)
    const roomBusy = this.ctx.occupancy.roomBusy.get(slot.classroomId)
    const caps = room && !this.borrowReserve ? this.ctx.occupancy.roomCaps?.[room.roomType] : undefined
    for (let p = slot.startPeriod; p <= slot.endPeriod; p++) {
      const i = this.index(slot.day, p)
      if (r && r[i] > 0) return false
      const key = slotKey(slot.day, p)
      if (roomBusy?.has(key)) return false
      // College-wide reservation: a room that is new at this period must fit under the cap
      if (caps && room && (!r || r[i] === 0) && this.roomTypeUse[room.roomType][i] + 1 > (caps.get(key) ?? Infinity)) return false
    }
    return true
  }

  /** True if `slot` can be added to the current grid without breaking any hard constraint */
  canPlace(slot: TimetableSlot): boolean {
    return this.timeFree(slot) && this.roomFree(slot)
  }

  /** Free rooms of the right type/capacity for `slot` at its current time (current room first) */
  roomsFor(slot: TimetableSlot): string[] {
    if (!this.timeFree(slot)) return []
    const course = this.ctx.courseByKey.get(courseKey(slot.sectionId, slot.subjectId))
    const result: string[] = []
    // Current room first: keeps rooms stable and usually succeeds immediately
    if (this.roomFree(slot)) result.push(slot.classroomId)
    for (const room of this.ctx.rooms.values()) {
      if (room.id === slot.classroomId || (course && room.roomType !== course.subjectType)) continue
      if (this.roomFree({ ...slot, classroomId: room.id })) result.push(room.id)
    }
    return result
  }
}
