import { getSupabaseServerClient } from "@/lib/server"
import { SubjectList } from "@/components/subject-list"
import { SubjectDialog } from "@/components/subject-dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BookOpen, ArrowLeft, Info } from "lucide-react"
import Link from "next/link"

export default async function SubjectsPage() {
  const supabase = await getSupabaseServerClient()

  const { data: subjects } = await supabase
    .from("subjects")
    .select("*, departments(name, code), subject_faculty(faculty(id, code, name))")
    .order("name")

  const { data: departments } = await supabase.from("departments").select("*").order("name")

  const { data: faculty } = await supabase.from("faculty").select("*").order("name")

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <Button 
                variant="ghost" 
                size="icon" 
                className="hover:bg-primary/10 transition-all duration-200 hover:scale-105"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-1 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                Subject Management
              </h1>
              <p className="text-muted-foreground">Manage subjects with faculty assignments and weekly periods</p>
            </div>
          </div>
        </div>
        <SubjectDialog departments={departments || []} faculty={faculty || []} />
      </div>

      <Card className="border-primary/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:border-primary/40">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                Subjects
                <span className="text-sm font-normal text-muted-foreground">
                  ({subjects?.length || 0} total)
                </span>
              </CardTitle>
              <CardDescription className="flex items-center gap-1 mt-1">
                <Info className="w-3 h-3" />
                Define subjects with faculty mappings (e.g., JAVA - KSR) and periods per week
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <SubjectList subjects={subjects || []} departments={departments || []} faculty={faculty || []} />
        </CardContent>
      </Card>
    </div>
  )
}
