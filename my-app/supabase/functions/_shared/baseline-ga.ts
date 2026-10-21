// BASELINE (pre-enhancement) Genetic Algorithm optimizer.
//
// This is the original weighted-sum GA from optimize-timetable/index.ts, kept intact so the
// "before enhancement" run executes exactly the logic the research paper criticises:
//   - single-seed population (base timetable + random 10% swaps)
//   - slot-level crossover/mutation with validity rejection (isValidSwap)
//   - scalar weighted-sum fitness F = 0.3 FG + 0.25 SG + 0.2 WB + 0.15 MP + 0.1 LC
//
// Only three things were added:
//   1. counters/timers for the evaluation metrics (no effect on search behaviour)
//   2. a configurable budget so baseline and enhanced runs can be given the same budget
//   3. isValidSwap also rejects periods committed by other departments - required by the
//      college-wide architecture, otherwise a baseline run could double-book shared faculty

import { DayOfWeek, Occupancy, Period, slotKey, TimetableSlot } from "./scheduling-types.ts"

export interface GAConfig {
  POPULATION_SIZE: number
  GENERATIONS: number
  MUTATION_RATE: number
  CROSSOVER_RATE: number
  ELITE_PERCENTAGE: number
  TOURNAMENT_SIZE: number
}

// Original GA Configuration
export const GA_CONFIG: GAConfig = {
  POPULATION_SIZE: 10,
  GENERATIONS: 10,
  MUTATION_RATE: 0.1,
  CROSSOVER_RATE: 0.8,
  ELITE_PERCENTAGE: 0.1,
  TOURNAMENT_SIZE: 3,
}

// Fitness weights
const FITNESS_WEIGHTS = {
  FACULTY_GAPS: 0.3,
  STUDENT_GAPS: 0.25,
  WORKLOAD_BALANCE: 0.2,
  MORNING_PREFERENCE: 0.15,
  LAB_COMPACTNESS: 0.1,
}

export interface BaselineGAStats {
  crossoverGenesAttempted: number
  crossoverGenesRejected: number
  offspringProduced: number
  offspringWithRejections: number
  mutationMoves: number
  mutationAttempts: number
  mutationAccepted: number
  validityChecks: number
  validityCheckTimeMs: number
  totalTimeMs: number
  bestFitnessHistory: number[]
}

// Genetic Algorithm for timetable optimization
export class GATimetableOptimizer {
  private baseSchedule: TimetableSlot[]
  private population: TimetableSlot[][] = []
  private fitnessScores: Map<number, number> = new Map()
  private config: GAConfig
  private occupancy: Occupancy | null

  initialPopulation: TimetableSlot[][] = []
  /** Instrumentation hook: sees every offspring (its time is excluded from totalTimeMs) */
  offspringObserver?: (slots: TimetableSlot[]) => void
  private observerTimeMs = 0
  stats: BaselineGAStats = {
    crossoverGenesAttempted: 0,
    crossoverGenesRejected: 0,
    offspringProduced: 0,
    offspringWithRejections: 0,
    mutationMoves: 0,
    mutationAttempts: 0,
    mutationAccepted: 0,
    validityChecks: 0,
    validityCheckTimeMs: 0,
    totalTimeMs: 0,
    bestFitnessHistory: [],
  }

  constructor(baseSchedule: TimetableSlot[], options: { config?: Partial<GAConfig>; occupancy?: Occupancy } = {}) {
    this.baseSchedule = baseSchedule
    this.config = { ...GA_CONFIG, ...(options.config || {}) }
    this.occupancy = options.occupancy || null
  }

