import { GenerateTimetable } from "@/components/generate-timetable"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Play } from "lucide-react"

export default function GeneratePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Generate Timetable</h1>
        <p className="text-muted-foreground">Create and optimize timetables using ILP and GA algorithms</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Play className="w-5 h-5 text-success" />
            <CardTitle>Timetable Generation</CardTitle>
          </div>
          <CardDescription>
            Generate base timetable using Integer Linear Programming, then optimize with Genetic Algorithm
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GenerateTimetable />
        </CardContent>
      </Card>
    </div>
  )
}
