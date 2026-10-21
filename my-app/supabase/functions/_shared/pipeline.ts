// Orchestrates the two pipelines compared in the research paper and records the
// evaluation metrics of Section 5.3 for each run.
//
//   baseline  : single ILP solve + greedy theory -> weighted-sum GA (original code)
//   enhanced  : Relaxed-ILP diversified seeds   -> NSGA-II with SCPX + block mutation
//
// Both get the same optimization budget (population x generations) so differences come
// from the algorithm design, not from extra compute.

import { GATimetableOptimizer } from "./baseline-ga.ts"
import { ILPTimetableGenerator } from "./base-generator.ts"
import { buildSchedulingContext, evaluateHardConstraints, SchedulingContext } from "./constraints.ts"
import { NSGA2TimetableOptimizer, ParetoSolution } from "./enhanced-ga.ts"
import {
  computeObjectives,
  convergenceGeneration,
  frontSpread,
  hypervolume,
  nonDominated,
  objectiveArray,
  populationDiversity,
  summarizeTimetable,
  TimetableSummary,
} from "./metrics.ts"
import {
  AlgorithmMode,
  ClassroomOption,
  CourseAssignment,
  FacultyAvailabilitySlot,
  Occupancy,
  TimetableSlot,
} from "./scheduling-types.ts"

/** Same budget for both modes */
export const COMPARISON_BUDGET = { populationSize: 20, generations: 30 }

/** Relaxed-ILP diversification settings (tau = 0.3 as tuned in the paper) */
export const DIVERSIFICATION = { seedCount: 4, minHamming: 0.3, rngSeed: 7 }

export interface BaseStageResult {
  slots: TimetableSlot[]
  seeds: TimetableSlot[][]
  generator: ILPTimetableGenerator
  timeMs: number
  diversification: {
    seedCount: number
    seedsGenerated: number
    labVariantsFromILP: number
    labSource: string
    meanPairwiseHamming: number
    solverMessage: string | null
  } | null
}

export async function runBaseStage(
  mode: AlgorithmMode,
  courses: CourseAssignment[],
  rooms: ClassroomOption[],
  availability: FacultyAvailabilitySlot[],
  occupancy: Occupancy,
): Promise<BaseStageResult> {
  const started = Date.now()
  const generator = new ILPTimetableGenerator(courses, rooms, availability, { occupancy })

  if (mode === "baseline") {
    const slots = await generator.generate()
    return { slots, seeds: [slots], generator, timeMs: Date.now() - started, diversification: null }
  }

  const result = await generator.generateDiversified(DIVERSIFICATION)

  // Only hard-feasible seeds with the best achievable coverage enter the NSGA-II population
  // (a seed that already breaks a rule would pass the violation on to its offspring)
  const ctx = buildSchedulingContext(courses, rooms, availability, occupancy)
  const reports = result.seeds.map((s) => evaluateHardConstraints(s.slots, ctx))
  // Coverage is compared separately below, so "clean" means no other rule is broken
  const clean = result.seeds.filter((_, i) => reports[i].totalViolations - reports[i].coverageDeficitPeriods === 0)
  const pool = clean.length > 0 ? clean : result.seeds
  const bestDeficit = Math.min(...pool.map((s) => evaluateHardConstraints(s.slots, ctx).coverageDeficitPeriods))
  const seeds = pool.filter((s) => evaluateHardConstraints(s.slots, ctx).coverageDeficitPeriods === bestDeficit)

  return {
    slots: seeds[0].slots,
    seeds: seeds.map((s) => s.slots),
    generator,
    timeMs: Date.now() - started,
    diversification: {
      seedCount: seeds.length,
      seedsGenerated: result.seeds.length,
      labVariantsFromILP: result.labVariants,
      labSource: result.labSource,
      meanPairwiseHamming: populationDiversity(seeds.map((s) => s.slots)),
      solverMessage: result.solverMessage,
    },
  }
}

export interface ProcessMetrics {
  populationSize: number
  generations: number
  /** PIE: mean pairwise Hamming distance of the initial population */
  initialDiversity: number
  /** GD at the last generation */
  finalDiversity: number
  /** CP: % of offspring with no hard violation and no lost course periods */
  constraintPreservation: number
  offspringEvaluated: number
  /** % of attempted crossover exchanges (genes / coordinate groups) that were kept */
  crossoverAcceptance: number
  /** Infeasible-move work: rejected crossover genes + rejected mutation attempts */
  rejectedOperations: number
  mutationAttemptsPerAcceptedMove: number
  convergenceGeneration: number
  /** HV of the solution set handed to the administrator (baseline: 1 timetable) */
  hypervolume: number
  /** HV of the non-dominated set of the final population */
  populationHypervolume: number
  paretoFrontSize: number
  /** Non-dominated solutions found before picking the few offered to the administrator */
  fullFrontSize: number
  frontSpread: number
  /** Generations actually run (the enhanced search stops early when it stagnates) */
  generationsRun: number
  /** Candidate positions considered by mutation (cheap screening included) */
  candidatesScreened: number
  optimizationTimeMs: number
}

