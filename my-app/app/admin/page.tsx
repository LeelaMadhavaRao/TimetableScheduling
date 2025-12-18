import { getSupabaseServerClient } from "@/lib/server"
import { StatsCard } from "@/components/stats-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, BookOpen, Building, Layers, Calendar, TrendingUp } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import ClickSpark from "@/components/ClickSpark"

export default async function AdminDashboardPage() {
  const supabase = await getSupabaseServerClient()

  // Fetch statistics
  const [facultyCount, subjectsCount, classroomsCount, sectionsCount, jobsCount] = await Promise.all([
    supabase.from("faculty").select("*", { count: "exact", head: true }),
    supabase.from("subjects").select("*", { count: "exact", head: true }),
    supabase.from("classrooms").select("*", { count: "exact", head: true }),
    supabase.from("sections").select("*", { count: "exact", head: true }),
    supabase.from("timetable_jobs").select("*", { count: "exact", head: true }),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
        <p className="text-slate-300">Manage your timetable scheduling system</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Faculty"
          value={facultyCount.count || 0}
          icon={Users}
          description="Registered faculty members"
        />
        <StatsCard
          title="Total Subjects"
          value={subjectsCount.count || 0}
          icon={BookOpen}
          description="Theory and lab subjects"
        />
        <StatsCard
          title="Total Classrooms"
          value={classroomsCount.count || 0}
          icon={Building}
          description="Available rooms"
        />
        <StatsCard
          title="Total Sections"
          value={sectionsCount.count || 0}
          icon={Layers}
          description="Active sections"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white">Quick Actions</CardTitle>
            <CardDescription className="text-slate-300">Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/admin/faculty" className="block">
              <ClickSpark sparkColor="#3b82f6" sparkSize={10} sparkRadius={15} sparkCount={8} duration={400}>
                <Button variant="outline" className="w-full justify-start bg-slate-700/50 border-slate-600 text-white hover:bg-slate-700 hover:border-blue-500/50">
                  <Users className="w-4 h-4 mr-2" />
                  Manage Faculty
                </Button>
              </ClickSpark>
            </Link>
            <Link href="/admin/subjects" className="block">
              <ClickSpark sparkColor="#8b5cf6" sparkSize={10} sparkRadius={15} sparkCount={8} duration={400}>
                <Button variant="outline" className="w-full justify-start bg-slate-700/50 border-slate-600 text-white hover:bg-slate-700 hover:border-blue-500/50">
                  <BookOpen className="w-4 h-4 mr-2" />
                  Manage Subjects
                </Button>
              </ClickSpark>
            </Link>
            <Link href="/admin/classrooms" className="block">
              <ClickSpark sparkColor="#f59e0b" sparkSize={10} sparkRadius={15} sparkCount={8} duration={400}>
                <Button variant="outline" className="w-full justify-start bg-slate-700/50 border-slate-600 text-white hover:bg-slate-700 hover:border-blue-500/50">
                  <Building className="w-4 h-4 mr-2" />
                  Manage Classrooms
                </Button>
              </ClickSpark>
            </Link>
            <Link href="/admin/sections" className="block">
              <ClickSpark sparkColor="#ec4899" sparkSize={10} sparkRadius={15} sparkCount={8} duration={400}>
                <Button variant="outline" className="w-full justify-start bg-slate-700/50 border-slate-600 text-white hover:bg-slate-700 hover:border-blue-500/50">
                  <Layers className="w-4 h-4 mr-2" />
                  Manage Sections
                </Button>
              </ClickSpark>
            </Link>
            <Link href="/admin/generate" className="block">
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
            <CardTitle className="text-white">Recent Activity</CardTitle>
            <CardDescription className="text-slate-300">Timetable generation history</CardDescription>
          </CardHeader>
          <CardContent>
            {jobsCount.count === 0 ? (
              <div className="text-center py-8 text-slate-300">
                <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No timetables generated yet</p>
                <Link href="/admin/generate">
                  <Button className="mt-4 bg-success hover:bg-success/90 text-white" size="sm">
                    Generate First Timetable
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-slate-300">
                <TrendingUp className="w-4 h-4" />
                <span>{jobsCount.count} timetable generation jobs</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-white">System Workflow</CardTitle>
          <CardDescription className="text-slate-300">Follow these steps to generate your timetable</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white font-semibold">
                1
              </div>
              <div>
                <h4 className="font-semibold text-white mb-1">Setup Faculty</h4>
                <p className="text-sm text-slate-300">
                  Add faculty members with their codes, departments, and available time slots
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white font-semibold">
                2
              </div>
              <div>
                <h4 className="font-semibold text-white mb-1">Create Subjects</h4>
                <p className="text-sm text-slate-300">
                  Define subjects with faculty mappings (e.g., JAVA - KSR) and periods per week
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white font-semibold">
                3
              </div>
              <div>
                <h4 className="font-semibold text-white mb-1">Configure Classrooms</h4>
                <p className="text-sm text-slate-300">Add classrooms with capacity and type (lab/theory)</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white font-semibold">
                4
              </div>
              <div>
                <h4 className="font-semibold text-white mb-1">Setup Sections</h4>
                <p className="text-sm text-slate-300">Create sections with student counts and assign subjects</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white font-semibold">
                5
              </div>
              <div>
                <h4 className="font-semibold text-white mb-1">Generate & Optimize</h4>
                <p className="text-sm text-slate-300">
                  Run ILP-based generation for base timetable, then optimize using Genetic Algorithm
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
