// Database access shared by the edge functions: session -> department admin, loading a
// department's scheduling problem, and the college-wide occupancy of published timetables.

import {
  buildOccupancy,
  ClassroomOption,
  CourseAssignment,
  DayOfWeek,
  FacultyAvailabilitySlot,
  Occupancy,
  Period,
  TimetableSlot,
} from "./scheduling-types.ts"
import { corsHeaders } from "./cors.ts"

// deno-lint-ignore no-explicit-any
type Supabase = any

export interface DepartmentAdminSession {
  id: string
  name: string
  departmentId: string
  collegeId: string
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

/** Validates the caller's session token server-side (the token never grants more than its role) */
export async function resolveDepartmentAdmin(supabase: Supabase, sessionToken: unknown): Promise<DepartmentAdminSession | null> {
  if (typeof sessionToken !== "string" || sessionToken.length < 16) return null
  const { data: session } = await supabase
    .from("user_sessions")
    .select("user_id, user_type, expires_at")
    .eq("session_token", sessionToken)
    .eq("user_type", "department_admin")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle()
  if (!session) return null

  const { data: admin } = await supabase
    .from("department_admins")
    .select("id, name, department_id, college_id, is_active")
    .eq("id", session.user_id)
    .maybeSingle()
  if (!admin || !admin.is_active) return null
  return { id: admin.id, name: admin.name, departmentId: admin.department_id, collegeId: admin.college_id }
}

export interface DepartmentProblem {
  courses: CourseAssignment[]
  rooms: ClassroomOption[]
  availability: FacultyAvailabilitySlot[]
  occupancy: Occupancy
  committedSlotCount: number
}

/**
 * Courses of the selected sections, the college's classrooms, declared faculty availability,
 * and the occupancy created by every published timetable in the college EXCEPT the selected
 * sections themselves (those are being regenerated).
 */
export async function loadDepartmentProblem(supabase: Supabase, collegeId: string, sectionIds: string[]): Promise<DepartmentProblem> {
  const [sectionSubjects, classrooms, committed] = await Promise.all([
    supabase.from("section_subjects").select("*, sections(*), subjects(*), faculty(*)").in("section_id", sectionIds),
    supabase.from("classrooms").select("*").eq("college_id", collegeId),
    supabase
      .from("committed_timetable")
      .select("faculty_id, classroom_id, section_id, day_of_week, start_period, end_period")
      .eq("college_id", collegeId),
  ])
  if (sectionSubjects.error) throw new Error(`Database error (section_subjects): ${sectionSubjects.error.message}`)
  if (classrooms.error) throw new Error(`Database error (classrooms): ${classrooms.error.message}`)
  if (committed.error) throw new Error(`Database error (committed_timetable): ${committed.error.message}`)

  // deno-lint-ignore no-explicit-any
  const courses: CourseAssignment[] = (sectionSubjects.data || []).map((ss: any) => ({
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

  // deno-lint-ignore no-explicit-any
  const rooms: ClassroomOption[] = (classrooms.data || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    capacity: c.capacity,
    roomType: c.room_type,
  }))

  const facultyIds = [...new Set(courses.map((c) => c.facultyId))]
  let availability: FacultyAvailabilitySlot[] = []
  if (facultyIds.length > 0) {
    const { data, error } = await supabase.from("faculty_availability").select("*").in("faculty_id", facultyIds)
    if (error) throw new Error(`Database error (faculty_availability): ${error.message}`)
    // deno-lint-ignore no-explicit-any
    availability = (data || []).map((a: any) => ({
      facultyId: a.faculty_id,
      dayOfWeek: a.day_of_week,
      startPeriod: a.start_period,
      endPeriod: a.end_period,
    }))
  }

  const selected = new Set(sectionIds)
  // deno-lint-ignore no-explicit-any
  const otherRows = (committed.data || []).filter((row: any) => !selected.has(row.section_id))

  return {
    courses,
    rooms,
    availability,
    occupancy: buildOccupancy(otherRows),
    committedSlotCount: otherRows.length,
  }
}

export function toSlotRows(jobId: string, slots: TimetableSlot[], createdBy: string, fitness?: number) {
  return slots.map((slot) => ({
    job_id: jobId,
    section_id: slot.sectionId,
    subject_id: slot.subjectId,
    faculty_id: slot.facultyId,
    classroom_id: slot.classroomId,
    day_of_week: slot.day,
    start_period: slot.startPeriod,
    end_period: slot.endPeriod,
    created_by: createdBy,
    ...(fitness !== undefined ? { fitness_score: Number(fitness.toFixed(4)) } : {}),
  }))
}

// deno-lint-ignore no-explicit-any
export function fromSlotRows(rows: any[]): TimetableSlot[] {
  return rows.map((row) => ({
    sectionId: row.section_id,
    subjectId: row.subject_id,
    facultyId: row.faculty_id,
    classroomId: row.classroom_id,
    day: row.day_of_week as DayOfWeek,
    startPeriod: row.start_period as Period,
    endPeriod: row.end_period as Period,
  }))
}

/** Compact JSON encoding for seed populations / Pareto fronts stored on the job row */
export type PackedSlot = [string, string, string, string, number, number, number]

export function packSlots(slots: TimetableSlot[]): PackedSlot[] {
  return slots.map((s) => [s.sectionId, s.subjectId, s.facultyId, s.classroomId, s.day, s.startPeriod, s.endPeriod])
}

export function unpackSlots(packed: PackedSlot[]): TimetableSlot[] {
  return packed.map(([sectionId, subjectId, facultyId, classroomId, day, start, end]) => ({
    sectionId,
    subjectId,
    facultyId,
    classroomId,
    day: day as DayOfWeek,
    startPeriod: start as Period,
    endPeriod: end as Period,
  }))
}

export function sectionKeyOf(sectionIds: string[]): string {
  return [...sectionIds].sort().join(",")
}
