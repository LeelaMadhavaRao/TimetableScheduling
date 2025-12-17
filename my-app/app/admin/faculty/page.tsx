import { getSupabaseServerClient } from "@/lib/server"
import { FacultyList } from "@/components/faculty-list"
import { FacultyDialog } from "@/components/faculty-dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users } from "lucide-react"

export default async function FacultyPage() {
  const supabase = await getSupabaseServerClient()

  const { data: faculty, error } = await supabase.from("faculty").select("*, departments(name, code)").order("name")

  const { data: departments } = await supabase.from("departments").select("*").order("name")

  if (error) {
    console.error("[v0] Error fetching faculty:", error)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Faculty Management</h1>
          <p className="text-muted-foreground">Manage faculty profiles and availability</p>
        </div>
        <FacultyDialog departments={departments || []} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <CardTitle>Faculty Members</CardTitle>
          </div>
          <CardDescription>Add faculty with their codes, departments, and available time slots</CardDescription>
        </CardHeader>
        <CardContent>
          <FacultyList faculty={faculty || []} departments={departments || []} />
        </CardContent>
      </Card>
    </div>
  )
}
