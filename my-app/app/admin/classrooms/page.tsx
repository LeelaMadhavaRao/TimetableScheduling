import { getSupabaseServerClient } from "@/lib/server"
import { ClassroomList } from "@/components/classroom-list"
import { ClassroomDialog } from "@/components/classroom-dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Building } from "lucide-react"

export default async function ClassroomsPage() {
  const supabase = await getSupabaseServerClient()

  const { data: classrooms } = await supabase.from("classrooms").select("*").order("name")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Classroom Management</h1>
          <p className="text-muted-foreground">Manage classrooms with capacity and type</p>
        </div>
        <ClassroomDialog />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-primary" />
            <CardTitle>Classrooms</CardTitle>
          </div>
          <CardDescription>Configure classrooms with capacity and type (lab/theory)</CardDescription>
        </CardHeader>
        <CardContent>
          <ClassroomList classrooms={classrooms || []} />
        </CardContent>
      </Card>
    </div>
  )
}