  optimize(): { optimizedSchedule: TimetableSlot[]; finalFitness: number; finalPopulation: TimetableSlot[][] } {
    const started = Date.now()
    console.log("[Edge Function] Starting GA optimization")
    console.log("[Edge Function] Configuration:", this.config)

    this.initializePopulation()
    this.initialPopulation = this.population.map((c) => c.map((s) => ({ ...s })))

    let bestFitness = Number.NEGATIVE_INFINITY
    let bestSchedule: TimetableSlot[] = []

    for (let generation = 0; generation < this.config.GENERATIONS; generation++) {
      for (let i = 0; i < this.population.length; i++) {
        const fitness = this.calculateFitness(this.population[i])
        this.fitnessScores.set(i, fitness)

        if (fitness > bestFitness) {
          bestFitness = fitness
          bestSchedule = [...this.population[i]]
        }
      }
      this.stats.bestFitnessHistory.push(bestFitness)

      if (generation % 10 === 0) {
        console.log(`[Edge Function] Generation ${generation}: Best Fitness = ${bestFitness.toFixed(4)}`)
      }

      const newPopulation: TimetableSlot[][] = []

      const eliteCount = Math.floor(this.population.length * this.config.ELITE_PERCENTAGE)
      const sortedIndices = Array.from(this.fitnessScores.entries())
        .sort((a, b) => b[1] - a[1])
        .map((entry) => entry[0])

      for (let i = 0; i < eliteCount; i++) {
        newPopulation.push([...this.population[sortedIndices[i]]])
      }

      while (newPopulation.length < this.config.POPULATION_SIZE) {
        const parent1 = this.tournamentSelection()
        const parent2 = this.tournamentSelection()

        let offspring = this.crossover(parent1, parent2)
        offspring = this.mutate(offspring)

        if (this.offspringObserver) {
          const t = Date.now()
          this.offspringObserver(offspring)
          this.observerTimeMs += Date.now() - t
        }
        newPopulation.push(offspring)
      }

      this.population = newPopulation
    }

    console.log("[Edge Function] GA optimization complete. Final fitness:", bestFitness.toFixed(4))
    this.stats.totalTimeMs = Date.now() - started - this.observerTimeMs

    return {
      optimizedSchedule: bestSchedule,
      finalFitness: bestFitness,
      finalPopulation: this.population,
    }
  }

  private initializePopulation(): void {
    console.log("[Edge Function] Initializing population with", this.config.POPULATION_SIZE, "chromosomes")

    this.population.push([...this.baseSchedule])

    for (let i = 1; i < this.config.POPULATION_SIZE; i++) {
      const chromosome = [...this.baseSchedule]

      const mutationCount = Math.floor(chromosome.length * 0.1)
      for (let j = 0; j < mutationCount; j++) {
        this.applyRandomSwap(chromosome)
      }

      this.population.push(chromosome)
    }
  }

  private calculateFitness(schedule: TimetableSlot[]): number {
    let totalFitness = 0

    const facultyGapPenalty = this.calculateFacultyGaps(schedule)
    totalFitness += (1 - facultyGapPenalty) * FITNESS_WEIGHTS.FACULTY_GAPS

    const studentGapPenalty = this.calculateStudentGaps(schedule)
    totalFitness += (1 - studentGapPenalty) * FITNESS_WEIGHTS.STUDENT_GAPS

    const workloadBalance = this.calculateWorkloadBalance(schedule)
    totalFitness += workloadBalance * FITNESS_WEIGHTS.WORKLOAD_BALANCE

    const morningPreference = this.calculateMorningPreference(schedule)
    totalFitness += morningPreference * FITNESS_WEIGHTS.MORNING_PREFERENCE

    const labCompactness = this.calculateLabCompactness(schedule)
    totalFitness += labCompactness * FITNESS_WEIGHTS.LAB_COMPACTNESS

    return totalFitness
  }

  private calculateFacultyGaps(schedule: TimetableSlot[]): number {
    const facultySchedules = new Map<string, Map<number, number[]>>()

    for (const slot of schedule) {
      if (!facultySchedules.has(slot.facultyId)) {
        facultySchedules.set(slot.facultyId, new Map())
      }
      const daySchedule = facultySchedules.get(slot.facultyId)!
      if (!daySchedule.has(slot.day)) {
        daySchedule.set(slot.day, [])
      }

      for (let p = slot.startPeriod; p <= slot.endPeriod; p++) {
        daySchedule.get(slot.day)!.push(p)
      }
    }

    let totalGaps = 0
    let totalDays = 0

    for (const daySchedule of facultySchedules.values()) {
      for (const periods of daySchedule.values()) {
        if (periods.length > 0) {
          periods.sort((a, b) => a - b)
          const minPeriod = periods[0]
          const maxPeriod = periods[periods.length - 1]
          const expectedPeriods = maxPeriod - minPeriod + 1
          const gaps = expectedPeriods - periods.length
          totalGaps += gaps
          totalDays++
        }
      }
    }

    return totalDays > 0 ? totalGaps / totalDays / 8 : 0
  }

