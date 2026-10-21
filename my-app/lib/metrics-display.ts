import type { JobMetrics, TimetableJob } from "@/lib/database"

// Evaluation metrics shown when comparing a "before enhancement" run with an "after
// enhancement" run on the same set of sections (Section 5.3 of the research paper).

export interface MetricDefinition {
  key: string
  group: "Hard constraints" | "Timetable quality (f1-f5)" | "Search process" | "Multi-objective" | "Runtime"
  label: string
  description: string
  higherIsBetter: boolean
  /** Runtime is reported but not counted when deciding which pipeline is better */
  countsTowardVerdict: boolean
  get: (m: JobMetrics, job: TimetableJob) => number | undefined
  format: (v: number) => string
}

const fixed = (d: number) => (v: number) => v.toFixed(d)
const percent = (v: number) => `${v.toFixed(1)}%`
const ms = (v: number) => `${Math.round(v)} ms`

export const METRICS: MetricDefinition[] = [
  { key: "violations", group: "Hard constraints", label: "Hard-constraint violations", description: "Double bookings, availability breaches, >2 periods/day of a subject, lunch/Saturday rules, room type/capacity", higherIsBetter: false, countsTowardVerdict: true, get: (m) => m.final?.hard.totalViolations, format: fixed(0) },
  { key: "critical", group: "Hard constraints", label: "Double bookings (incl. other departments)", description: "Faculty, room or section in two places at once", higherIsBetter: false, countsTowardVerdict: true, get: (m) => m.final?.hard.criticalViolations, format: fixed(0) },
  { key: "availability", group: "Hard constraints", label: "Faculty availability breaches", description: "Periods outside a faculty member's declared availability", higherIsBetter: false, countsTowardVerdict: true, get: (m) => m.final?.hard.facultyAvailability, format: fixed(0) },
  { key: "dailyLimit", group: "Hard constraints", label: "Subjects >2 periods in a day", description: "Theory subject scheduled more than twice on one day for a section", higherIsBetter: false, countsTowardVerdict: true, get: (m) => m.final?.hard.theoryDailyLimit, format: fixed(0) },
  { key: "coverage", group: "Hard constraints", label: "Coverage", description: "Required weekly periods that are scheduled", higherIsBetter: true, countsTowardVerdict: true, get: (m) => m.final?.hard.coveragePercent, format: percent },

  { key: "f1", group: "Timetable quality (f1-f5)", label: "f1 Faculty idle-gap score", description: "1 - idle periods between a faculty member's first and last class", higherIsBetter: true, countsTowardVerdict: true, get: (m) => m.final?.objectives.facultyGap, format: fixed(3) },
  { key: "f2", group: "Timetable quality (f1-f5)", label: "f2 Student idle-gap score", description: "1 - idle periods in a section's day", higherIsBetter: true, countsTowardVerdict: true, get: (m) => m.final?.objectives.studentGap, format: fixed(3) },
  { key: "f3", group: "Timetable quality (f1-f5)", label: "f3 Workload balance", description: "1 - coefficient of variation of each faculty member's daily load", higherIsBetter: true, countsTowardVerdict: true, get: (m) => m.final?.objectives.workloadBalance, format: fixed(3) },
  { key: "f4", group: "Timetable quality (f1-f5)", label: "f4 Morning preference", description: "Share of periods in P1-P4", higherIsBetter: true, countsTowardVerdict: true, get: (m) => m.final?.objectives.morningPreference, format: fixed(3) },
  { key: "f5", group: "Timetable quality (f1-f5)", label: "f5 Lab compactness", description: "Labs placed early in the week", higherIsBetter: true, countsTowardVerdict: true, get: (m) => m.final?.objectives.labCompactness, format: fixed(3) },
  { key: "quality", group: "Timetable quality (f1-f5)", label: "Weighted quality Q", description: "0.30 f1 + 0.25 f2 + 0.20 f3 + 0.15 f4 + 0.10 f5 (the baseline's own weighting)", higherIsBetter: true, countsTowardVerdict: true, get: (m) => m.final?.quality, format: fixed(4) },

  { key: "cp", group: "Search process", label: "Constraint preservation (CP)", description: "Offspring that keep every hard constraint without repair", higherIsBetter: true, countsTowardVerdict: true, get: (m) => m.process?.constraintPreservation, format: percent },
  { key: "crossover", group: "Search process", label: "Crossover acceptance", description: "Attempted gene/coordinate-group exchanges that were kept", higherIsBetter: true, countsTowardVerdict: true, get: (m) => m.process?.crossoverAcceptance, format: percent },
  { key: "pie", group: "Search process", label: "Initial population diversity (PIE)", description: "Mean pairwise Hamming distance of the starting population", higherIsBetter: true, countsTowardVerdict: true, get: (m) => m.process?.initialDiversity, format: fixed(3) },
  { key: "gd", group: "Search process", label: "Final population diversity (GD)", description: "Mean pairwise Hamming distance after the last generation", higherIsBetter: true, countsTowardVerdict: true, get: (m) => m.process?.finalDiversity, format: fixed(3) },
  { key: "mutation", group: "Search process", label: "Mutation attempts per accepted move", description: "Candidate placements evaluated per mutation that was applied", higherIsBetter: false, countsTowardVerdict: true, get: (m) => m.process?.mutationAttemptsPerAcceptedMove, format: fixed(2) },

  { key: "hv", group: "Multi-objective", label: "Hypervolume (solutions offered)", description: "Objective-space volume dominated by the timetables handed to the administrator", higherIsBetter: true, countsTowardVerdict: true, get: (m) => m.process?.hypervolume, format: fixed(4) },
  { key: "hvPop", group: "Multi-objective", label: "Hypervolume (final population)", description: "Volume dominated by the non-dominated members of the final population", higherIsBetter: true, countsTowardVerdict: true, get: (m) => m.process?.populationHypervolume, format: fixed(4) },
  { key: "front", group: "Multi-objective", label: "Best timetables offered", description: "Non-dominated timetables the administrator can choose from (the enhanced run offers the best 3 by hypervolume contribution)", higherIsBetter: true, countsTowardVerdict: true, get: (m) => m.process?.paretoFrontSize, format: fixed(0) },
  { key: "fullFront", group: "Multi-objective", label: "Non-dominated solutions found", description: "Size of the final Pareto front before picking the offered timetables", higherIsBetter: true, countsTowardVerdict: false, get: (m) => m.process?.fullFrontSize, format: fixed(0) },

  { key: "baseTime", group: "Runtime", label: "ILP / seeding time", description: "Base stage wall-clock time", higherIsBetter: false, countsTowardVerdict: false, get: (_m, job) => job.base_generation_time, format: ms },
  { key: "optTime", group: "Runtime", label: "Optimization time", description: "GA / NSGA-II wall-clock time", higherIsBetter: false, countsTowardVerdict: false, get: (_m, job) => job.optimization_time, format: ms },
  { key: "gens", group: "Runtime", label: "Generations run", description: "The enhanced search stops early once the best solution stops improving", higherIsBetter: false, countsTowardVerdict: false, get: (m) => m.process?.generationsRun, format: fixed(0) },
]

