// Evaluation metrics (Section 5.3 of the research paper). Every run, baseline or
// enhanced, is scored with these same functions so the comparison is apples-to-apples.

import { evaluateHardConstraints, HardConstraintReport, SchedulingContext } from "./constraints.ts"
import { courseKey, DAYS_PER_WEEK, PERIODS_PER_DAY, slotPeriods, TimetableSlot } from "./scheduling-types.ts"

/** All five objectives are expressed as "higher is better" in [0, 1] */
export interface ObjectiveVector {
  facultyGap: number // f1' = 1 - normalized faculty idle gaps
  studentGap: number // f2' = 1 - normalized student idle gaps
  workloadBalance: number // f3  = 1 - mean coefficient of variation of daily load
  morningPreference: number // f4  = share of periods in P1-P4
  labCompactness: number // f5  = labs early in the week
}

export const OBJECTIVE_KEYS: (keyof ObjectiveVector)[] = [
  "facultyGap",
  "studentGap",
  "workloadBalance",
  "morningPreference",
  "labCompactness",
]

/** Weights of the baseline weighted-sum fitness F = 0.3 FG + 0.25 SG + 0.2 WB + 0.15 MP + 0.1 LC */
export const BASELINE_WEIGHTS: ObjectiveVector = {
  facultyGap: 0.3,
  studentGap: 0.25,
  workloadBalance: 0.2,
  morningPreference: 0.15,
  labCompactness: 0.1,
}

function idleGapScore(groups: Map<string, Map<number, number[]>>): number {
  let totalGapRatio = 0
  let teachingDays = 0
  for (const days of groups.values()) {
    for (const periods of days.values()) {
      if (periods.length === 0) continue
      periods.sort((a, b) => a - b)
      const span = periods[periods.length - 1] - periods[0] + 1
      totalGapRatio += (span - periods.length) / PERIODS_PER_DAY
      teachingDays++
    }
  }
  return teachingDays > 0 ? 1 - totalGapRatio / teachingDays : 1
}

function collect(slots: TimetableSlot[], keyOf: (s: TimetableSlot) => string): Map<string, Map<number, number[]>> {
  const groups = new Map<string, Map<number, number[]>>()
  for (const slot of slots) {
    const id = keyOf(slot)
    if (!groups.has(id)) groups.set(id, new Map())
    const days = groups.get(id)!
    if (!days.has(slot.day)) days.set(slot.day, [])
    for (let p = slot.startPeriod; p <= slot.endPeriod; p++) days.get(slot.day)!.push(p)
  }
  return groups
}

export function computeObjectives(slots: TimetableSlot[], ctx: SchedulingContext): ObjectiveVector {
  const facultyGap = idleGapScore(collect(slots, (s) => s.facultyId))
  const studentGap = idleGapScore(collect(slots, (s) => s.sectionId))

  // Workload balance: coefficient of variation of each faculty member's daily load,
  // normalized by its maximum possible value sqrt(days - 1)
  const loads = new Map<string, number[]>()
  for (const slot of slots) {
    if (!loads.has(slot.facultyId)) loads.set(slot.facultyId, new Array(DAYS_PER_WEEK).fill(0))
    loads.get(slot.facultyId)![slot.day] += slotPeriods(slot)
  }
  let cvSum = 0
  for (const daily of loads.values()) {
    const mean = daily.reduce((a, b) => a + b, 0) / DAYS_PER_WEEK
    if (mean === 0) continue
    const sd = Math.sqrt(daily.reduce((acc, v) => acc + (v - mean) ** 2, 0) / DAYS_PER_WEEK)
    cvSum += sd / mean
  }
  const workloadBalance = loads.size > 0 ? Math.max(0, 1 - cvSum / loads.size / Math.sqrt(DAYS_PER_WEEK - 1)) : 1

  let morning = 0
  let total = 0
  let labScore = 0
  let labs = 0
  for (const slot of slots) {
    const periods = slotPeriods(slot)
    total += periods
    for (let p = slot.startPeriod; p <= slot.endPeriod; p++) if (p <= 4) morning++
    const course = ctx.courseByKey.get(courseKey(slot.sectionId, slot.subjectId))
    if (course?.subjectType === "lab") {
      labScore += (DAYS_PER_WEEK - 1 - slot.day) / (DAYS_PER_WEEK - 1)
      labs++
    }
  }

  return {
    facultyGap,
    studentGap,
    workloadBalance,
    morningPreference: total > 0 ? morning / total : 0,
    labCompactness: labs > 0 ? labScore / labs : 1,
  }
}

export function weightedQuality(o: ObjectiveVector, weights: ObjectiveVector = BASELINE_WEIGHTS): number {
  return OBJECTIVE_KEYS.reduce((sum, k) => sum + o[k] * weights[k], 0)
}

export function objectiveArray(o: ObjectiveVector): number[] {
  return OBJECTIVE_KEYS.map((k) => o[k])
}

// ---------------------------------------------------------------------------
// Diversity (normalized Hamming distance over course placements)
// ---------------------------------------------------------------------------

