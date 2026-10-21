// ENHANCEMENT 3 - Incremental ILP rescheduling (Algorithm 3 of the research paper).
//
// Given a published timetable and a disruption (faculty on leave / room offline on some
// days), every slot not touched by the disruption is LOCKED in place; only the affected
// course periods are re-placed around the locked slots and the college occupancy, then a
// local search refines just that neighbourhood. Nothing else in the timetable moves.

import { ILPTimetableGenerator, silently } from "./base-generator.ts"
import { buildSchedulingContext, FeasibilityGrid, HARD_RULES } from "./constraints.ts"
import { computeObjectives, hammingDistance, summarizeTimetable, TimetableSummary, weightedQuality } from "./metrics.ts"
import {
  ClassroomOption,
  CourseAssignment,
  courseKey,
  createRng,
  DayOfWeek,
  emptyOccupancy,
  FacultyAvailabilitySlot,
  mergeOccupancy,
  Occupancy,
  Period,
  slotKey,
  slotPeriods,
  TimetableSlot,
} from "./scheduling-types.ts"

export type Disruption =
  | { type: "faculty"; facultyId: string; days: number[] }
  | { type: "room"; roomId: string; days: number[] }

export interface RescheduleMetrics {
  latencyMs: number
  totalSlots: number
  affectedSlots: number
  /** SAF: share of the timetable that had to change */
  scheduleAffectedFraction: number
  lockRatio: number
  lockRatioTarget: number
  lockRatioSatisfied: boolean
  periodsToReplace: number
  periodsReplaced: number
  /** Hamming distance between old and new timetable (course level) */
  changedCourseFraction: number
  qualityBefore: number
  qualityAfter: number
  /** QL: quality change relative to the original timetable, % */
  qualityChangePercent: number
  localSearchMovesAccepted: number
}

export interface RescheduleResult {
  slots: TimetableSlot[]
  summary: TimetableSummary
  metrics: RescheduleMetrics
}

export const LOCK_RATIO_TARGET = 0.9

function disruptionOccupancy(d: Disruption): Occupancy {
  const occ = emptyOccupancy()
  const days = d.days.length > 0 ? d.days : [0, 1, 2, 3, 4, 5]
  const keys = new Set<string>()
  for (const day of days) for (let p = 1; p <= 8; p++) keys.add(slotKey(day, p))
  if (d.type === "faculty") occ.facultyBusy.set(d.facultyId, keys)
  else occ.roomBusy.set(d.roomId, keys)
  return occ
}

function isAffected(slot: TimetableSlot, d: Disruption): boolean {
  const days = d.days.length > 0 ? d.days : [0, 1, 2, 3, 4, 5]
  if (!days.includes(slot.day)) return false
  return d.type === "faculty" ? slot.facultyId === d.facultyId : slot.classroomId === d.roomId
}

