import { GenerateTimetable, type GeneratableSection } from "@/components/generate-timetable"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Play, ArrowLeft, Info, Sparkles } from "lucide-react"
import Link from "next/link"
import { getSupabaseServerClient, requireDepartmentAdmin } from "@/lib/server"

export default async function GeneratePage() {
  const supabase = await getSupabaseServerClient()
  const admin = await requireDepartmentAdmin()
  const departmentId = admin.departmentId

  const [{ data: sections }, { data: publishedJobs }] = await Promise.all([
    supabase
      .from("sections")
      .select("id, name, year_level, student_count, section_subjects(id)")
      .eq("department_id", departmentId)
      .order("year_level")
      .order("name"),
    supabase
      .from("timetable_jobs")
      .select("id, section_ids, published_at")
      .eq("department_id", departmentId)
      .eq("is_published", true),
  ])

  const publishedBySection = new Map<string, string>()
  for (const job of publishedJobs || []) {
    for (const id of job.section_ids || []) publishedBySection.set(id, job.published_at || "")
  }

  const generatable: GeneratableSection[] = (sections || []).map((s) => ({
    id: s.id,
    name: s.name,
    yearLevel: s.year_level,
    studentCount: s.student_count,
    subjectCount: (s.section_subjects as unknown[] | null)?.length || 0,
    publishedAt: publishedBySection.get(s.id) ?? null,
  }))

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3">
        <Link href="/department">
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-primary/10 transition-all duration-200 hover:scale-105"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1 flex items-center gap-2">
            Generate Timetable
            <Sparkles className="w-6 h-6 text-emerald-400 animate-pulse" />
          </h1>
          <p className="text-slate-300">
            {admin?.departmentCode ? `${admin.departmentCode}: ` : ""}choose classes, run the baseline or the enhanced ILP-GA, compare, publish
          </p>
        </div>
      </div>

      <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:border-emerald-500/50">
        <CardHeader className="bg-gradient-to-r from-emerald-500/10 to-transparent">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <Play className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-white">Timetable Generation</CardTitle>
              <CardDescription className="flex items-center gap-1 mt-1 text-slate-300">
                <Info className="w-3 h-3" />
                Faculty and rooms already booked by other departments&apos; published timetables are kept free automatically
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <GenerateTimetable sections={generatable} />
        </CardContent>
      </Card>
    </div>
  )
}
