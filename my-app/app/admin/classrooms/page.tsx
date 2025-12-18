import { getSupabaseServerClient, getCurrentAdminId } from "@/lib/server"
import { ClassroomList } from "@/components/classroom-list"
import { ClassroomDialog } from "@/components/classroom-dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Building, ArrowLeft, Info } from "lucide-react"
import Link from "next/link"
import ClickSpark from "@/components/ClickSpark"

export default async function ClassroomsPage() {
  const supabase = await getSupabaseServerClient()
  const adminId = await getCurrentAdminId()

  console.log('[Classrooms Page] Admin ID:', adminId)

  // Filter by created_by if adminId exists
  let classroomsQuery = supabase.from("classrooms").select("*").order("name")

  if (adminId) {
    classroomsQuery = classroomsQuery.eq("created_by", adminId)
  }

  const { data: classrooms, error: classroomsError } = await classroomsQuery

  console.log('[Classrooms Page] Classrooms count:', classrooms?.length)
  console.log('[Classrooms Page] Classrooms error:', classroomsError)

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
              <h1 className="text-3xl font-bold text-white mb-1">
                Classroom Management
              </h1>
              <p className="text-slate-300">Manage classrooms with capacity and type configuration</p>
            </div>
          </div>
        </div>
        <ClassroomDialog />
      </div>

      <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:border-blue-500/50">
        <CardHeader className="bg-gradient-to-r from-blue-500/10 to-transparent">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Building className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2 text-white">
                Classrooms
                <span className="text-sm font-normal text-slate-400">
                  ({classrooms?.length || 0} total)
                </span>
              </CardTitle>
              <CardDescription className="flex items-center gap-1 mt-1 text-slate-300">
                <Info className="w-3 h-3" />
                Configure classrooms with capacity and type (lab/theory)
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <ClassroomList classrooms={classrooms || []} />
        </CardContent>
      </Card>
    </div>
  )
}
