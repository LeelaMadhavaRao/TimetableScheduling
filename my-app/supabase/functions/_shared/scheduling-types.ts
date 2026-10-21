// Shared scheduling types used by the generation, optimization and evaluation modules.
// Kept free of Deno/npm imports so the algorithms can also be run under Node for experiments.

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5
export type Period = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
export type SubjectType = "theory" | "lab"
export type AlgorithmMode = "baseline" | "enhanced"

export const DAYS_PER_WEEK = 6
export const PERIODS_PER_DAY = 8

export interface TimetableSlot {
  sectionId: string
  subjectId: string
  facultyId: string
  classroomId: string
  day: DayOfWeek
  startPeriod: Period
  endPeriod: Period
}

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

/**
 * Faculty/room time already committed by OTHER sections (published timetables of
 * other departments, or locked slots during incremental rescheduling).
 * Keys are "day-period".
 */
export interface Occupancy {
  facultyBusy: Map<string, Set<string>>
  roomBusy: Map<string, Set<string>>
  /** Optional human-readable owner of each busy faculty slot, for diagnostics */
  facultyOwner?: Map<string, string>
}

export interface OccupiedRow {
  faculty_id: string
  classroom_id: string
  section_id?: string
  day_of_week: number
  start_period: number
  end_period: number
}

export function slotKey(day: number, period: number): string {
  return `${day}-${period}`
}

export function courseKey(sectionId: string, subjectId: string): string {
  return `${sectionId}|${subjectId}`
}

export function emptyOccupancy(): Occupancy {
  return { facultyBusy: new Map(), roomBusy: new Map(), facultyOwner: new Map() }
}

export function buildOccupancy(rows: OccupiedRow[], ownerLabel?: (row: OccupiedRow) => string): Occupancy {
  const occupancy = emptyOccupancy()
  for (const row of rows) {
    for (let p = row.start_period; p <= row.end_period; p++) {
      const key = slotKey(row.day_of_week, p)
      if (!occupancy.facultyBusy.has(row.faculty_id)) occupancy.facultyBusy.set(row.faculty_id, new Set())
      occupancy.facultyBusy.get(row.faculty_id)!.add(key)
      if (!occupancy.roomBusy.has(row.classroom_id)) occupancy.roomBusy.set(row.classroom_id, new Set())
      occupancy.roomBusy.get(row.classroom_id)!.add(key)
      if (ownerLabel) occupancy.facultyOwner!.set(`${row.faculty_id}@${key}`, ownerLabel(row))
    }
  }
  return occupancy
}

export function mergeOccupancy(a: Occupancy, b: Occupancy): Occupancy {
  const merged = emptyOccupancy()
  for (const source of [a, b]) {
    for (const [id, keys] of source.facultyBusy) {
      if (!merged.facultyBusy.has(id)) merged.facultyBusy.set(id, new Set())
      keys.forEach((k) => merged.facultyBusy.get(id)!.add(k))
    }
    for (const [id, keys] of source.roomBusy) {
      if (!merged.roomBusy.has(id)) merged.roomBusy.set(id, new Set())
      keys.forEach((k) => merged.roomBusy.get(id)!.add(k))
    }
    source.facultyOwner?.forEach((v, k) => merged.facultyOwner!.set(k, v))
  }
  return merged
}

export function slotPeriods(slot: TimetableSlot): number {
  return slot.endPeriod - slot.startPeriod + 1
}

export function cloneSlots(slots: TimetableSlot[]): TimetableSlot[] {
  return slots.map((s) => ({ ...s }))
}

/** Deterministic PRNG (mulberry32) so experiments can be repeated with a seed */
export function createRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
