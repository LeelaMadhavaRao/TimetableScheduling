import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/server"
import { getRequestSession } from "@/lib/api-session"

type PackedSlot = [string, string, string, string, number, number, number]

interface ParetoEntry {
  objectives: Record<string, number>
  quality: number
  /** Hard-constraint report of this alternative (stored by optimize-timetable) */
  hard?: Record<string, number>
  slots: PackedSlot[]
}

// Enhanced mode keeps the whole Pareto front; this swaps the job's timetable for another
// non-dominated alternative chosen by the department administrator.
export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient()
    const session = await getRequestSession(request, supabase, ['department_admin'])
    if (!session) {
      return NextResponse.json({ success: false, message: "Only department administrators can choose a solution" }, { status: 403 })
    }

    const { jobId, index } = await request.json()
    const { data: admin } = await supabase.from('department_admins').select('department_id').eq('id', session.userId).single()
    const { data: job } = await supabase
      .from('timetable_jobs')
      .select('id, department_id, created_by, status, is_published, pareto_front, metrics')
      .eq('id', jobId)
      .maybeSingle()

    if (!job || !admin || job.department_id !== admin.department_id) {
      return NextResponse.json({ success: false, message: "Timetable not found in your department" }, { status: 404 })
    }
    if (job.is_published) {
      return NextResponse.json(
        { success: false, message: "This timetable is already published. Generate a new run to change it." },
        { status: 409 }
      )
    }

    if (job.status !== 'completed') {
      return NextResponse.json({ success: false, message: "Only optimized timetables have alternatives to choose from" }, { status: 409 })
    }

    const front = (job.pareto_front || []) as ParetoEntry[]
    const choice = front[Number(index)]
    if (!choice) return NextResponse.json({ success: false, message: "Unknown Pareto solution" }, { status: 400 })

    const rows = choice.slots.map(([section_id, subject_id, faculty_id, classroom_id, day_of_week, start_period, end_period]) => ({
      job_id: job.id,
      section_id,
      subject_id,
      faculty_id,
      classroom_id,
      day_of_week,
      start_period,
      end_period,
      fitness_score: Number(choice.quality.toFixed(4)),
      created_by: session.userId,
    }))

    // Insert the chosen timetable first and only then remove the old rows, so a failure never
    // leaves the job without a timetable
    const { data: oldRows } = await supabase.from('timetable_optimized').select('id').eq('job_id', job.id)
    const { error: insertError } = await supabase.from('timetable_optimized').insert(rows)
    if (insertError) return NextResponse.json({ success: false, message: insertError.message }, { status: 500 })
    const oldIds = (oldRows || []).map((r: { id: string }) => r.id)
    if (oldIds.length > 0) {
      const { error: deleteError } = await supabase.from('timetable_optimized').delete().in('id', oldIds)
      if (deleteError) return NextResponse.json({ success: false, message: deleteError.message }, { status: 500 })
    }

    const metrics = job.metrics || {}
    const final = {
      ...(metrics.final || {}),
      objectives: choice.objectives,
      quality: choice.quality,
      slotCount: rows.length,
      ...(choice.hard ? { hard: choice.hard } : {}),
    }
    const { error: updateError } = await supabase
      .from('timetable_jobs')
      .update({ selected_solution: Number(index), metrics: { ...metrics, final } })
      .eq('id', job.id)
    if (updateError) return NextResponse.json({ success: false, message: updateError.message }, { status: 500 })

    return NextResponse.json({ success: true, message: `Pareto solution #${Number(index) + 1} selected` })
  } catch (error) {
    console.error("Select solution error:", error)
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 })
  }
}
