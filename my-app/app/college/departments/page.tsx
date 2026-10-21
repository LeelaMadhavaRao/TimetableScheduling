import { getSupabaseServerClient, getCurrentCollegeAdminId } from "@/lib/server"
import { DepartmentManager, type DepartmentRow } from "@/components/department-manager"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Network, ArrowLeft, Info } from "lucide-react"
import Link from "next/link"

export default async function DepartmentsPage() {
  const supabase = await getSupabaseServerClient()
  const collegeId = (await getCurrentCollegeAdminId()) || "00000000-0000-0000-0000-000000000000"

  const [{ data: departments }, { data: admins }, { data: faculty }, { data: sections }] = await Promise.all([
    supabase.from("departments").select("id, name, code").eq("college_id", collegeId).order("code"),
    supabase.from("department_admins").select("id, username, name, email, phone, is_active, last_login, department_id").eq("college_id", collegeId),
    supabase.from("faculty").select("department_id").eq("college_id", collegeId),
    supabase.from("sections").select("department_id").eq("college_id", collegeId),
  ])

  const count = (rows: { department_id: string | null }[] | null, id: string) => (rows || []).filter((r) => r.department_id === id).length

  const rows: DepartmentRow[] = (departments || []).map((d) => {
    const admin = (admins || []).find((a) => a.department_id === d.id)
    return {
      ...d,
      facultyCount: count(faculty, d.id),
      sectionCount: count(sections, d.id),
      admin: admin
        ? { id: admin.id, username: admin.username, name: admin.name, email: admin.email, phone: admin.phone, is_active: admin.is_active, last_login: admin.last_login }
        : null,
    }
  })

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3">
        <Link href="/college">
          <Button variant="ghost" size="icon" className="hover:bg-primary/10 transition-all duration-200 hover:scale-105">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Departments</h1>
          <p className="text-slate-300">Create departments and one administrator account for each</p>
        </div>
      </div>

      <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-xl shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-500/10 to-transparent">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Network className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-white">
                Departments <span className="text-sm font-normal text-slate-400">({rows.length} total)</span>
              </CardTitle>
              <CardDescription className="flex items-center gap-1 mt-1 text-slate-300">
                <Info className="w-3 h-3" />
                Department administrators manage their own subjects and sections and generate timetables for their classes
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <DepartmentManager collegeId={collegeId} departments={rows} />
        </CardContent>
      </Card>
    </div>
  )
}
