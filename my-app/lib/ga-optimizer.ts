import type { TimetableSlot } from "./ilp-generator"
import { GA_CONFIG, FITNESS_WEIGHTS } from "../constants/timetable"

// Genetic Algorithm for timetable optimization
export class GATimetableOptimizer {
  private baseSchedule: TimetableSlot[]
  private population: TimetableSlot[][] = []
  private fitnessScores: Map<number, number> = new Map()

  constructor(baseSchedule: TimetableSlot[]) {
    this.baseSchedule = baseSchedule
  }

  optimize(): { optimizedSchedule: TimetableSlot[]; finalFitness: number } {
    console.log("[v0] Starting GA optimization")
    console.log("[v0] Configuration:", GA_CONFIG)

    // Initialize population
    this.initializePopulation()

    let bestFitness = Number.NEGATIVE_INFINITY
    let bestSchedule: TimetableSlot[] = []

    for (let generation = 0; generation < GA_CONFIG.GENERATIONS; generation++) {
      // Evaluate fitness for all chromosomes
      for (let i = 0; i < this.population.length; i++) {
        const fitness = this.calculateFitness(this.population[i])
        this.fitnessScores.set(i, fitness)

        if (fitness > bestFitness) {
          bestFitness = fitness
          bestSchedule = [...this.population[i]]
        }
      }

      if (generation % 10 === 0) {
        console.log(`[v0] Generation ${generation}: Best Fitness = ${bestFitness.toFixed(4)}`)
      }

      // Create next generation
      const newPopulation: TimetableSlot[][] = []

      // Elitism: Keep top performers
      const eliteCount = Math.floor(this.population.length * GA_CONFIG.ELITE_PERCENTAGE)
      const sortedIndices = Array.from(this.fitnessScores.entries())
        .sort((a, b) => b[1] - a[1])
        .map((entry) => entry[0])

      for (let i = 0; i < eliteCount; i++) {
        newPopulation.push([...this.population[sortedIndices[i]]])
      }

      // Generate offspring through crossover and mutation
      while (newPopulation.length < GA_CONFIG.POPULATION_SIZE) {
        const parent1 = this.tournamentSelection()
        const parent2 = this.tournamentSelection()

        let offspring = this.crossover(parent1, parent2)
        offspring = this.mutate(offspring)

        newPopulation.push(offspring)
      }

      this.population = newPopulation
    }

    console.log("[v0] GA optimization complete. Final fitness:", bestFitness.toFixed(4))

    return {
      optimizedSchedule: bestSchedule,
      finalFitness: bestFitness,
    }
  }

  private initializePopulation(): void {
    console.log("[v0] Initializing population with", GA_CONFIG.POPULATION_SIZE, "chromosomes")

    // First chromosome is the base schedule
    this.population.push([...this.baseSchedule])

    // Generate variations through random swaps
    for (let i = 1; i < GA_CONFIG.POPULATION_SIZE; i++) {
      const chromosome = [...this.baseSchedule]

      // Apply random mutations to create diversity
      const mutationCount = Math.floor(chromosome.length * 0.1)
      for (let j = 0; j < mutationCount; j++) {
        this.applyRandomSwap(chromosome)
      }

      this.population.push(chromosome)
    }
  }

  private calculateFitness(schedule: TimetableSlot[]): number {
    let totalFitness = 0

    // 1. Faculty gaps penalty (30%)
    const facultyGapPenalty = this.calculateFacultyGaps(schedule)
    totalFitness += (1 - facultyGapPenalty) * FITNESS_WEIGHTS.FACULTY_GAPS

    // 2. Student gaps penalty (25%)
    const studentGapPenalty = this.calculateStudentGaps(schedule)
    totalFitness += (1 - studentGapPenalty) * FITNESS_WEIGHTS.STUDENT_GAPS

    // 3. Workload balance (20%)
    const workloadBalance = this.calculateWorkloadBalance(schedule)
    totalFitness += workloadBalance * FITNESS_WEIGHTS.WORKLOAD_BALANCE

    // 4. Morning preference (15%)
    const morningPreference = this.calculateMorningPreference(schedule)
    totalFitness += morningPreference * FITNESS_WEIGHTS.MORNING_PREFERENCE

    // 5. Lab compactness (10%)
    const labCompactness = this.calculateLabCompactness(schedule)
    totalFitness += labCompactness * FITNESS_WEIGHTS.LAB_COMPACTNESS

    return totalFitness
  }

