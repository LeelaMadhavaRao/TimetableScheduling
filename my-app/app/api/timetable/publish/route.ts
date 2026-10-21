import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/server"
import { getRequestSession } from "@/lib/api-session"

// Publishing makes a department's timetable binding: its faculty and room periods become
// occupied time for every other department of the college (see committed_timetable and
// publish_timetable_job in scripts/021_college_department_hierarchy.sql).
export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient()
    const session = await getRequestSession(request, supabase, ['department_admin'])
    if (!session) {
      return NextResponse.json({ success: false, message: "Only department administrators can publish timetables" }, { status: 403 })
    }

    const { jobId, allowWarnings } = await request.json()
    if (!jobId) return NextResponse.json({ success: false, message: "Job ID is required" }, { status: 400 })

    const { data: admin } = await supabase
      .from('department_admins')
      .select('department_id')
      .eq('id', session.userId)
      .single()

    const { data: job } = await supabase
      .from('timetable_jobs')
      .select('id, department_id, status, metrics')
      .eq('id', jobId)
      .maybeSingle()

    if (!job || !admin || job.department_id !== admin.department_id) {
      return NextResponse.json({ success: false, message: "Timetable not found in your department" }, { status: 404 })
    }

    // Double bookings can never be published; other rule breaks need explicit confirmation
    const hard = job.metrics?.final?.hard
    if (hard?.criticalViolations > 0) {
      return NextResponse.json(
        { success: false, message: `This timetable double-books ${hard.criticalViolations} period(s) and cannot be published.` },
        { status: 409 }
      )
    }
    if (hard?.totalViolations > 0 && !allowWarnings) {
      return NextResponse.json(
        {
          success: false,
          requiresConfirmation: true,
          message: `This timetable breaks ${hard.totalViolations} scheduling rule(s) (faculty availability, daily subject limit or calendar rules). Publish anyway?`,
        },
        { status: 409 }
      )
    }

    const { data, error } = await supabase.rpc('publish_timetable_job', { p_job_id: jobId })
    if (error) {
      console.error("Publish error:", error)
      return NextResponse.json({ success: false, message: error.message }, { status: 500 })
    }

    const result = data as { success: boolean; message: string }
    return NextResponse.json(result, { status: result.success ? 200 : 409 })
  } catch (error) {
    console.error("Publish timetable error:", error)
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 })
  }
}
