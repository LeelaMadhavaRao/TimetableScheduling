// Supabase Edge Function for Timetable Optimization using Genetic Algorithm
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

// Types
type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5
type Period = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

interface TimetableSlot {
  sectionId: string
  subjectId: string
  facultyId: string
  classroomId: string
  day: DayOfWeek
  startPeriod: Period
  endPeriod: Period
}

// GA Configuration
const GA_CONFIG = {
  POPULATION_SIZE: 50,
  GENERATIONS: 100,
  MUTATION_RATE: 0.1,
  CROSSOVER_RATE: 0.8,
  ELITE_PERCENTAGE: 0.1,
  TOURNAMENT_SIZE: 5,
}

// Fitness weights
const FITNESS_WEIGHTS = {
  FACULTY_GAPS: 0.3,
  STUDENT_GAPS: 0.25,
  WORKLOAD_BALANCE: 0.2,
  MORNING_PREFERENCE: 0.15,
  LAB_COMPACTNESS: 0.1,
}

// Genetic Algorithm for timetable optimization
class GATimetableOptimizer {
  private baseSchedule: TimetableSlot[]
  private population: TimetableSlot[][] = []
  private fitnessScores: Map<number, number> = new Map()

  constructor(baseSchedule: TimetableSlot[]) {
    this.baseSchedule = baseSchedule
  }

  optimize(): { optimizedSchedule: TimetableSlot[]; finalFitness: number } {
    console.log("[Edge Function] Starting GA optimization")
    console.log("[Edge Function] Configuration:", GA_CONFIG)

    this.initializePopulation()

    let bestFitness = Number.NEGATIVE_INFINITY
    let bestSchedule: TimetableSlot[] = []

    for (let generation = 0; generation < GA_CONFIG.GENERATIONS; generation++) {
      for (let i = 0; i < this.population.length; i++) {
        const fitness = this.calculateFitness(this.population[i])
        this.fitnessScores.set(i, fitness)

        if (fitness > bestFitness) {
          bestFitness = fitness
          bestSchedule = [...this.population[i]]
        }
      }

      if (generation % 10 === 0) {
        console.log(`[Edge Function] Generation ${generation}: Best Fitness = ${bestFitness.toFixed(4)}`)
      }

      const newPopulation: TimetableSlot[][] = []

      const eliteCount = Math.floor(this.population.length * GA_CONFIG.ELITE_PERCENTAGE)
      const sortedIndices = Array.from(this.fitnessScores.entries())
        .sort((a, b) => b[1] - a[1])
        .map((entry) => entry[0])

      for (let i = 0; i < eliteCount; i++) {
        newPopulation.push([...this.population[sortedIndices[i]]])
      }

      while (newPopulation.length < GA_CONFIG.POPULATION_SIZE) {
        const parent1 = this.tournamentSelection()
        const parent2 = this.tournamentSelection()

        let offspring = this.crossover(parent1, parent2)
        offspring = this.mutate(offspring)

        newPopulation.push(offspring)
      }

      this.population = newPopulation
    }

    console.log("[Edge Function] GA optimization complete. Final fitness:", bestFitness.toFixed(4))

    return {
      optimizedSchedule: bestSchedule,
      finalFitness: bestFitness,
    }
  }

  private initializePopulation(): void {
    console.log("[Edge Function] Initializing population with", GA_CONFIG.POPULATION_SIZE, "chromosomes")

    this.population.push([...this.baseSchedule])

    for (let i = 1; i < GA_CONFIG.POPULATION_SIZE; i++) {
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

    const offspring = [...parent1]
    const crossoverPoint = Math.floor(Math.random() * parent1.length)

    for (let i = crossoverPoint; i < parent1.length; i++) {
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
        break
      }
    }
  }

  private isValidSwap(chromosome: TimetableSlot[], index: number, newSlot: TimetableSlot): boolean {
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
  }
}

