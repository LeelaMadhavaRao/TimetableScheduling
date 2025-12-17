import { getSupabaseServerClient } from "@/lib/server"
import { TimetableViewer } from "@/components/timetable-viewer"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default async function TimetablePage() {
  const supabase = await getSupabaseServerClient()

  // Fetch latest completed job
  const { data: latestJob } = await supabase
    .from("timetable_jobs")
    .select("*")
    .in("status", ["base_complete", "completed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (!latestJob) {
    return (
      <div className="container mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>No Timetable Available</CardTitle>
            <CardDescription>Generate a timetable first to view it here</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  // Decide which timetable to show
  const useOptimized = latestJob.status === "completed"
  const tableName = useOptimized ? "timetable_optimized" : "timetable_base"

  // Fetch timetable data
  const { data: timetableSlots } = await supabase
    .from(tableName)
    .select("*, sections(name, year_level), subjects(name, code, subject_type), faculty(name, code), classrooms(name)")
    .eq("job_id", latestJob.id)

  // Fetch all sections and faculty for filters
  const { data: sections } = await supabase.from("sections").select("*").order("year_level").order("name")

  const { data: faculty } = await supabase.from("faculty").select("*").order("name")

  return (
    <div className="container mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="mb-6">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-foreground mb-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Timetable Viewer
        </h1>
        <p className="text-muted-foreground">View generated timetables by section or faculty</p>
      </div>

      <Card className="mb-6 hover:shadow-lg transition-shadow">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <CardTitle>
              {useOptimized ? "Optimized Timetable" : "Base Timetable"} - Job {latestJob.id.slice(0, 8)}
            </CardTitle>
          </div>
          <CardDescription>{latestJob.message}</CardDescription>
        </CardHeader>
      </Card>

      <TimetableViewer
        timetableSlots={timetableSlots || []}
        sections={sections || []}
        faculty={faculty || []}
        isOptimized={useOptimized}
      />
    </div>
  )
}
