import { getSupabaseServerClient } from "@/lib/server"
import { FacultyList } from "@/components/faculty-list"
import { FacultyDialog } from "@/components/faculty-dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Users, ArrowLeft, Info } from "lucide-react"
import Link from "next/link"
import ClickSpark from "@/components/ClickSpark"

export default async function FacultyPage() {
  const supabase = await getSupabaseServerClient()

  const { data: faculty, error } = await supabase.from("faculty").select("*, departments(name, code)").order("name")

  const { data: departments } = await supabase.from("departments").select("*").order("name")

  if (error) {
    console.error("[v0] Error fetching faculty:", error)
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <ClickSpark sparkColor="#6366f1" sparkSize={10} sparkRadius={15} sparkCount={8} duration={400}>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="hover:bg-primary/10 transition-all duration-200 hover:scale-105"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </ClickSpark>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-1 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                Faculty Management
              </h1>
              <p className="text-muted-foreground">Manage faculty profiles and availability schedules</p>
            </div>
          </div>
        </div>
        <FacultyDialog departments={departments || []} />
      </div>

      <Card className="border-primary/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:border-primary/40">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                Faculty Members
                <span className="text-sm font-normal text-muted-foreground">
                  ({faculty?.length || 0} total)
                </span>
              </CardTitle>
              <CardDescription className="flex items-center gap-1 mt-1">
                <Info className="w-3 h-3" />
                Add faculty with codes, departments, and time slot availability
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <FacultyList faculty={faculty || []} departments={departments || []} />
        </CardContent>
      </Card>
    </div>
  )
}
