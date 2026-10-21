// ENHANCED optimizer: NSGA-II (Enhancement 4) + SCPX crossover (Enhancement 1) +
// constraint-safe block mutation, seeded by the Relaxed-ILP population (Enhancement 2).
//
// Chromosome encoding: the timetable is partitioned into coordinate blocks
// Block(d, s) = slots of section s on day d. A section's blocks over all days form its
// coordinate group G(s).
//
// SCPX exchanges whole coordinate groups between parents. A group carries every period
// of every course of that section, so course coverage (HC1), section non-overlap (HC3) and
// the 2-periods/day theory limit (HC10) hold by construction. Faculty/room clashes with the
// rest of the child (HC2/HC4/HC7, college occupancy) are checked on a FeasibilityGrid and a
// clashing group is reverted to parent 1 - so every offspring is feasible and no repair
// routine exists. (Exchanging a single Block(d, s) cannot guarantee HC1: parents usually
// place a course on different days, so a lone day-block swap duplicates or drops periods.)
//
// Mutation works on day blocks: swap Block(d, s) with Block(d', s), or relocate one slot,
// applying the move only if the grid accepts it.

import { FeasibilityGrid, HARD_RULES, SchedulingContext } from "./constraints.ts"
import {
  BASELINE_WEIGHTS,
  computeObjectives,
  dominates,
  objectiveArray,
  OBJECTIVE_KEYS,
  ObjectiveVector,
  populationDiversity,
  weightedQuality,
} from "./metrics.ts"
import { cloneSlots, courseKey, createRng, DayOfWeek, Period, slotPeriods, TimetableSlot } from "./scheduling-types.ts"

export interface EnhancedConfig {
  populationSize: number
  generations: number
  crossoverRate: number
  mutationRate: number
  maxMutationMoves: number
  /** alpha: fraction of coordinate groups exchanged by SCPX */
  exchangeFraction: number
  maxFrontSize: number
  rngSeed: number
}

export const ENHANCED_CONFIG: EnhancedConfig = {
  populationSize: 20,
  generations: 30,
  crossoverRate: 0.9,
  mutationRate: 0.6,
  maxMutationMoves: 3,
  exchangeFraction: 0.5,
  maxFrontSize: 12,
  rngSeed: 20260101,
}

export interface Individual {
  slots: TimetableSlot[]
  objectives: number[]
  /** Constraint violation for constrained domination: missing course periods */
  violation: number
  rank: number
  crowding: number
}

export interface EnhancedStats {
  scpxGroupsAttempted: number
  scpxGroupsAccepted: number
  scpxGroupsReverted: number
  offspringProduced: number
  offspringInfeasible: number
  repairInvocations: number
  mutationMoves: number
  mutationAttempts: number
  mutationAccepted: number
  totalTimeMs: number
  bestQualityHistory: number[]
  diversityHistory: number[]
}

export interface ParetoSolution {
  objectives: ObjectiveVector
  quality: number
  slots: TimetableSlot[]
}

export class NSGA2TimetableOptimizer {
  private rng: () => number
  private config: EnhancedConfig
  private required = new Map<string, number>()

  initialPopulation: TimetableSlot[][] = []
  /** Instrumentation hook: sees every offspring (its time is excluded from totalTimeMs) */
  offspringObserver?: (slots: TimetableSlot[]) => void
  private observerTimeMs = 0
  stats: EnhancedStats = {
    scpxGroupsAttempted: 0,
    scpxGroupsAccepted: 0,
    scpxGroupsReverted: 0,
    offspringProduced: 0,
    offspringInfeasible: 0,
    repairInvocations: 0,
    mutationMoves: 0,
    mutationAttempts: 0,
    mutationAccepted: 0,
    totalTimeMs: 0,
    bestQualityHistory: [],
    diversityHistory: [],
  }

  constructor(private seeds: TimetableSlot[][], private ctx: SchedulingContext, config: Partial<EnhancedConfig> = {}) {
    this.config = { ...ENHANCED_CONFIG, ...config }
    this.rng = createRng(this.config.rngSeed)
    for (const c of ctx.courses) this.required.set(courseKey(c.sectionId, c.subjectId), c.periodsPerWeek)
  }

  // ------------------------------------------------------------------
  // Evaluation
  // ------------------------------------------------------------------

