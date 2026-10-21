import { getSupabaseServerClient, getCurrentCollegeAdminId } from "@/lib/server"
import { StatsCard } from "@/components/stats-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Building, Network, CalendarCheck, UserCog } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import ClickSpark from "@/components/ClickSpark"

const WORKFLOW = [
  { title: "Add Faculty", text: "Register every faculty member of the college with their home department, phone (used for faculty login) and availability." },
  { title: "Configure Classrooms", text: "Add the shared theory rooms and labs. All departments schedule into the same rooms." },
  { title: "Create Departments", text: "Create each department and one administrator account for it." },
  { title: "Departments Generate", text: "Each department admin generates timetables for their selected sections. Published timetables block those faculty/room periods for every other department." },
]

export default async function CollegeDashboardPage() {
  const supabase = await getSupabaseServerClient()
  const collegeId = await getCurrentCollegeAdminId()
  const scope = collegeId || "00000000-0000-0000-0000-000000000000"

  const [departments, admins, faculty, classrooms, published] = await Promise.all([
    supabase.from("departments").select("*", { count: "exact", head: true }).eq("college_id", scope),
    supabase.from("department_admins").select("*", { count: "exact", head: true }).eq("college_id", scope),
    supabase.from("faculty").select("*", { count: "exact", head: true }).eq("college_id", scope),
    supabase.from("classrooms").select("*", { count: "exact", head: true }).eq("college_id", scope),
    supabase
      .from("timetable_jobs")
      .select("id, published_at, section_ids, departments(name, code)")
      .eq("college_id", scope)
      .eq("is_published", true)
      .order("published_at", { ascending: false }),
  ])

  const publishedJobs = (published.data || []) as unknown as {
    id: string
    published_at: string | null
    section_ids: string[]
    departments: { name: string; code: string } | null
  }[]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">College Dashboard</h1>
        <p className="text-slate-300">Faculty, classrooms and department accounts for your college</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Departments" value={departments.count || 0} icon={Network} description={`${admins.count || 0} with an admin account`} />
        <StatsCard title="Faculty" value={faculty.count || 0} icon={Users} description="College-wide faculty pool" />
        <StatsCard title="Classrooms" value={classrooms.count || 0} icon={Building} description="Shared theory rooms and labs" />
        <StatsCard title="Published Timetables" value={publishedJobs.length} icon={CalendarCheck} description="Committed department timetables" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white">Quick Actions</CardTitle>
            <CardDescription className="text-slate-300">College administration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { href: "/college/departments", label: "Departments & Admin Accounts", icon: UserCog, color: "#22c55e" },
              { href: "/college/faculty", label: "Manage Faculty & Availability", icon: Users, color: "#3b82f6" },
              { href: "/college/classrooms", label: "Manage Classrooms", icon: Building, color: "#f59e0b" },
              { href: "/college/timetables", label: "Published Timetables", icon: CalendarCheck, color: "#8b5cf6" },
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
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white">Committed Timetables</CardTitle>
            <CardDescription className="text-slate-300">Published by departments; their faculty and room periods are now occupied</CardDescription>
          </CardHeader>
          <CardContent>
            {publishedJobs.length === 0 ? (
              <div className="text-center py-8 text-slate-300">
                <CalendarCheck className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No department has published a timetable yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {publishedJobs.map((job) => (
                  <div key={job.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-700/40 border border-slate-600">
                    <div>
                      <p className="text-white font-medium">{job.departments?.code} - {job.departments?.name}</p>
                      <p className="text-xs text-slate-400">
                        {job.section_ids?.length || 0} section(s) • published {job.published_at ? new Date(job.published_at).toLocaleString() : ""}
                      </p>
                    </div>
                    <Link href={`/timetable?job=${job.id}`}>
                      <Button size="sm" variant="outline" className="border-slate-600 text-slate-200">View</Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-white">How your college schedules</CardTitle>
          <CardDescription className="text-slate-300">Departments share faculty and rooms without clashes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {WORKFLOW.map((step, i) => (
              <div key={step.title} className="flex gap-4">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white font-semibold ${i === WORKFLOW.length - 1 ? "bg-emerald-500" : "bg-blue-500"}`}>
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
