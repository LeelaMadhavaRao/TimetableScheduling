export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 // Monday to Saturday
export type Period = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
export type SubjectType = "theory" | "lab"
export type RoomType = "lab" | "theory"
export type YearLevel = 1 | 2 | 3 | 4

export type JobStatus = "pending" | "generating_base" | "base_complete" | "optimizing" | "completed" | "failed"

export interface Department {
  id: string
  name: string
  code: string
  created_at: string
  updated_at: string
}

export interface Faculty {
  id: string
  code: string
  name: string
  email?: string
  department_id?: string
  phone?: string
  created_at: string
  updated_at: string
}

export interface FacultyAvailability {
  id: string
  faculty_id: string
  day_of_week: DayOfWeek
  start_period: Period
  end_period: Period
  created_at: string
}

export interface Subject {
  id: string
  name: string
  code: string
  subject_type: SubjectType
  periods_per_week: number
  department_id?: string
  created_at: string
  updated_at: string
}

export interface SubjectFaculty {
  id: string
  subject_id: string
  faculty_id: string
  created_at: string
}

export interface Classroom {
  id: string
  name: string
  capacity: number
  room_type: RoomType
  building?: string
  floor?: number
  created_at: string
  updated_at: string
}

export interface Section {
  id: string
  name: string
  year_level: YearLevel
  student_count: number
  department_id?: string
  created_at: string
  updated_at: string
}

export interface SectionSubject {
  id: string
  section_id: string
  subject_id: string
  faculty_id: string
  created_at: string
}

export interface TimetableJob {
  id: string
  status: JobStatus
  progress: number
  message?: string
  base_generation_time?: number
  optimization_time?: number
  created_at: string
  updated_at: string
}

export interface TimetableSlot {
  id: string
  job_id: string
  section_id: string
  subject_id: string
  faculty_id: string
  classroom_id: string
  day_of_week: DayOfWeek
  start_period: Period
  end_period: Period
  created_at: string
}

export interface TimetableOptimizedSlot extends TimetableSlot {
  fitness_score?: number
}

// Helper types for joined queries
export interface SubjectWithFaculty extends Subject {
  faculty?: Faculty
}

export interface SectionSubjectWithDetails extends SectionSubject {
  subject?: Subject
  faculty?: Faculty
}

export interface TimetableSlotWithDetails extends TimetableSlot {
  section?: Section
  subject?: Subject
  faculty?: Faculty
  classroom?: Classroom
}