// Main Edge Function Handler
Deno.serve(async (req) => {
  try {
    // CORS headers
    if (req.method === "OPTIONS") {
      return new Response("ok", {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        },
      })
    }

    const { jobId, adminId } = await req.json()

    if (!jobId) {
      return new Response(
        JSON.stringify({ error: "Job ID required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log("[Edge Function] Starting optimization for job:", jobId, adminId ? `(admin: ${adminId})` : "")

    // Update job status
    await supabase
      .from("timetable_jobs")
      .update({ status: "optimizing", progress: 10, message: "Loading base timetable..." })
      .eq("id", jobId)

    // Fetch base timetable
    const { data: baseSlots, error } = await supabase.from("timetable_base").select("*").eq("job_id", jobId)

    if (error || !baseSlots || baseSlots.length === 0) {
      await supabase
        .from("timetable_jobs")
        .update({ status: "failed", message: "No base timetable found" })
        .eq("id", jobId)
      
      return new Response(
        JSON.stringify({ error: "No base timetable found" }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      )
    }

    // Update progress
    await supabase
      .from("timetable_jobs")
      .update({ progress: 30, message: "Running genetic algorithm..." })
      .eq("id", jobId)

    // Transform data for optimizer
    const timetableSlots: TimetableSlot[] = baseSlots.map((slot: any) => ({
      sectionId: slot.section_id,
      subjectId: slot.subject_id,
      facultyId: slot.faculty_id,
      classroomId: slot.classroom_id,
      day: slot.day_of_week,
      startPeriod: slot.start_period,
      endPeriod: slot.end_period,
    }))

    // Run GA optimization
    const startTime = Date.now()
    const optimizer = new GATimetableOptimizer(timetableSlots)
    const { optimizedSchedule, finalFitness } = optimizer.optimize()
    const optimizationTime = Date.now() - startTime

    console.log("[Edge Function] Optimization completed in", optimizationTime, "ms")

    // Update progress
    await supabase
      .from("timetable_jobs")
      .update({ progress: 80, message: "Saving optimized timetable..." })
      .eq("id", jobId)

    // Save optimized timetable - include created_by if adminId provided
    const optimizedSlots = optimizedSchedule.map((slot) => {
      const slotData: any = {
        job_id: jobId,
        section_id: slot.sectionId,
        subject_id: slot.subjectId,
        faculty_id: slot.facultyId,
        classroom_id: slot.classroomId,
        day_of_week: slot.day,
        start_period: slot.startPeriod,
        end_period: slot.endPeriod,
        fitness_score: finalFitness,
      }
      if (adminId) {
        slotData.created_by = adminId
      }
      return slotData
    })

    const { error: insertError } = await supabase.from("timetable_optimized").insert(optimizedSlots)

    if (insertError) {
      console.error("[Edge Function] Insert error:", insertError)
      await supabase
        .from("timetable_jobs")
        .update({ status: "failed", message: "Error saving optimized timetable: " + insertError.message })
        .eq("id", jobId)
      
      return new Response(
        JSON.stringify({ error: insertError.message }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      )
    }

    // Update job status
    await supabase
      .from("timetable_jobs")
      .update({
        status: "completed",
        progress: 100,
        message: `Optimization complete (fitness: ${finalFitness.toFixed(4)}, time: ${optimizationTime}ms)`,
        optimization_time: optimizationTime,
      })
      .eq("id", jobId)

    console.log("[Edge Function] Job completed successfully")

    // 📱 Trigger WhatsApp notifications to faculty
    console.log("[Edge Function] 📱 Sending WhatsApp notifications to faculty...")
    try {
      const notificationResponse = await supabase.functions.invoke('notify-faculty-timetable', {
        body: {
          jobId: jobId,
          timetableType: 'optimized'
        }
      })
      
      if (notificationResponse.error) {
        console.error("[Edge Function] ❌ Notification error:", notificationResponse.error)
      } else {
        console.log("[Edge Function] ✅ Notifications sent:", notificationResponse.data)
      }
    } catch (notifyError) {
      console.error("[Edge Function] ❌ Failed to send notifications:", notifyError)
      // Don't fail the job if notifications fail
    }

    return new Response(
      JSON.stringify({
        success: true,
        finalFitness,
        optimizationTime,
        slotsOptimized: optimizedSchedule.length,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    )
  } catch (error) {
    console.error("[Edge Function] Error:", error)
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    )
  }
})
