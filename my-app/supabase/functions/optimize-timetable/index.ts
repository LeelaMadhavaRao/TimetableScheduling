// Supabase Edge Function: Phase 2 of the ILP-GA pipeline.
//
//   baseline job -> original weighted-sum GA (single seed, slot crossover with rejection)
//   enhanced job -> NSGA-II seeded with the Relaxed-ILP population, SCPX crossover and
//                   constraint-safe block mutation; the whole Pareto front is stored so the
//                   department admin can pick a different trade-off later
//
// Both use the same population x generations budget and the same evaluation metrics.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import { handleCors } from "../_shared/cors.ts"
import { buildSchedulingContext, evaluateHardConstraints } from "../_shared/constraints.ts"
import { runOptimizeStage } from "../_shared/pipeline.ts"
import { AlgorithmMode } from "../_shared/scheduling-types.ts"
import {
  fromSlotRows,
  jsonResponse,
  loadDepartmentProblem,
  packSlots,
  PackedSlot,
  resolveDepartmentAdmin,
  toSlotRows,
  unpackSlots,
} from "../_shared/supabase-context.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  // deno-lint-ignore no-explicit-any
  const supabase: any = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
  let jobId: string | null = null

  try {
    const { jobId: requestedJobId, sessionToken } = await req.json()
    if (!requestedJobId) return jsonResponse({ success: false, error: "Job ID required" }, 400)

    const admin = await resolveDepartmentAdmin(supabase, sessionToken)
    if (!admin) return jsonResponse({ success: false, error: "Only a signed-in department administrator can optimize timetables" }, 401)

    const { data: job } = await supabase
      .from("timetable_jobs")
      .select("*")
      .eq("id", requestedJobId)
      .eq("department_id", admin.departmentId)
      .maybeSingle()
    if (!job) return jsonResponse({ success: false, error: "Timetable job not found for your department" }, 404)
    if (job.status !== "base_complete") return jsonResponse({ success: false, error: "Generate the base timetable first" }, 400)
    jobId = job.id

    const mode: AlgorithmMode = job.algorithm_mode === "enhanced" ? "enhanced" : "baseline"
    console.log(`[Edge Function] ${mode.toUpperCase()} optimization for job ${job.id}`)

    // Claim the job atomically: a second concurrent call finds it no longer base_complete
    const { data: claimed } = await supabase
      .from("timetable_jobs")
      .update({ status: "optimizing", progress: 10, message: "Loading base timetable and committed occupancy..." })
      .eq("id", job.id)
      .eq("status", "base_complete")
      .select("id")
    if (!claimed || claimed.length === 0) {
      return jsonResponse({ success: false, error: "This timetable is already being optimized" }, 409)
    }

    const { data: baseRows, error } = await supabase.from("timetable_base").select("*").eq("job_id", job.id)
    if (error || !baseRows || baseRows.length === 0) {
      await supabase.from("timetable_jobs").update({ status: "failed", message: "No base timetable found" }).eq("id", job.id)
      return jsonResponse({ success: false, error: "No base timetable found" }, 404)
    }

    const baseSlots = fromSlotRows(baseRows)
    const problem = await loadDepartmentProblem(supabase, admin.collegeId, job.section_ids)
    const ctx = buildSchedulingContext(problem.courses, problem.rooms, problem.availability, problem.occupancy)
    const seeds =
      mode === "enhanced" && Array.isArray(job.seed_population) && job.seed_population.length > 0
        ? (job.seed_population as PackedSlot[][]).map(unpackSlots)
        : [baseSlots]

    await supabase
      .from("timetable_jobs")
      .update({
        progress: 30,
        message:
          mode === "enhanced"
            ? `Running NSGA-II with SCPX on ${seeds.length} diversified seeds...`
            : "Running weighted-sum genetic algorithm...",
      })
      .eq("id", job.id)

    const result = runOptimizeStage(mode, baseSlots, seeds, ctx)
    const optimizationTime = result.process.optimizationTimeMs

    await supabase.from("timetable_jobs").update({ progress: 80, message: "Saving optimized timetable..." }).eq("id", job.id)
    await supabase.from("timetable_optimized").delete().eq("job_id", job.id)
    const { error: insertError } = await supabase
      .from("timetable_optimized")
      .insert(toSlotRows(job.id, result.finalSlots, admin.id, result.final.quality))
    if (insertError) {
      await supabase.from("timetable_jobs").update({ status: "failed", message: "Error saving optimized timetable: " + insertError.message }).eq("id", job.id)
      return jsonResponse({ success: false, error: insertError.message }, 500)
    }

    const hard = result.final.hard
    await supabase
      .from("timetable_jobs")
      .update({
        status: "completed",
        progress: 100,
        message:
          `${mode === "enhanced" ? "NSGA-II" : "GA"} optimization complete: quality ${result.final.quality.toFixed(4)}, ` +
          `${hard.totalViolations} hard violation(s), coverage ${hard.coveragePercent.toFixed(1)}%` +
          (mode === "enhanced" ? `, ${result.process.paretoFrontSize} Pareto-optimal alternatives` : "") +
          ` (${optimizationTime}ms)`,
        optimization_time: optimizationTime,
        metrics: { ...(job.metrics || {}), mode, final: result.final, process: result.process },
        pareto_front: result.paretoFront
          ? result.paretoFront.map((s) => ({
              objectives: s.objectives,
              quality: s.quality,
              // Each alternative's own hard-constraint report, used when the admin switches to it
              hard: evaluateHardConstraints(s.slots, ctx),
              slots: packSlots(s.slots),
            }))
          : null,
        selected_solution: result.paretoFront ? 0 : null,
        seed_population: null,
      })
      .eq("id", job.id)

    return jsonResponse({
      success: true,
      mode,
      finalQuality: result.final.quality,
      optimizationTime,
      hardViolations: hard.totalViolations,
      paretoFrontSize: result.process.paretoFrontSize,
      slotsOptimized: result.finalSlots.length,
    })
  } catch (error) {
    console.error("[Edge Function] Error:", error)
    if (jobId) {
      await supabase
        .from("timetable_jobs")
        .update({ status: "failed", message: `Optimization failed: ${error instanceof Error ? error.message : String(error)}` })
        .eq("id", jobId)
    }
    return jsonResponse({ success: false, error: error instanceof Error ? error.message : "Internal server error" }, 500)
  }
})
