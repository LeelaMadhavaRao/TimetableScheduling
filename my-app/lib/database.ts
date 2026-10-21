export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 // Monday to Saturday
export type Period = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
export type SubjectType = "theory" | "lab"
export type RoomType = "lab" | "theory"
export type YearLevel = 1 | 2 | 3 | 4

export type JobStatus = "pending" | "generating_base" | "base_complete" | "optimizing" | "completed" | "failed"
export type AlgorithmMode = "baseline" | "enhanced"
export type RunType = "full" | "reschedule"

export interface Department {
  id: string
  name: string
  code: string
  college_id?: string
  created_at: string
  updated_at: string
}

export interface Faculty {
  id: string
  code: string
  name: string
  email?: string
  department_id?: string
  college_id?: string
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
  college_id?: string
  department_id?: string
  section_ids?: string[]
  section_key?: string
  algorithm_mode?: AlgorithmMode
  run_type?: RunType
  parent_job_id?: string | null
  is_published?: boolean
  published_at?: string | null
  metrics?: JobMetrics
  pareto_front?: ParetoEntry[] | null
  selected_solution?: number | null
}

/** Evaluation metrics recorded by the edge functions (supabase/functions/_shared/pipeline.ts) */
export interface ObjectiveValues {
  facultyGap: number
  studentGap: number
  workloadBalance: number
  morningPreference: number
  labCompactness: number
}

export interface HardConstraintValues {
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
  criticalViolations: number
  totalViolations: number
  coveragePercent: number
}

export interface TimetableSummaryMetrics {
  objectives: ObjectiveValues
  quality: number
  hard: HardConstraintValues
  slotCount: number
  timeMs?: number
  diversification?: {
    seedCount: number
    seedsGenerated: number
    labVariantsFromILP: number
    labSource: string
    meanPairwiseHamming: number
    solverMessage: string | null
  } | null
}

export interface JobMetrics {
  mode?: AlgorithmMode
  base?: TimetableSummaryMetrics
  final?: TimetableSummaryMetrics
  process?: {
    populationSize: number
    generations: number
    initialDiversity: number
    finalDiversity: number
    constraintPreservation: number
    offspringEvaluated: number
    crossoverAcceptance: number
    rejectedOperations: number
    mutationAttemptsPerAcceptedMove: number
    convergenceGeneration: number
    hypervolume: number
    populationHypervolume: number
    paretoFrontSize: number
    frontSpread: number
    optimizationTimeMs: number
  }
  reschedule?: {
    latencyMs: number
    totalSlots: number
    affectedSlots: number
    scheduleAffectedFraction: number
    lockRatio: number
    lockRatioTarget: number
    lockRatioSatisfied: boolean
    periodsToReplace: number
    periodsReplaced: number
    changedCourseFraction: number
    qualityBefore: number
    qualityAfter: number
    qualityChangePercent: number
    referenceFullRegenerationMs: number
    speedup: number | null
  }
}

export interface ParetoEntry {
  objectives: ObjectiveValues
  quality: number
  slots: unknown[]
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