export type Winner = "baseline" | "enhanced" | "tie" | null

export function compareMetric(def: MetricDefinition, baseline: TimetableJob, enhanced: TimetableJob): { b?: number; e?: number; winner: Winner; deltaPercent: number | null } {
  const b = def.get(baseline.metrics || {}, baseline)
  const e = def.get(enhanced.metrics || {}, enhanced)
  if (b === undefined || e === undefined || b === null || e === null) return { b, e, winner: null, deltaPercent: null }
  const winner: Winner = Math.abs(b - e) < 1e-9 ? "tie" : (def.higherIsBetter ? e > b : e < b) ? "enhanced" : "baseline"
  const deltaPercent = b !== 0 ? ((e - b) / Math.abs(b)) * 100 : null
  return { b, e, winner, deltaPercent }
}

export function comparisonRows(baseline: TimetableJob, enhanced: TimetableJob) {
  return METRICS.map((def) => ({ def, ...compareMetric(def, baseline, enhanced) }))
}

export function comparisonCsv(baseline: TimetableJob, enhanced: TimetableJob): string {
  const header = "group,metric,baseline,enhanced,better,delta_percent,higher_is_better"
  const lines = comparisonRows(baseline, enhanced).map(({ def, b, e, winner, deltaPercent }) =>
    [def.group, `"${def.label}"`, b ?? "", e ?? "", winner ?? "", deltaPercent === null ? "" : deltaPercent.toFixed(2), def.higherIsBetter].join(","),
  )
  return [header, ...lines].join("\n")
}