  private evaluate(slots: TimetableSlot[]): Individual {
    const scheduled = new Map<string, number>()
    for (const s of slots) {
      const ck = courseKey(s.sectionId, s.subjectId)
      scheduled.set(ck, (scheduled.get(ck) || 0) + slotPeriods(s))
    }
    let violation = 0
    for (const [ck, need] of this.required) violation += Math.max(0, need - (scheduled.get(ck) || 0))

    return {
      slots,
      objectives: objectiveArray(computeObjectives(slots, this.ctx)),
      violation,
      rank: 0,
      crowding: 0,
    }
  }

  private qualityOf(ind: Individual): number {
    return OBJECTIVE_KEYS.reduce((sum, k, i) => sum + ind.objectives[i] * BASELINE_WEIGHTS[k], 0)
  }

  /** Constrained domination (Deb): fewer missing periods wins, then Pareto dominance */
  private constrainedDominates(a: Individual, b: Individual): boolean {
    if (a.violation !== b.violation) return a.violation < b.violation
    return dominates(a.objectives, b.objectives)
  }

  // ------------------------------------------------------------------
  // NSGA-II machinery
  // ------------------------------------------------------------------

  private fastNonDominatedSort(pop: Individual[]): Individual[][] {
    const fronts: Individual[][] = [[]]
    const dominatedBy = pop.map(() => [] as number[])
    const dominationCount = new Array(pop.length).fill(0)

    for (let p = 0; p < pop.length; p++) {
      for (let q = 0; q < pop.length; q++) {
        if (p === q) continue
        if (this.constrainedDominates(pop[p], pop[q])) dominatedBy[p].push(q)
        else if (this.constrainedDominates(pop[q], pop[p])) dominationCount[p]++
      }
      if (dominationCount[p] === 0) {
        pop[p].rank = 0
        fronts[0].push(pop[p])
      }
    }

    let i = 0
    const indexOf = new Map(pop.map((ind, idx) => [ind, idx]))
    while (fronts[i].length > 0) {
      const next: Individual[] = []
      for (const ind of fronts[i]) {
        for (const q of dominatedBy[indexOf.get(ind)!]) {
          dominationCount[q]--
          if (dominationCount[q] === 0) {
            pop[q].rank = i + 1
            next.push(pop[q])
          }
        }
      }
      i++
      fronts.push(next)
    }
    fronts.pop()
    return fronts
  }

  private assignCrowding(front: Individual[]): void {
    for (const ind of front) ind.crowding = 0
    if (front.length <= 2) {
      for (const ind of front) ind.crowding = Infinity
      return
    }
    const m = front[0].objectives.length
    for (let k = 0; k < m; k++) {
      front.sort((a, b) => a.objectives[k] - b.objectives[k])
      const min = front[0].objectives[k]
      const max = front[front.length - 1].objectives[k]
      front[0].crowding = Infinity
      front[front.length - 1].crowding = Infinity
      if (max - min === 0) continue
      for (let i = 1; i < front.length - 1; i++) {
        front[i].crowding += (front[i + 1].objectives[k] - front[i - 1].objectives[k]) / (max - min)
      }
    }
  }

  /** Binary tournament with the crowded-comparison operator */
  private select(pop: Individual[]): Individual {
    const a = pop[Math.floor(this.rng() * pop.length)]
    const b = pop[Math.floor(this.rng() * pop.length)]
    if (a.rank !== b.rank) return a.rank < b.rank ? a : b
    if (a.crowding !== b.crowding) return a.crowding > b.crowding ? a : b
    return this.rng() < 0.5 ? a : b
  }

  private environmentalSelection(combined: Individual[]): Individual[] {
    // Identical objective vectors add no information to the front; drop duplicates first
    const seen = new Set<string>()
    const unique: Individual[] = []
    const duplicates: Individual[] = []
    for (const ind of combined) {
      const key = `${ind.violation}|${ind.objectives.map((v) => v.toFixed(6)).join(",")}`
      if (seen.has(key)) duplicates.push(ind)
      else {
        seen.add(key)
        unique.push(ind)
      }
    }

    // With five objectives almost every individual is non-dominated, so crowding truncation
    // can discard the solution an administrator would pick by default (best weighted
    // quality). That point is Pareto-optimal, so it is always retained.
    const minViolation = Math.min(...unique.map((ind) => ind.violation))
    const anchor = unique
      .filter((ind) => ind.violation === minViolation)
      .reduce((best, ind) => (this.qualityOf(ind) > this.qualityOf(best) ? ind : best))

    const next: Individual[] = []
    for (const front of this.fastNonDominatedSort(unique)) {
      this.assignCrowding(front)
      if (next.length + front.length <= this.config.populationSize) {
        next.push(...front)
      } else {
        front.sort((a, b) => b.crowding - a.crowding)
        const room = this.config.populationSize - next.length
        const kept = front.slice(0, room)
        if (room > 0 && front.includes(anchor) && !kept.includes(anchor)) kept[kept.length - 1] = anchor
        next.push(...kept)
        break
      }
    }
    for (const d of duplicates) {
      if (next.length >= this.config.populationSize) break
      d.rank = Number.MAX_SAFE_INTEGER
      next.push(d)
    }
    return next
  }

