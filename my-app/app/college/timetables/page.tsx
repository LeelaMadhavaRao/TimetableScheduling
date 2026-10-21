import { getSupabaseServerClient, requireCollegeAdminId } from "@/lib/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CalendarCheck, ArrowLeft, Eye } from "lucide-react"
import Link from "next/link"

export default async function CollegeTimetablesPage() {
  const supabase = await getSupabaseServerClient()
  const collegeId = await requireCollegeAdminId()

  const [{ data: departments }, { data: sections }, { data: jobs }] = await Promise.all([
    supabase.from("departments").select("id, name, code").eq("college_id", collegeId).order("code"),
    supabase.from("sections").select("id, name, department_id").eq("college_id", collegeId).order("name"),
    supabase
      .from("timetable_jobs")
      .select("id, department_id, section_ids, algorithm_mode, run_type, published_at, metrics")
      .eq("college_id", collegeId)
      .eq("is_published", true),
  ])

  const publishedSection = new Map<string, { jobId: string; mode: string }>()
  for (const job of jobs || []) {
    for (const id of job.section_ids || []) publishedSection.set(id, { jobId: job.id, mode: job.run_type === "reschedule" ? "rescheduled" : job.algorithm_mode })
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/college">
            <Button variant="ghost" size="icon" className="hover:bg-primary/10">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Published Timetables</h1>
            <p className="text-slate-300">Committed timetables of every department; together they define each faculty member&apos;s week</p>
          </div>
        </div>
        <Link href="/timetable">
          <Button className="bg-gradient-to-r from-blue-600 to-cyan-600">
            <Eye className="w-4 h-4 mr-2" />
            College-wide view
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {(departments || []).map((dept) => {
          const deptSections = (sections || []).filter((s) => s.department_id === dept.id)
          const deptJobs = (jobs || []).filter((j) => j.department_id === dept.id)
          const covered = deptSections.filter((s) => publishedSection.has(s.id)).length
          return (
            <Card key={dept.id} className="bg-slate-800/50 border-slate-700 backdrop-blur-xl">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CalendarCheck className="w-5 h-5 text-emerald-400" />
                  <CardTitle className="text-white">{dept.code} - {dept.name}</CardTitle>
                </div>
                <CardDescription className="text-slate-300">
                  {covered}/{deptSections.length} sections published • {deptJobs.length} committed run(s)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {deptSections.length === 0 && <span className="text-sm text-slate-500">No sections</span>}
                  {deptSections.map((s) => {
                    const p = publishedSection.get(s.id)
                    return (
                      <Badge key={s.id} variant="outline" className={p ? "border-emerald-500/50 text-emerald-300" : "border-slate-600 text-slate-400"}>
                        {s.name}{p ? ` · ${p.mode}` : " · not published"}
                      </Badge>
                    )
                  })}
                </div>
                {deptJobs.map((job) => (
                  <div key={job.id} className="flex items-center justify-between p-2 rounded bg-slate-700/40 border border-slate-600">
                    <span className="text-xs text-slate-300">
                      {job.section_ids?.length} section(s) • published {job.published_at ? new Date(job.published_at).toLocaleString() : ""}
                      {job.metrics?.final?.quality !== undefined && ` • Q ${Number(job.metrics.final.quality).toFixed(3)}`}
                    </span>
                    <Link href={`/timetable?job=${job.id}`}>
                      <Button size="sm" variant="outline" className="border-slate-600 text-slate-200">View</Button>
                    </Link>
                  </div>
                ))}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
