import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/server"
import { GATimetableOptimizer } from "@/lib/ga-optimizer"
import type { TimetableSlot } from "@/lib/ilp-generator"

export async function POST(request: Request) {
  try {
    const { jobId } = await request.json()

    if (!jobId) {
      return NextResponse.json({ error: "Job ID required" }, { status: 400 })
    }

    const supabase = await getSupabaseServerClient()

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
      return NextResponse.json({ error: "No base timetable found" }, { status: 404 })
    }

    // Update progress
    await supabase
      .from("timetable_jobs")
      .update({ progress: 30, message: "Running genetic algorithm..." })
      .eq("id", jobId)

    // Transform data for optimizer
    const timetableSlots: TimetableSlot[] = baseSlots.map((slot) => ({
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

    // Update progress
    await supabase
      .from("timetable_jobs")
      .update({ progress: 80, message: "Saving optimized timetable..." })
      .eq("id", jobId)

    // Save optimized timetable
    const optimizedSlots = optimizedSchedule.map((slot) => ({
      job_id: jobId,
      section_id: slot.sectionId,
      subject_id: slot.subjectId,
      faculty_id: slot.facultyId,
      classroom_id: slot.classroomId,
      day_of_week: slot.day,
      start_period: slot.startPeriod,
      end_period: slot.endPeriod,
      fitness_score: finalFitness,
    }))

    const { error: insertError } = await supabase.from("timetable_optimized").insert(optimizedSlots)

    if (insertError) {
      await supabase
        .from("timetable_jobs")
        .update({ status: "failed", message: "Error saving optimized timetable: " + insertError.message })
        .eq("id", jobId)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
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

    return NextResponse.json({
      success: true,
      finalFitness,
      optimizationTime,
      slotsOptimized: optimizedSchedule.length,
    })
  } catch (error) {
    console.error("[v0] Error optimizing timetable:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
