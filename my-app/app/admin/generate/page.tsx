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
          <h1 className="text-3xl font-bold text-foreground mb-1 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text flex items-center gap-2">
            Generate Timetable
            <Sparkles className="w-6 h-6 text-success animate-pulse" />
          </h1>
          <p className="text-muted-foreground">Create and optimize timetables using ILP and GA algorithms</p>
        </div>
      </div>

      <Card className="border-success/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:border-success/40">
        <CardHeader className="bg-gradient-to-r from-success/5 to-transparent">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-success/10">
              <Play className="w-5 h-5 text-success" />
            </div>
            <div className="flex-1">
              <CardTitle>Timetable Generation</CardTitle>
              <CardDescription className="flex items-center gap-1 mt-1">
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
