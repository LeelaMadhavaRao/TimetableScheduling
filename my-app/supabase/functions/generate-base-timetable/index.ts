// Supabase Edge Function: Phase 1 of the ILP-GA pipeline for ONE department.
//
//   action "generate"   (default) - base timetable for the department admin's selected sections
//        mode "baseline"  single ILP solve + greedy theory   (before enhancement)
//        mode "enhanced"  Relaxed-ILP diversified seeding     (after enhancement)
//   action "reschedule" - incremental rescheduling of a published timetable after a
//                         faculty/room disruption (Enhancement 3)
//
// Every run schedules around the timetables other departments of the same college have
// already published (committed_timetable), so shared faculty and rooms are never double-booked.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import { handleCors } from "../_shared/cors.ts"
import { setSolverUrl, validateScheduleCompleteness } from "../_shared/base-generator.ts"
import { buildSchedulingContext } from "../_shared/constraints.ts"
import { summarizeTimetable } from "../_shared/metrics.ts"
import { runBaseStage } from "../_shared/pipeline.ts"
import { Disruption, runIncrementalReschedule } from "../_shared/rescheduler.ts"
import { AlgorithmMode } from "../_shared/scheduling-types.ts"
import {
  DepartmentAdminSession,
  fromSlotRows,
  jsonResponse,
  loadDepartmentProblem,
  packSlots,
  resolveDepartmentAdmin,
  sectionKeyOf,
  selectAll,
  toSlotRows,
} from "../_shared/supabase-context.ts"

const MAX_LOG_LINES = 4000

// deno-lint-ignore no-explicit-any
type Supabase = any

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  // Capture logs for UI display
  const executionLogs: string[] = []
  const originalLog = console.log
  const originalError = console.error
  const capture = (level: string) => (...args: unknown[]) => {
    if (executionLogs.length < MAX_LOG_LINES) {
      executionLogs.push(`[${level}] ${args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ")}`)
    }
  }
  console.log = (...args) => {
    capture("INFO")(...args)
    originalLog(...args)
  }
  console.error = (...args) => {
    capture("ERROR")(...args)
    originalError(...args)
  }

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
    setSolverUrl(Deno.env.get("ILP_SOLVER_URL"))

    // deno-lint-ignore no-explicit-any
    let body: any = {}
    try {
      body = await req.json()
    } catch {
      // empty body
    }

    const admin = await resolveDepartmentAdmin(supabase, body.sessionToken)
    if (!admin) {
      return jsonResponse({ success: false, error: "Only a signed-in department administrator can generate timetables" }, 401)
    }

    if (body.action === "reschedule") {
      return await handleReschedule(supabase, admin, body, executionLogs)
    }
    return await handleGenerate(supabase, admin, body, executionLogs)
  } catch (error) {
    console.error("[Edge Function] Error:", error)
    return jsonResponse({ success: false, error: error instanceof Error ? error.message : "Internal server error", executionLogs }, 500)
  } finally {
    console.log = originalLog
    console.error = originalError
  }
})

async function departmentSections(supabase: Supabase, admin: DepartmentAdminSession, requested: unknown): Promise<string[]> {
  const ids = Array.isArray(requested) ? requested.filter((id) => typeof id === "string") : []
  if (ids.length === 0) return []
  const { data } = await supabase.from("sections").select("id").eq("department_id", admin.departmentId).in("id", ids)
  // deno-lint-ignore no-explicit-any
  return (data || []).map((s: any) => s.id)
}

