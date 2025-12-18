import { GenerateTimetable } from "@/components/generate-timetable"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Play, ArrowLeft, Info, Sparkles } from "lucide-react"
import Link from "next/link"

export default function GeneratePage() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
          <h1 className="text-3xl font-bold text-white mb-1 flex items-center gap-2">
            Generate Timetable
            <Sparkles className="w-6 h-6 text-emerald-400 animate-pulse" />
          </h1>
          <p className="text-slate-300">Create and optimize timetables using ILP and GA algorithms</p>
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
                Generate base timetable using Integer Linear Programming, then optimize with Genetic Algorithm
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <GenerateTimetable />
        </CardContent>
      </Card>
    </div>
  )
}
