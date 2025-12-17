import { getSupabaseServerClient } from "@/lib/server"
import { SectionList } from "@/components/section-list"
import { SectionDialog } from "@/components/section-dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Layers } from "lucide-react"

export default async function SectionsPage() {
  const supabase = await getSupabaseServerClient()

  const { data: sections } = await supabase
    .from("sections")
    .select("*, departments(name, code), section_subjects(*, subjects(*, subject_faculty(faculty(*))))")
    .order("year_level")
    .order("name")

  const { data: departments } = await supabase.from("departments").select("*").order("name")

  const { data: subjects } = await supabase.from("subjects").select("*, subject_faculty(faculty(*))").order("name")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Section Management</h1>
          <p className="text-muted-foreground">Manage sections with subjects</p>
        </div>
        <SectionDialog departments={departments || []} subjects={subjects || []} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            <CardTitle>Sections</CardTitle>
          </div>
          <CardDescription>Create sections with student count and assign subjects</CardDescription>
        </CardHeader>
        <CardContent>
          <SectionList sections={sections || []} departments={departments || []} subjects={subjects || []} />
        </CardContent>
      </Card>
    </div>
  )
}
