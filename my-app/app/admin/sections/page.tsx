import { getSupabaseServerClient } from "@/lib/server"
import { SectionList } from "@/components/section-list"
import { SectionDialog } from "@/components/section-dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Layers, ArrowLeft, Info } from "lucide-react"
import Link from "next/link"
import ClickSpark from "@/components/ClickSpark"

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
                Section Management
              </h1>
              <p className="text-slate-300">Manage sections with student counts and subject assignments</p>
            </div>
          </div>
        </div>
        <SectionDialog departments={departments || []} subjects={subjects || []} />
      </div>

      <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:border-blue-500/50">
        <CardHeader className="bg-gradient-to-r from-blue-500/10 to-transparent">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Layers className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2 text-white">
                Sections
                <span className="text-sm font-normal text-slate-400">
                  ({sections?.length || 0} total)
                </span>
              </CardTitle>
              <CardDescription className="flex items-center gap-1 mt-1 text-slate-300">
                <Info className="w-3 h-3" />
                Create sections with student count and assign subjects
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <SectionList sections={sections || []} departments={departments || []} subjects={subjects || []} />
        </CardContent>
      </Card>
    </div>
  )
}