  private calculateStudentGaps(schedule: TimetableSlot[]): number {
    const sectionSchedules = new Map<string, Map<number, number[]>>()

    for (const slot of schedule) {
      if (!sectionSchedules.has(slot.sectionId)) {
        sectionSchedules.set(slot.sectionId, new Map())
      }
      const daySchedule = sectionSchedules.get(slot.sectionId)!
      if (!daySchedule.has(slot.day)) {
        daySchedule.set(slot.day, [])
      }

      for (let p = slot.startPeriod; p <= slot.endPeriod; p++) {
        daySchedule.get(slot.day)!.push(p)
      }
    }

    let totalGaps = 0
    let totalDays = 0

    for (const daySchedule of sectionSchedules.values()) {
      for (const periods of daySchedule.values()) {
        if (periods.length > 0) {
          periods.sort((a, b) => a - b)
          const minPeriod = periods[0]
          const maxPeriod = periods[periods.length - 1]
          const expectedPeriods = maxPeriod - minPeriod + 1
          const gaps = expectedPeriods - periods.length
          totalGaps += gaps
          totalDays++
        }
      }
    }

    return totalDays > 0 ? totalGaps / totalDays / 8 : 0
  }

  private calculateWorkloadBalance(schedule: TimetableSlot[]): number {
    const facultyDailyLoad = new Map<string, number[]>()

    for (const slot of schedule) {
      if (!facultyDailyLoad.has(slot.facultyId)) {
        facultyDailyLoad.set(slot.facultyId, [0, 0, 0, 0, 0, 0])
      }
      const periods = slot.endPeriod - slot.startPeriod + 1
      facultyDailyLoad.get(slot.facultyId)![slot.day] += periods
    }

    let totalVariance = 0
    let facultyCount = 0

    for (const dailyLoads of facultyDailyLoad.values()) {
      const mean = dailyLoads.reduce((a, b) => a + b, 0) / dailyLoads.length
      const variance = dailyLoads.reduce((sum, load) => sum + Math.pow(load - mean, 2), 0) / dailyLoads.length
      totalVariance += variance
      facultyCount++
    }

    const avgVariance = facultyCount > 0 ? totalVariance / facultyCount : 0
    return Math.max(0, 1 - avgVariance / 16)
  }

  private calculateMorningPreference(schedule: TimetableSlot[]): number {
    let morningSlots = 0
    let totalSlots = 0

    for (const slot of schedule) {
      const periods = slot.endPeriod - slot.startPeriod + 1
      if (slot.startPeriod <= 4) {
        morningSlots += periods
      }
      totalSlots += periods
    }

    return totalSlots > 0 ? morningSlots / totalSlots : 0
  }

  private calculateLabCompactness(schedule: TimetableSlot[]): number {
    const labSlots = schedule.filter((s) => s.endPeriod - s.startPeriod + 1 === 4)

    if (labSlots.length === 0) return 1

    let compactnessScore = 0
    for (const slot of labSlots) {
      compactnessScore += (5 - slot.day) / 5
    }

    return compactnessScore / labSlots.length
  }

  private tournamentSelection(): TimetableSlot[] {
    const tournament: number[] = []

    for (let i = 0; i < this.config.TOURNAMENT_SIZE; i++) {
      const randomIndex = Math.floor(Math.random() * this.population.length)
      tournament.push(randomIndex)
    }

    let bestIndex = tournament[0]
    let bestFitness = this.fitnessScores.get(bestIndex) || Number.NEGATIVE_INFINITY

    for (const index of tournament) {
      const fitness = this.fitnessScores.get(index) || Number.NEGATIVE_INFINITY
      if (fitness > bestFitness) {
        bestFitness = fitness
        bestIndex = index
      }
    }

    return [...this.population[bestIndex]]
  }