  // ------------------------------------------------------------------
  // Operators
  // ------------------------------------------------------------------

  /** Structural Coordinate-Preserving Crossover */
  scpx(parent1: TimetableSlot[], parent2: TimetableSlot[]): TimetableSlot[] {
    let child = cloneSlots(parent1)
    const grid = FeasibilityGrid.fromSlots(this.ctx, child)

    const sections = [...new Set(parent1.map((s) => s.sectionId))]
    const count = Math.max(1, Math.floor(sections.length * this.config.exchangeFraction))
    const chosen = this.shuffle(sections).slice(0, count)

    for (const sectionId of chosen) {
      this.stats.scpxGroupsAttempted++
      const outgoing = child.filter((s) => s.sectionId === sectionId)
      const incoming = parent2.filter((s) => s.sectionId === sectionId)
      for (const s of outgoing) grid.remove(s)

      const placed: TimetableSlot[] = []
      let ok = true
      for (const s of incoming) {
        if (!grid.canPlace(s)) {
          ok = false
          break
        }
        grid.add(s)
        placed.push(s)
      }

      if (ok) {
        child = child.filter((s) => s.sectionId !== sectionId).concat(cloneSlots(incoming))
        this.stats.scpxGroupsAccepted++
      } else {
        for (const s of placed) grid.remove(s)
        for (const s of outgoing) grid.add(s)
        this.stats.scpxGroupsReverted++
      }
    }
    return child
  }

  /** Constraint-safe block mutation: applies `moves` accepted moves (or gives up per move) */
  mutate(slots: TimetableSlot[], moves: number): TimetableSlot[] {
    const child = cloneSlots(slots)
    if (child.length === 0) return child
    const grid = FeasibilityGrid.fromSlots(this.ctx, child)
    for (let m = 0; m < moves; m++) {
      this.stats.mutationMoves++
      for (let attempt = 0; attempt < 6; attempt++) {
        const r = this.rng()
        const moved =
          r < 0.5
            ? this.directedRelocate(child, grid, Math.floor(this.rng() * OBJECTIVE_KEYS.length))
            : r < 0.75
              ? this.swapDayBlocks(child, grid)
              : this.relocateSlot(child, grid)
        if (moved) {
          this.stats.mutationAccepted++
          break
        }
      }
    }
    return child
  }

  /**
   * Objective-directed relocation: pick one of the five objectives at random and move a slot
   * to the feasible position that looks best for that objective (randomly choosing the
   * objective keeps offspring spread along the Pareto front instead of collapsing to one
   * weighting). Candidate positions are ranked by a cheap local score; the first one the
   * FeasibilityGrid accepts is applied.
   */
  private directedRelocate(child: TimetableSlot[], grid: FeasibilityGrid, objective: number): boolean {
    const key = OBJECTIVE_KEYS[objective]
    const isLab = (s: TimetableSlot) => this.ctx.courseByKey.get(courseKey(s.sectionId, s.subjectId))?.subjectType === "lab"

    // Pick a slot that has room for improvement on this objective
    const pool = child
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => {
        if (key === "labCompactness") return isLab(s) && s.day > 0
        if (key === "morningPreference") return s.startPeriod > HARD_RULES.LUNCH_AFTER_PERIOD
        return true
      })
    if (pool.length === 0) return false
    const { s: slot, i: index } = pool[Math.floor(this.rng() * pool.length)]
    const length = slotPeriods(slot)

    // A 3-period lab rarely fits into a busy earlier day on its own: move the whole day block
    if (key === "labCompactness" && this.rng() < 0.6) {
      const earlier = Math.floor(this.rng() * slot.day) as DayOfWeek
      return this.swapSectionDays(child, grid, slot.sectionId, slot.day, earlier)
    }