  private calculateFacultyGaps(schedule: TimetableSlot[]): number {
    const facultySchedules = new Map<string, Map<number, number[]>>()

    // Group by faculty and day
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

    // Calculate gaps for each faculty on each day
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

    return totalDays > 0 ? totalGaps / totalDays / 8 : 0 // Normalize by max possible gaps
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
    return Math.max(0, 1 - avgVariance / 16) // Normalize
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
    // Labs should be scheduled in early days of the week
    const labSlots = schedule.filter((s) => s.endPeriod - s.startPeriod + 1 === 4) // Labs are 4 periods

    if (labSlots.length === 0) return 1

    let compactnessScore = 0
    for (const slot of labSlots) {
      // Prefer earlier days (Monday = 0, Saturday = 5)
      compactnessScore += (5 - slot.day) / 5
    }

    return compactnessScore / labSlots.length
  }

  private tournamentSelection(): TimetableSlot[] {
    const tournament: number[] = []

    for (let i = 0; i < GA_CONFIG.TOURNAMENT_SIZE; i++) {
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
    if (Math.random() > GA_CONFIG.CROSSOVER_RATE) {
      return [...parent1]
    }

    // Single-point crossover
    const offspring = [...parent1]
    const crossoverPoint = Math.floor(Math.random() * parent1.length)

    for (let i = crossoverPoint; i < parent1.length; i++) {
      // Find corresponding slot in parent2 (same section and subject)
      const matchingSlot = parent2.find(
        (s) => s.sectionId === parent1[i].sectionId && s.subjectId === parent1[i].subjectId,
      )

      if (matchingSlot && this.isValidSwap(offspring, i, matchingSlot)) {
        offspring[i] = { ...matchingSlot }
      }
    }

    return offspring
  }

  private mutate(chromosome: TimetableSlot[]): TimetableSlot[] {
    const mutated = [...chromosome]

    if (Math.random() < GA_CONFIG.MUTATION_RATE) {
      this.applyRandomSwap(mutated)
    }

    return mutated
  }

  private applyRandomSwap(chromosome: TimetableSlot[]): void {
    const attempts = 10
    for (let attempt = 0; attempt < attempts; attempt++) {
      const index = Math.floor(Math.random() * chromosome.length)
      const slot = chromosome[index]

      // Try to move to a different time slot
      const newDay = Math.floor(Math.random() * 6) as 0 | 1 | 2 | 3 | 4 | 5
      const maxPeriod = newDay === 5 ? 4 : 8 // Saturday half-day
      const periodRange = slot.endPeriod - slot.startPeriod
      const newStartPeriod = Math.floor(Math.random() * (maxPeriod - periodRange + 1)) + 1

      const newSlot: TimetableSlot = {
        ...slot,
        day: newDay,
        startPeriod: newStartPeriod as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8,
        endPeriod: (newStartPeriod + periodRange) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8,
      }

      if (this.isValidSwap(chromosome, index, newSlot)) {
        chromosome[index] = newSlot
        break
      }
    }
  }

  private isValidSwap(chromosome: TimetableSlot[], index: number, newSlot: TimetableSlot): boolean {
    // Check for conflicts with other slots in the chromosome
    for (let i = 0; i < chromosome.length; i++) {
      if (i === index) continue

      const otherSlot = chromosome[i]

      // Same day check
      if (otherSlot.day !== newSlot.day) continue

      // Check period overlap
      const overlap =
        (newSlot.startPeriod >= otherSlot.startPeriod && newSlot.startPeriod <= otherSlot.endPeriod) ||
        (newSlot.endPeriod >= otherSlot.startPeriod && newSlot.endPeriod <= otherSlot.endPeriod) ||
        (otherSlot.startPeriod >= newSlot.startPeriod && otherSlot.startPeriod <= newSlot.endPeriod)

      if (overlap) {
        // Check for conflicts
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
  }
}