export async function runIncrementalReschedule(params: {
  currentSlots: TimetableSlot[]
  courses: CourseAssignment[]
  rooms: ClassroomOption[]
  availability: FacultyAvailabilitySlot[]
  occupancy: Occupancy
  disruption: Disruption
  rngSeed?: number
  localSearchIterations?: number
}): Promise<RescheduleResult> {
  const started = Date.now()
  const rng = createRng(params.rngSeed ?? 99)
  const occupancy = mergeOccupancy(params.occupancy, disruptionOccupancy(params.disruption))
  const ctx = buildSchedulingContext(params.courses, params.rooms, params.availability, occupancy)

  const affected = params.currentSlots.filter((s) => isAffected(s, params.disruption))
  const locked = params.currentSlots.filter((s) => !isAffected(s, params.disruption))

  // Remainder courses: only the periods that lost their slot need a new one
  const periodsByCourse = new Map<string, number>()
  for (const s of affected) {
    const ck = courseKey(s.sectionId, s.subjectId)
    periodsByCourse.set(ck, (periodsByCourse.get(ck) || 0) + slotPeriods(s))
  }
  const remainder: CourseAssignment[] = []
  for (const [ck, periods] of periodsByCourse) {
    const course = ctx.courseByKey.get(ck)
    if (course) remainder.push({ ...course, periodsPerWeek: course.subjectType === "lab" ? course.periodsPerWeek : periods })
  }

  // Incremental ILP step: locked slots are fixed, the generator only fills the gaps
  const generator = new ILPTimetableGenerator(params.courses, params.rooms, params.availability, { occupancy })
  const { kept, placed, lockedRejected } = await silently(() => generator.rescheduleAround(locked, remainder, params.rngSeed ?? 99))
  let slots = kept.concat(placed)
  const movableFrom = kept.length

  // Local GA-style refinement restricted to the re-placed neighbourhood
  let accepted = 0
  if (placed.length > 0) {
    const grid = FeasibilityGrid.fromSlots(ctx, slots)
    const movable = slots.map((_, i) => i).slice(movableFrom)
    let quality = weightedQuality(computeObjectives(slots, ctx))
    const iterations = params.localSearchIterations ?? 150

    for (let it = 0; it < iterations; it++) {
      const index = movable[Math.floor(rng() * movable.length)]
      const slot = slots[index]
      const length = slotPeriods(slot)
      const day = (rng() < 0.6 ? slot.day : Math.floor(rng() * 6)) as DayOfWeek
      const start = 1 + Math.floor(rng() * (8 - length + 1))
      const end = start + length - 1
      if (start <= HARD_RULES.LUNCH_AFTER_PERIOD && end > HARD_RULES.LUNCH_AFTER_PERIOD) continue

      grid.remove(slot)
      const candidate = { ...slot, day, startPeriod: start as Period, endPeriod: end as Period }
      const rooms = grid.roomsFor(candidate)
      if (rooms.length === 0) {
        grid.add(slot)
        continue
      }
      const moved = { ...candidate, classroomId: rooms[0] }
      const trial = slots.slice()
      trial[index] = moved
      const trialQuality = weightedQuality(computeObjectives(trial, ctx))
      if (trialQuality >= quality) {
        grid.add(moved)
        slots = trial
        quality = trialQuality
        accepted++
      } else {
        grid.add(slot)
      }
    }
  }

  const summary = summarizeTimetable(slots, ctx)
  const originalCtx = buildSchedulingContext(params.courses, params.rooms, params.availability, params.occupancy)
  const qualityBefore = weightedQuality(computeObjectives(params.currentSlots, originalCtx))
  const lockRatio = params.currentSlots.length > 0 ? kept.length / params.currentSlots.length : 1
  const periodsToReplace =
    remainder.reduce((sum, c) => sum + c.periodsPerWeek, 0) +
    locked.filter((s) => !kept.some((k) => k.sectionId === s.sectionId && k.subjectId === s.subjectId && k.day === s.day && k.startPeriod === s.startPeriod)).reduce((sum, s) => sum + slotPeriods(s), 0)
  const periodsReplaced = placed.reduce((sum, s) => sum + slotPeriods(s), 0)

  return {
    slots,
    summary,
    metrics: {
      latencyMs: Date.now() - started,
      totalSlots: params.currentSlots.length,
      affectedSlots: affected.length + lockedRejected,
      scheduleAffectedFraction: params.currentSlots.length > 0 ? (affected.length + lockedRejected) / params.currentSlots.length : 0,
      lockRatio,
      lockRatioTarget: LOCK_RATIO_TARGET,
      lockRatioSatisfied: lockRatio >= LOCK_RATIO_TARGET,
      periodsToReplace,
      periodsReplaced,
      changedCourseFraction: hammingDistance(params.currentSlots, slots),
      qualityBefore,
      qualityAfter: summary.quality,
      qualityChangePercent: qualityBefore > 0 ? ((summary.quality - qualityBefore) / qualityBefore) * 100 : 0,
      localSearchMovesAccepted: accepted,
    },
  }
}