    const occupied = (owner: (s: TimetableSlot) => boolean, day: number, period: number) =>
      child.some((o) => o !== slot && owner(o) && o.day === day && o.startPeriod <= period && period <= o.endPeriod)
    const facultyLoad = new Array(6).fill(0)
    for (const o of child) if (o !== slot && o.facultyId === slot.facultyId) facultyLoad[o.day] += slotPeriods(o)

    const candidates: { c: TimetableSlot; score: number }[] = []
    for (let day = 0; day < 6; day++) {
      for (let start = 1; start + length - 1 <= 8; start++) {
        const end = start + length - 1
        if (start <= HARD_RULES.LUNCH_AFTER_PERIOD && end > HARD_RULES.LUNCH_AFTER_PERIOD) continue
        if (day === slot.day && start === slot.startPeriod) continue
        let score: number
        switch (key) {
          case "labCompactness":
            score = day
            break
          case "morningPreference":
            score = start > HARD_RULES.LUNCH_AFTER_PERIOD ? 10 : start
            break
          case "workloadBalance":
            score = facultyLoad[day]
            break
          case "studentGap":
          case "facultyGap": {
            const owner = key === "studentGap" ? (o: TimetableSlot) => o.sectionId === slot.sectionId : (o: TimetableSlot) => o.facultyId === slot.facultyId
            const adjacent = occupied(owner, day, start - 1) || occupied(owner, day, end + 1)
            const sameDay = child.some((o) => o !== slot && owner(o) && o.day === day)
            score = adjacent ? 0 : sameDay ? 2 : 1
            break
          }
        }
        candidates.push({ c: { ...slot, day: day as DayOfWeek, startPeriod: start as Period, endPeriod: end as Period }, score: score + this.rng() * 0.5 })
      }
    }
    candidates.sort((a, b) => a.score - b.score)

