import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, Users, BookOpen, Building, Play, Settings } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-foreground mb-4 text-balance">Timetable Scheduling System</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-pretty">
            Advanced automated timetable generation using Integer Linear Programming and Genetic Algorithm optimization
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Faculty Management</CardTitle>
              <CardDescription>
                Create faculty profiles with availability timings and department assignments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/faculty">
                <Button variant="outline" className="w-full bg-transparent">
                  Manage Faculty
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                <BookOpen className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Subject Setup</CardTitle>
              <CardDescription>Define subjects with faculty assignments and weekly period requirements</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/subjects">
                <Button variant="outline" className="w-full bg-transparent">
                  Manage Subjects
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                <Building className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Classroom Setup</CardTitle>
              <CardDescription>Configure classrooms with capacity and type (lab/theory)</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/classrooms">
                <Button variant="outline" className="w-full bg-transparent">
                  Manage Classrooms
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Section Setup</CardTitle>
              <CardDescription>Create sections with student count and assign subjects</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/sections">
                <Button variant="outline" className="w-full bg-transparent">
                  Manage Sections
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center mb-2">
                <Play className="w-6 h-6 text-success" />
              </div>
              <CardTitle>Generate Timetable</CardTitle>
              <CardDescription>Run ILP-based generation and GA optimization</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/generate">
                <Button className="w-full bg-success hover:bg-success/90 text-white">Generate Now</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>View Timetable</CardTitle>
              <CardDescription>Browse generated timetables by section or faculty</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/timetable">
                <Button variant="outline" className="w-full bg-transparent">
                  View Timetable
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              How It Works
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-muted-foreground">
              <li className="flex gap-3">
                <span className="font-semibold text-foreground min-w-6">1.</span>
                <span>Set up faculty profiles with their available time slots</span>
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-foreground min-w-6">2.</span>
                <span>Create subjects and link them to faculty (e.g., JAVA - KSR)</span>
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-foreground min-w-6">3.</span>
                <span>Configure classrooms with capacity and type</span>
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-foreground min-w-6">4.</span>
                <span>Create sections and assign subjects to them</span>
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-foreground min-w-6">5.</span>
                <span>Click "Generate Timetable" to create base schedule using ILP</span>
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-foreground min-w-6">6.</span>
                <span>Click "Optimize" to improve quality using Genetic Algorithm</span>
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