// deno-lint-ignore no-explicit-any
async function handleGenerate(supabase: Supabase, admin: DepartmentAdminSession, body: any, executionLogs: string[]): Promise<Response> {
  const mode: AlgorithmMode = body.mode === "enhanced" ? "enhanced" : "baseline"
  const sectionIds = await departmentSections(supabase, admin, body.sectionIds)
  if (sectionIds.length === 0) {
    return jsonResponse({ success: false, error: "Select at least one section of your department" }, 400)
  }

  console.log(`[Edge Function] ${mode.toUpperCase()} base generation for ${sectionIds.length} section(s), department ${admin.departmentId}`)

  const { data: job, error: jobError } = await supabase
    .from("timetable_jobs")
    .insert({
      status: "generating_base",
      progress: 10,
      message: "Loading department data and committed timetables...",
      created_by: admin.id,
      college_id: admin.collegeId,
      department_id: admin.departmentId,
      section_ids: sectionIds,
      section_key: sectionKeyOf(sectionIds),
      algorithm_mode: mode,
      run_type: "full",
    })
    .select()
    .single()
  if (jobError) throw jobError

  const fail = async (status: number, payload: Record<string, unknown>, message: string) => {
    await supabase.from("timetable_jobs").update({ status: "failed", message }).eq("id", job.id)
    return jsonResponse({ success: false, jobId: job.id, executionLogs, ...payload }, status)
  }

  // Any failure (solver timeout, database error) marks the job failed instead of leaving it
  // stuck at "generating"
  try {
    const problem = await loadDepartmentProblem(supabase, admin.collegeId, sectionIds)
    if (problem.courses.length === 0) {
      return fail(200, { error: "The selected sections have no subjects assigned" }, "Selected sections have no subjects assigned")
    }
    if (problem.rooms.length === 0) {
      return fail(200, { error: "Your college has no classrooms configured" }, "No classrooms configured")
    }
    console.log(`[Edge Function] ${problem.courses.length} courses, ${problem.rooms.length} rooms, ${problem.committedSlotCount} committed slots from other departments`)

    await supabase
      .from("timetable_jobs")
      .update({
        progress: 40,
        message: mode === "enhanced" ? "Relaxed-ILP diversification: building diverse feasible seeds..." : "Running ILP solver (labs) and greedy theory scheduling...",
      })
      .eq("id", job.id)

    const base = await runBaseStage(mode, problem.courses, problem.rooms, problem.availability, problem.occupancy)
    const slots = base.slots
    console.log(`[Edge Function] Base stage finished in ${base.timeMs}ms with ${slots.length} slots`)

    const conflicts = base.generator.detectConflicts(slots)
    if (conflicts.length > 0) {
      return fail(200, { error: "CONFLICTS_DETECTED", conflicts: conflicts.slice(0, 10) }, `Timetable generation failed: ${conflicts.length} conflicts detected. ${conflicts[0]}`)
    }

    await supabase.from("timetable_jobs").update({ progress: 80, message: "Saving base timetable..." }).eq("id", job.id)
    const { error: insertError } = await supabase.from("timetable_base").insert(toSlotRows(job.id, slots, admin.id))
    if (insertError) return fail(500, { error: insertError.message }, "Error saving timetable: " + insertError.message)

    const validation = await validateScheduleCompleteness(
      supabase,
      problem.courses,
      slots,
      job.id,
      problem.rooms,
      problem.availability,
      base.generator.getILPError(),
      base.generator.getReducedCourses(),
    )
    if (validation.missing.length > 0) {
      return fail(
        200,
        {
          error: "INCOMPLETE_SCHEDULE",
          details: validation.missing,
          diagnostics: validation.diagnostics,
          message: `Generated timetable is incomplete. ${validation.missing.length} subject(s) not fully scheduled.`,
        },
        `Incomplete schedule: ${validation.missing.length} subjects missing`,
      )
    }

    const ctx = buildSchedulingContext(problem.courses, problem.rooms, problem.availability, problem.occupancy)
    const summary = summarizeTimetable(slots, ctx)

    await supabase
      .from("timetable_jobs")
      .update({
        status: "base_complete",
        progress: 100,
        message: `${mode === "enhanced" ? "Enhanced" : "Baseline"} base timetable ready (${slots.length} slots in ${base.timeMs}ms)${mode === "enhanced" ? `, ${base.seeds.length} diverse seeds` : ""}`,
        base_generation_time: base.timeMs,
        metrics: {
          mode,
          base: { ...summary, timeMs: base.timeMs, diversification: base.diversification, committedSlotsRespected: problem.committedSlotCount },
        },
        seed_population: mode === "enhanced" ? base.seeds.map(packSlots) : null,
      })
      .eq("id", job.id)

    // Keep only the newest unpublished run per (department, section set, mode)
    const { data: oldJobs } = await supabase
      .from("timetable_jobs")
      .select("id")
      .eq("department_id", admin.departmentId)
      .eq("section_key", sectionKeyOf(sectionIds))
      .eq("algorithm_mode", mode)
      .eq("run_type", "full")
      .eq("is_published", false)
      .neq("id", job.id)
    if (oldJobs && oldJobs.length > 0) {
      // deno-lint-ignore no-explicit-any
      await supabase.from("timetable_jobs").delete().in("id", oldJobs.map((j: any) => j.id))
    }

    return jsonResponse({
      success: true,
      jobId: job.id,
      mode,
      slotsGenerated: slots.length,
      generationTime: base.timeMs,
      executionLogs,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[Edge Function] Generation failed:", message)
    return fail(500, { error: message }, `Generation failed: ${message}`)
  }
}

// deno-lint-ignore no-explicit-any
async function handleReschedule(supabase: Supabase, admin: DepartmentAdminSession, body: any, executionLogs: string[]): Promise<Response> {
  const { data: parent } = await supabase
    .from("timetable_jobs")
    .select("*")
    .eq("id", body.parentJobId)
    .eq("department_id", admin.departmentId)
    .maybeSingle()
  if (!parent || parent.status !== "completed" || !parent.is_published) {
    return jsonResponse({ success: false, error: "Choose a published timetable of your department to reschedule" }, 400)
  }

  const days = (Array.isArray(body.disruption?.days) ? body.disruption.days : [])
    .map(Number)
    .filter((d: number) => Number.isInteger(d) && d >= 0 && d <= 5)
  let disruption: Disruption
  if (body.disruption?.type === "room" && typeof body.disruption.roomId === "string") {
    disruption = { type: "room", roomId: body.disruption.roomId, days }
  } else if (body.disruption?.type === "faculty" && typeof body.disruption.facultyId === "string") {
    disruption = { type: "faculty", facultyId: body.disruption.facultyId, days }
  } else {
    return jsonResponse({ success: false, error: "Describe the disruption: a faculty member or room and the affected days" }, 400)
  }

  const { data: rows, error } = await selectAll(() => supabase.from("timetable_optimized").select("*").eq("job_id", parent.id).order("id"))
  if (error) throw error
  const currentSlots = fromSlotRows(rows || [])
  const problem = await loadDepartmentProblem(supabase, admin.collegeId, parent.section_ids)

  console.log(`[Reschedule] ${disruption.type} disruption on days [${days.join(",") || "all"}] for job ${parent.id}`)
  const result = await runIncrementalReschedule({
    currentSlots,
    courses: problem.courses,
    rooms: problem.rooms,
    availability: problem.availability,
    occupancy: problem.occupancy,
    disruption,
  })

  const m = result.metrics
  const fullRegenerationMs = (parent.base_generation_time || 0) + (parent.optimization_time || 0)
  const unplaced = m.periodsToReplace - m.periodsReplaced

  const { data: job, error: jobError } = await supabase
    .from("timetable_jobs")
    .insert({
      status: "completed",
      progress: 100,
      message:
        unplaced > 0
          ? `Incremental reschedule placed ${m.periodsReplaced}/${m.periodsToReplace} periods in ${m.latencyMs}ms - ${unplaced} period(s) need a full regeneration`
          : `Incremental reschedule: ${m.affectedSlots} slot(s) moved, ${(m.lockRatio * 100).toFixed(1)}% of the timetable locked, ${m.latencyMs}ms`,
      created_by: admin.id,
      college_id: admin.collegeId,
      department_id: admin.departmentId,
      section_ids: parent.section_ids,
      section_key: parent.section_key,
      algorithm_mode: "enhanced",
      run_type: "reschedule",
      parent_job_id: parent.id,
      base_generation_time: m.latencyMs,
      optimization_time: 0,
      metrics: {
        mode: "enhanced",
        final: result.summary,
        reschedule: {
          ...m,
          disruption,
          referenceFullRegenerationMs: fullRegenerationMs,
          speedup: fullRegenerationMs > 0 ? fullRegenerationMs / Math.max(1, m.latencyMs) : null,
        },
      },
    })
    .select()
    .single()
  if (jobError) throw jobError

  const slotRows = toSlotRows(job.id, result.slots, admin.id)
  const [baseInsert, optimizedInsert] = await Promise.all([
    supabase.from("timetable_base").insert(slotRows),
    supabase.from("timetable_optimized").insert(toSlotRows(job.id, result.slots, admin.id, result.summary.quality)),
  ])
  if (baseInsert.error || optimizedInsert.error) {
    const message = (baseInsert.error || optimizedInsert.error).message
    await supabase.from("timetable_jobs").update({ status: "failed", message: "Error saving rescheduled timetable: " + message }).eq("id", job.id)
    return jsonResponse({ success: false, error: message, executionLogs }, 500)
  }

  return jsonResponse({ success: true, jobId: job.id, metrics: m, hard: result.summary.hard, executionLogs })
}
