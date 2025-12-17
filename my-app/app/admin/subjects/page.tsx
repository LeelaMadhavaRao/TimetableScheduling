import { getSupabaseServerClient } from "@/lib/server"
import { SubjectList } from "@/components/subject-list"
import { SubjectDialog } from "@/components/subject-dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BookOpen } from "lucide-react"

export default async function SubjectsPage() {
  const supabase = await getSupabaseServerClient()

  const { data: subjects } = await supabase
    .from("subjects")
    .select("*, departments(name, code), subject_faculty(faculty(id, code, name))")
    .order("name")

  const { data: departments } = await supabase.from("departments").select("*").order("name")

  const { data: faculty } = await supabase.from("faculty").select("*").order("name")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Subject Management</h1>
          <p className="text-muted-foreground">Manage subjects with faculty assignments</p>
        </div>
        <SubjectDialog departments={departments || []} faculty={faculty || []} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <CardTitle>Subjects</CardTitle>
          </div>
          <CardDescription>
            Define subjects with faculty mappings (e.g., JAVA - KSR) and periods per week
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SubjectList subjects={subjects || []} departments={departments || []} faculty={faculty || []} />
        </CardContent>
      </Card>
    </div>
  )
}