function placementSignature(slots: TimetableSlot[]): Map<string, string> {
  const byCourse = new Map<string, string[]>()
  for (const s of slots) {
    const ck = courseKey(s.sectionId, s.subjectId)
    if (!byCourse.has(ck)) byCourse.set(ck, [])
    byCourse.get(ck)!.push(`${s.day}:${s.startPeriod}-${s.endPeriod}@${s.classroomId}`)
  }
  const sig = new Map<string, string>()
  for (const [ck, parts] of byCourse) sig.set(ck, parts.sort().join(","))
  return sig
}

/** HD(T1, T2) = |{c : slot(c, T1) != slot(c, T2)}| / |C| */
export function hammingDistance(a: TimetableSlot[], b: TimetableSlot[]): number {
  const sa = placementSignature(a)
  const sb = placementSignature(b)
  const keys = new Set([...sa.keys(), ...sb.keys()])
  if (keys.size === 0) return 0
  let differing = 0
  for (const k of keys) if (sa.get(k) !== sb.get(k)) differing++
  return differing / keys.size
}

/** Average pairwise Hamming distance of a population (PIE / GD in the paper) */
export function populationDiversity(population: TimetableSlot[][], maxPairs = 400): number {
  const n = population.length
  if (n < 2) return 0
  const signatures = population.map(placementSignature)
  let sum = 0
  let pairs = 0
  const step = Math.max(1, Math.floor((n * (n - 1)) / 2 / maxPairs))
  let counter = 0
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (counter++ % step !== 0) continue
      const keys = new Set([...signatures[i].keys(), ...signatures[j].keys()])
      let differing = 0
      for (const k of keys) if (signatures[i].get(k) !== signatures[j].get(k)) differing++
      sum += keys.size > 0 ? differing / keys.size : 0
      pairs++
    }
  }
  return pairs > 0 ? sum / pairs : 0
}

// ---------------------------------------------------------------------------
// Multi-objective indicators
// ---------------------------------------------------------------------------

/** a dominates b (maximization) */
export function dominates(a: number[], b: number[]): boolean {
  let strictlyBetter = false
  for (let i = 0; i < a.length; i++) {
    if (a[i] < b[i]) return false
    if (a[i] > b[i]) strictlyBetter = true
  }
  return strictlyBetter
}

export function nonDominated(points: number[][]): number[][] {
  return points.filter((p, i) => !points.some((q, j) => j !== i && dominates(q, p)))
}

/**
 * Hypervolume dominated by `points` w.r.t. the origin (all objectives maximized, in [0,1]).
 * Exact inclusion-exclusion for small fronts, seeded Monte Carlo otherwise, so baseline
 * and enhanced runs are always measured the same way.
 */
export function hypervolume(points: number[][]): number {
  const front = nonDominated(points)
  if (front.length === 0) return 0
  const dims = front[0].length

  if (front.length <= 14) {
    let volume = 0
    const n = front.length
    for (let mask = 1; mask < 1 << n; mask++) {
      const corner = new Array(dims).fill(Infinity)
      let size = 0
      for (let i = 0; i < n; i++) {
        if (mask & (1 << i)) {
          size++
          for (let d = 0; d < dims; d++) corner[d] = Math.min(corner[d], front[i][d])
        }
      }
      const box = corner.reduce((acc, v) => acc * Math.max(0, v), 1)
      volume += size % 2 === 1 ? box : -box
    }
    return volume
  }

  let state = 12345
  const rand = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
  const samples = 40000
  let inside = 0
  const sample = new Array(dims)
  for (let s = 0; s < samples; s++) {
    for (let d = 0; d < dims; d++) sample[d] = rand()
    if (front.some((p) => p.every((v, d) => v >= sample[d]))) inside++
  }
  return inside / samples
}

/** Extent of the front along each objective, normalized (0 = single point) */
export function frontSpread(points: number[][]): number {
  if (points.length < 2) return 0
  const dims = points[0].length
  let sq = 0
  for (let d = 0; d < dims; d++) {
    const values = points.map((p) => p[d])
    sq += (Math.max(...values) - Math.min(...values)) ** 2
  }
  return Math.sqrt(sq / dims)
}

// ---------------------------------------------------------------------------
// Convenience summary stored in timetable_jobs.metrics
// ---------------------------------------------------------------------------

export interface TimetableSummary {
  objectives: ObjectiveVector
  quality: number
  hard: HardConstraintReport
  slotCount: number
}

export function summarizeTimetable(slots: TimetableSlot[], ctx: SchedulingContext): TimetableSummary {
  const objectives = computeObjectives(slots, ctx)
  return {
    objectives,
    quality: weightedQuality(objectives),
    hard: evaluateHardConstraints(slots, ctx),
    slotCount: slots.length,
  }
}

/** First generation after which the best value improves by < epsilon for `window` generations */
export function convergenceGeneration(history: number[], epsilon = 0.001, window = 5): number {
  for (let g = 0; g + window < history.length; g++) {
    let stable = true
    for (let k = 1; k <= window; k++) {
      if (Math.abs(history[g + k] - history[g]) >= epsilon) {
        stable = false
        break
      }
    }
    if (stable) return g
  }
  return history.length - 1
}