  private crossover(parent1: TimetableSlot[], parent2: TimetableSlot[]): TimetableSlot[] {
    if (Math.random() > this.config.CROSSOVER_RATE) {
      return [...parent1]
    }

    const offspring = [...parent1]
    const crossoverPoint = Math.floor(Math.random() * parent1.length)
    let rejected = 0

    for (let i = crossoverPoint; i < parent1.length; i++) {
      const matchingSlot = parent2.find(
        (s) => s.sectionId === parent1[i].sectionId && s.subjectId === parent1[i].subjectId,
      )

      if (matchingSlot) this.stats.crossoverGenesAttempted++
      if (matchingSlot && this.isValidSwap(offspring, i, matchingSlot)) {
        offspring[i] = { ...matchingSlot }
      } else if (matchingSlot) {
        this.stats.crossoverGenesRejected++
        rejected++
      }
    }

    this.stats.offspringProduced++
    if (rejected > 0) this.stats.offspringWithRejections++
    return offspring
  }

  private mutate(chromosome: TimetableSlot[]): TimetableSlot[] {
    const mutated = [...chromosome]

    if (Math.random() < this.config.MUTATION_RATE) {
      this.applyRandomSwap(mutated)
    }

    return mutated
  }

  private applyRandomSwap(chromosome: TimetableSlot[]): void {
    const attempts = 10
    this.stats.mutationMoves++
    for (let attempt = 0; attempt < attempts; attempt++) {
      this.stats.mutationAttempts++
      const index = Math.floor(Math.random() * chromosome.length)
      const slot = chromosome[index]

      const newDay = Math.floor(Math.random() * 6) as DayOfWeek
      const maxPeriod = newDay === 5 ? 4 : 8
      const periodRange = slot.endPeriod - slot.startPeriod

      // Ensure newStartPeriod + periodRange doesn't exceed maxPeriod
      const maxValidStart = maxPeriod - periodRange
      if (maxValidStart < 1) continue // Skip if slot doesn't fit in this day

      const newStartPeriod = Math.floor(Math.random() * maxValidStart) + 1
      const newEndPeriod = newStartPeriod + periodRange

      // Validate periods are within valid range (1-8)
      if (newStartPeriod < 1 || newStartPeriod > 8 || newEndPeriod < 1 || newEndPeriod > 8) {
        continue
      }

      // Don't split across lunch break (periods 4 and 5)
      if (newStartPeriod <= 4 && newEndPeriod > 4) {
        continue
      }

      const newSlot: TimetableSlot = {
        ...slot,
        day: newDay,
        startPeriod: newStartPeriod as Period,
        endPeriod: newEndPeriod as Period,
      }

      if (this.isValidSwap(chromosome, index, newSlot)) {
        chromosome[index] = newSlot
        this.stats.mutationAccepted++
        break
      }
    }
  }

  private isValidSwap(chromosome: TimetableSlot[], index: number, newSlot: TimetableSlot): boolean {
    const started = performance.now()
    this.stats.validityChecks++
    try {
      // College-wide architecture: never move into time committed by another department
      if (this.occupancy) {
        for (let p = newSlot.startPeriod; p <= newSlot.endPeriod; p++) {
          const key = slotKey(newSlot.day, p)
          if (this.occupancy.facultyBusy.get(newSlot.facultyId)?.has(key)) return false
          if (this.occupancy.roomBusy.get(newSlot.classroomId)?.has(key)) return false
        }
      }

      for (let i = 0; i < chromosome.length; i++) {
        if (i === index) continue

        const otherSlot = chromosome[i]

        if (otherSlot.day !== newSlot.day) continue

        const overlap =
          (newSlot.startPeriod >= otherSlot.startPeriod && newSlot.startPeriod <= otherSlot.endPeriod) ||
          (newSlot.endPeriod >= otherSlot.startPeriod && newSlot.endPeriod <= otherSlot.endPeriod) ||
          (otherSlot.startPeriod >= newSlot.startPeriod && otherSlot.startPeriod <= newSlot.endPeriod)

        if (overlap) {
          if (
            otherSlot.facultyId === newSlot.facultyId ||
            otherSlot.classroomId === newSlot.classroomId ||
            otherSlot.sectionId === newSlot.sectionId
          ) {
            return false
          }
        }
      }

      return true
    } finally {
      this.stats.validityCheckTimeMs += performance.now() - started
    }
  }
}