    grid.remove(slot)
    for (const { c } of candidates.slice(0, 12)) {
      this.stats.mutationAttempts++
      const rooms = grid.roomsFor(c)
      if (rooms.length === 0) continue
      const placed = { ...c, classroomId: rooms[0] }
      grid.add(placed)
      child[index] = placed
      return true
    }
    grid.add(slot)
    return false
  }

  /** Block(d, s) <-> Block(d', s): the section's whole day moves, keeping course coverage */
  private swapDayBlocks(child: TimetableSlot[], grid: FeasibilityGrid): boolean {
    const pivot = child[Math.floor(this.rng() * child.length)]
    const d2 = Math.floor(this.rng() * 6) as DayOfWeek
    return this.swapSectionDays(child, grid, pivot.sectionId, pivot.day, d2)
  }

  private swapSectionDays(child: TimetableSlot[], grid: FeasibilityGrid, sectionId: string, d1: DayOfWeek, d2: DayOfWeek): boolean {
    if (d1 === d2) return false
    this.stats.mutationAttempts++

    const indices = child
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.sectionId === sectionId && (s.day === d1 || s.day === d2))
    for (const { s } of indices) grid.remove(s)

    const moved = indices.map(({ s }) => ({ ...s, day: (s.day === d1 ? d2 : d1) as DayOfWeek }))
    const placed: TimetableSlot[] = []
    let ok = true
    for (const s of moved) {
      if (!grid.canPlace(s)) {
        ok = false
        break
      }
      grid.add(s)
      placed.push(s)
    }

    if (!ok) {
      for (const s of placed) grid.remove(s)
      for (const { s } of indices) grid.add(s)
      return false
    }
    indices.forEach(({ i }, k) => (child[i] = moved[k]))
    return true
  }

  /**
   * Move one slot. Local moves from the paper first (shift +-1 period, or same periods on an
   * adjacent day), then any other position on the same day as a fallback. Any free room of
   * the right type/capacity may be used.
   */
  private relocateSlot(child: TimetableSlot[], grid: FeasibilityGrid): boolean {
    const index = Math.floor(this.rng() * child.length)
    const slot = child[index]
    const length = slotPeriods(slot)
    grid.remove(slot)

    const at = (day: number, start: number): TimetableSlot | null => {
      const end = start + length - 1
      if (day < 0 || day > 5 || start < 1 || end > 8) return null
      if (start <= HARD_RULES.LUNCH_AFTER_PERIOD && end > HARD_RULES.LUNCH_AFTER_PERIOD) return null
      if (day === slot.day && start === slot.startPeriod) return null
      return { ...slot, day: day as DayOfWeek, startPeriod: start as Period, endPeriod: end as Period }
    }

    const local = this.shuffle(
      [at(slot.day, slot.startPeriod - 1), at(slot.day, slot.startPeriod + 1), at(slot.day - 1, slot.startPeriod), at(slot.day + 1, slot.startPeriod)].filter(
        (c): c is TimetableSlot => c !== null,
      ),
    )
    const sameDay: TimetableSlot[] = []
    for (let start = 1; start + length - 1 <= 8; start++) {
      const c = at(slot.day, start)
      if (c && !local.some((l) => l.day === c.day && l.startPeriod === c.startPeriod)) sameDay.push(c)
    }
    const candidates = local.concat(this.shuffle(sameDay))

    for (const candidate of candidates) {
      this.stats.mutationAttempts++
      const rooms = grid.roomsFor(candidate)
      if (rooms.length === 0) continue
      const placed = { ...candidate, classroomId: rooms[0] }
      grid.add(placed)
      child[index] = placed
      return true
    }

    grid.add(slot)
    return false
  }

  private shuffle<T>(items: T[]): T[] {
    const out = items.slice()
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1))
      ;[out[i], out[j]] = [out[j], out[i]]
    }
    return out
  }

  // ------------------------------------------------------------------
  // Main loop (Algorithm 4)
  // ------------------------------------------------------------------

  optimize(): { front: ParetoSolution[]; chosenIndex: number; population: TimetableSlot[][]; frontPoints: number[][] } {
    const started = Date.now()
    const n = this.config.populationSize

    // P0: diversified ILP seeds, topped up with feasible perturbations of them
    const initial: TimetableSlot[][] = this.seeds.slice(0, n).map(cloneSlots)
    let k = 0
    while (initial.length < n && this.seeds.length > 0) {
      const source = this.seeds[k++ % this.seeds.length]
      const moves = Math.max(1, Math.round(source.length * 0.1))
      initial.push(this.mutate(source, moves))
    }
    this.initialPopulation = initial.map(cloneSlots)

    let population = initial.map((slots) => this.evaluate(slots))
    for (const front of this.fastNonDominatedSort(population)) this.assignCrowding(front)
    this.stats.diversityHistory.push(populationDiversity(population.map((p) => p.slots)))

    for (let g = 0; g < this.config.generations; g++) {
      const offspring: Individual[] = []
      while (offspring.length < n) {
        const p1 = this.select(population)
        const p2 = this.select(population)
        let childSlots = this.rng() < this.config.crossoverRate ? this.scpx(p1.slots, p2.slots) : cloneSlots(p1.slots)
        if (this.rng() < this.config.mutationRate) {
          childSlots = this.mutate(childSlots, 1 + Math.floor(this.rng() * this.config.maxMutationMoves))
        }
        this.stats.offspringProduced++
        if (this.offspringObserver) {
          const t = Date.now()
          this.offspringObserver(childSlots)
          this.observerTimeMs += Date.now() - t
        }
        offspring.push(this.evaluate(childSlots))
      }

      population = this.environmentalSelection(population.concat(offspring))
      const bestQuality = Math.max(...population.map((p) => this.qualityOf(p)))
      this.stats.bestQualityHistory.push(bestQuality)
      this.stats.diversityHistory.push(populationDiversity(population.map((p) => p.slots)))
    }

    // Final Pareto front: rank 0, least violation, unique objective vectors
    const minViolation = Math.min(...population.map((p) => p.violation))
    const ranked = this.fastNonDominatedSort(population.filter((p) => p.violation === minViolation))
    let front = ranked[0] || []
    this.assignCrowding(front)
    if (front.length > this.config.maxFrontSize) {
      const anchor = front.reduce((best, ind) => (this.qualityOf(ind) > this.qualityOf(best) ? ind : best))
      const kept = front.filter((ind) => ind !== anchor).sort((a, b) => b.crowding - a.crowding).slice(0, this.config.maxFrontSize - 1)
      front = [anchor, ...kept]
    }

    const solutions: ParetoSolution[] = front.map((ind) => {
      const objectives = Object.fromEntries(OBJECTIVE_KEYS.map((key, i) => [key, ind.objectives[i]])) as unknown as ObjectiveVector
      return { objectives, quality: weightedQuality(objectives), slots: ind.slots }
    })
    solutions.sort((a, b) => b.quality - a.quality)

    this.stats.totalTimeMs = Date.now() - started - this.observerTimeMs
    return {
      front: solutions,
      chosenIndex: 0,
      population: population.map((p) => p.slots),
      frontPoints: solutions.map((s) => objectiveArray(s.objectives)),
    }
  }
}
