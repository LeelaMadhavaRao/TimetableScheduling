import { getSupabaseServerClient, getCurrentDepartmentAdmin } from "@/lib/server"
import { StatsCard } from "@/components/stats-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BookOpen, Layers, Calendar, CalendarCheck, Users, FlaskConical } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import ClickSpark from "@/components/ClickSpark"

const WORKFLOW = [
  { title: "Create Subjects", text: "Add your department's theory and lab subjects and map the faculty (from any department of the college) who can teach them." },
  { title: "Setup Sections", text: "Create sections with student counts and assign each subject with its faculty member." },
  { title: "Generate", text: "Pick the sections to schedule. Choose Before Enhancement (baseline ILP + weighted GA) or After Enhancement (Relaxed-ILP seeding + SCPX + NSGA-II); run both to compare the evaluation metrics." },
  { title: "Publish", text: "Publishing commits the timetable: those faculty and room periods become unavailable to other departments, and faculty see it in their portal." },
]

export default async function DepartmentDashboardPage() {
  const supabase = await getSupabaseServerClient()
  const admin = await getCurrentDepartmentAdmin()
  const departmentId = admin?.departmentId || "00000000-0000-0000-0000-000000000000"
  const collegeId = admin?.collegeId || "00000000-0000-0000-0000-000000000000"

  const [subjects, sections, jobs, committed] = await Promise.all([
    supabase.from("subjects").select("*", { count: "exact", head: true }).eq("department_id", departmentId),
    supabase.from("sections").select("*", { count: "exact", head: true }).eq("department_id", departmentId),
    supabase
      .from("timetable_jobs")
      .select("id, status, algorithm_mode, run_type, is_published, created_at, section_ids, metrics")
      .eq("department_id", departmentId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("committed_timetable")
      .select("id", { count: "exact", head: true })
      .eq("college_id", collegeId)
      .neq("department_id", departmentId),
  ])

  const recent = jobs.data || []
  const published = recent.filter((j) => j.is_published)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">{admin?.departmentCode || "Department"} Dashboard</h1>
        <p className="text-slate-300">{admin?.departmentName || "Manage your department's subjects, sections and timetables"}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Subjects" value={subjects.count || 0} icon={BookOpen} description="Owned by this department" />
        <StatsCard title="Sections" value={sections.count || 0} icon={Layers} description="Classes of this department" />
        <StatsCard title="Published" value={published.length} icon={CalendarCheck} description="Committed timetables" />
        <StatsCard title="Booked by Others" value={committed.count || 0} icon={Users} description="Slots other departments committed" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white">Quick Actions</CardTitle>
            <CardDescription className="text-slate-300">Department administration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { href: "/department/subjects", label: "Manage Subjects", icon: BookOpen, color: "#8b5cf6" },
              { href: "/department/sections", label: "Manage Sections", icon: Layers, color: "#ec4899" },
              { href: "/timetable", label: "View Timetables", icon: CalendarCheck, color: "#3b82f6" },
            ].map(({ href, label, icon: Icon, color }) => (
              <Link key={href} href={href} className="block">
                <ClickSpark sparkColor={color} sparkSize={10} sparkRadius={15} sparkCount={8} duration={400}>
                  <Button variant="outline" className="w-full justify-start bg-slate-700/50 border-slate-600 text-white hover:bg-slate-700 hover:border-blue-500/50">
                    <Icon className="w-4 h-4 mr-2" />
                    {label}
                  </Button>
                </ClickSpark>
              </Link>
            ))}
            <Link href="/department/generate" className="block">
              <ClickSpark sparkColor="#22c55e" sparkSize={12} sparkRadius={18} sparkCount={10} duration={450}>
                <Button className="w-full justify-start bg-success hover:bg-success/90 text-white">
                  <Calendar className="w-4 h-4 mr-2" />
                  Generate Timetable
                </Button>
              </ClickSpark>
            </Link>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white">Recent Runs</CardTitle>
            <CardDescription className="text-slate-300">Baseline and enhanced generations of this department</CardDescription>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <div className="text-center py-8 text-slate-300">
                <FlaskConical className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No timetables generated yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recent.map((job) => (
                  <div key={job.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-700/40 border border-slate-600">
                    <div>
                      <p className="text-white text-sm font-medium">
                        {job.run_type === "reschedule" ? "Reschedule" : job.algorithm_mode === "enhanced" ? "After enhancement" : "Before enhancement"}
                        {job.is_published && <span className="ml-2 text-xs text-emerald-400">● published</span>}
                      </p>
                      <p className="text-xs text-slate-400">
                        {job.section_ids?.length || 0} section(s) • {job.status}
                        {job.metrics?.final?.quality !== undefined && ` • Q ${Number(job.metrics.final.quality).toFixed(3)}`}
                        {" • "}{new Date(job.created_at).toLocaleString()}
                      </p>
                    </div>
                    {(job.status === "completed" || job.status === "base_complete") && (
                      <Link href={`/timetable?job=${job.id}`}>
                        <Button size="sm" variant="outline" className="border-slate-600 text-slate-200">View</Button>
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-white">Workflow</CardTitle>
          <CardDescription className="text-slate-300">From subjects to a published, clash-free timetable</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {WORKFLOW.map((step, i) => (
              <div key={step.title} className="flex gap-4">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white font-semibold ${i >= 2 ? "bg-emerald-500" : "bg-blue-500"}`}>
                  {i + 1}
                </div>
                <div>
                  <h4 className="font-semibold text-white mb-1">{step.title}</h4>
                  <p className="text-sm text-slate-300">{step.text}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
