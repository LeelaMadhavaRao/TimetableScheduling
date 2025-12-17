export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const
export const DAY_CODES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const

// Period timings
export const PERIOD_TIMINGS = [
  { period: 1, start: "9:00", end: "9:45", session: "morning" },
  { period: 2, start: "9:45", end: "10:30", session: "morning" },
  { period: 3, start: "10:30", end: "11:15", session: "morning" },
  { period: 4, start: "11:15", end: "12:00", session: "morning" },
  { period: 5, start: "1:30", end: "2:15", session: "afternoon" },
  { period: 6, start: "2:15", end: "3:00", session: "afternoon" },
  { period: 7, start: "3:00", end: "3:45", session: "afternoon" },
  { period: 8, start: "3:45", end: "4:30", session: "afternoon" },
] as const

export const LUNCH_BREAK = { start: "12:00", end: "1:30" }

// Scheduling rules
export const RULES = {
  LAB_PERIODS: 4, // 4 consecutive periods = 3 hours
  PERIOD_DURATION_MINS: 45,
  SATURDAY_MORNING_ONLY: true,
  SATURDAY_AFTERNOON_FOR_FIRST_YEAR_LABS: true, // Only if labs overflow
  MAX_THEORY_PERIODS_PER_DAY: 2, // 1.5 hours max per day for theory
  FACULTY_GAP_RULE: 3, // If teaching P1-2, next slot from P5-8
} as const

// GA Configuration
export const GA_CONFIG = {
  POPULATION_SIZE: 50,
  GENERATIONS: 100,
  MUTATION_RATE: 0.1,
  CROSSOVER_RATE: 0.8,
  ELITE_PERCENTAGE: 0.1,
  TOURNAMENT_SIZE: 5,
} as const

// Fitness weights
export const FITNESS_WEIGHTS = {
  FACULTY_GAPS: 0.3,
  STUDENT_GAPS: 0.25,
  WORKLOAD_BALANCE: 0.2,
  MORNING_PREFERENCE: 0.15,
  LAB_COMPACTNESS: 0.1,
} as const