export interface OptimizeStageResult {
  finalSlots: TimetableSlot[]
  final: TimetableSummary
  process: ProcessMetrics
  paretoFront: ParetoSolution[] | null
}

function offspringChecker(ctx: SchedulingContext, baseDeficit: number) {
  let clean = 0
  let total = 0
  return {
    observe(slots: TimetableSlot[]) {
      const report = evaluateHardConstraints(slots, ctx)
      total++
      const otherViolations = report.totalViolations - report.coverageDeficitPeriods
      if (otherViolations === 0 && report.coverageDeficitPeriods <= baseDeficit) clean++
    },
    rate: () => (total > 0 ? (clean / total) * 100 : 100),
    total: () => total,
  }
}

export function runOptimizeStage(
  mode: AlgorithmMode,
  baseSlots: TimetableSlot[],
  seeds: TimetableSlot[][],
  ctx: SchedulingContext,
  budget = COMPARISON_BUDGET,
): OptimizeStageResult {
  const baseDeficit = evaluateHardConstraints(baseSlots, ctx).coverageDeficitPeriods
  const checker = offspringChecker(ctx, baseDeficit)

  if (mode === "baseline") {
    const ga = new GATimetableOptimizer(baseSlots, {
      config: { POPULATION_SIZE: budget.populationSize, GENERATIONS: budget.generations },
      occupancy: ctx.occupancy,
      rooms: [...ctx.rooms.values()],
    })
    ga.offspringObserver = (slots) => checker.observe(slots)
    const { optimizedSchedule, finalPopulation } = ga.optimize()
    const s = ga.stats
    const returned = [objectiveArray(computeObjectives(optimizedSchedule, ctx))]
    const populationPoints = nonDominated(finalPopulation.map((p) => objectiveArray(computeObjectives(p, ctx))))

    return {
      finalSlots: optimizedSchedule,
      final: summarizeTimetable(optimizedSchedule, ctx),
      paretoFront: null,
      process: {
        populationSize: budget.populationSize,
        generations: budget.generations,
        initialDiversity: populationDiversity(ga.initialPopulation),
        finalDiversity: populationDiversity(finalPopulation),
        constraintPreservation: checker.rate(),
        offspringEvaluated: checker.total(),
        crossoverAcceptance: s.crossoverGenesAttempted > 0 ? (1 - s.crossoverGenesRejected / s.crossoverGenesAttempted) * 100 : 100,
        rejectedOperations: s.crossoverGenesRejected + (s.mutationAttempts - s.mutationAccepted),
        mutationAttemptsPerAcceptedMove: s.mutationAccepted > 0 ? s.mutationAttempts / s.mutationAccepted : s.mutationAttempts,
        convergenceGeneration: convergenceGeneration(s.bestFitnessHistory),
        hypervolume: hypervolume(returned),
        populationHypervolume: hypervolume(populationPoints),
        paretoFrontSize: 1,
        fullFrontSize: populationPoints.length,
        frontSpread: 0,
        generationsRun: budget.generations,
        candidatesScreened: s.mutationAttempts,
        optimizationTimeMs: s.totalTimeMs,
      },
    }
  }

  const nsga = new NSGA2TimetableOptimizer(seeds.length > 0 ? seeds : [baseSlots], ctx, {
    populationSize: budget.populationSize,
    generations: budget.generations,
  })
  nsga.offspringObserver = (slots) => checker.observe(slots)
  const { front, chosenIndex, population, frontPoints } = nsga.optimize()
  const s = nsga.stats
  const chosen = front[chosenIndex]?.slots || baseSlots
  const populationPoints = nonDominated(population.map((p) => objectiveArray(computeObjectives(p, ctx))))

  return {
    finalSlots: chosen,
    final: summarizeTimetable(chosen, ctx),
    paretoFront: front,
    process: {
      populationSize: budget.populationSize,
      generations: budget.generations,
      initialDiversity: populationDiversity(nsga.initialPopulation),
      finalDiversity: s.diversityHistory[s.diversityHistory.length - 1] ?? 0,
      constraintPreservation: checker.rate(),
      offspringEvaluated: checker.total(),
      crossoverAcceptance: s.scpxGroupsAttempted > 0 ? (s.scpxGroupsAccepted / s.scpxGroupsAttempted) * 100 : 100,
      rejectedOperations: s.scpxGroupsReverted + (s.mutationAttempts - s.mutationAccepted),
      mutationAttemptsPerAcceptedMove: s.mutationAccepted > 0 ? s.mutationAttempts / s.mutationAccepted : s.mutationAttempts,
      convergenceGeneration: convergenceGeneration(s.bestQualityHistory),
      hypervolume: hypervolume(frontPoints),
      populationHypervolume: hypervolume(populationPoints),
      paretoFrontSize: front.length,
      fullFrontSize: s.fullFrontSize,
      frontSpread: frontSpread(frontPoints),
      generationsRun: s.generationsRun,
      candidatesScreened: s.candidatesScreened,
      optimizationTimeMs: s.totalTimeMs,
    },
  }
}
