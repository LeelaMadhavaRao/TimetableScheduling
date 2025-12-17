import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, Users, BookOpen, Building, Play, Settings, Sparkles, ArrowRight, Zap } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-success/5 rounded-full blur-3xl animate-pulse delay-700" />
      </div>

      <div className="container mx-auto px-4 py-16 relative z-10">
        <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full text-sm text-primary mb-6">
            <Sparkles className="w-4 h-4" />
            Powered by ILP & GA Algorithms
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-4 text-balance bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text">
            Timetable Scheduling System
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-pretty mb-8">
            Advanced automated timetable generation using Integer Linear Programming and Genetic Algorithm optimization
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/admin">
              <Button size="lg" className="group">
                Get Started
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="/admin/generate">
              <Button size="lg" variant="outline" className="bg-success/10 hover:bg-success/20 text-success border-success/20">
                <Zap className="w-4 h-4 mr-2" />
                Generate Now
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors group-hover:scale-110 duration-300">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="group-hover:text-primary transition-colors">Faculty Management</CardTitle>
              <CardDescription>
                Create faculty profiles with availability timings and department assignments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/faculty">
                <Button variant="outline" className="w-full bg-transparent group-hover:bg-primary/5">
                  Manage Faculty
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors group-hover:scale-110 duration-300">
                <BookOpen className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="group-hover:text-primary transition-colors">Subject Setup</CardTitle>
              <CardDescription>Define subjects with faculty assignments and weekly period requirements</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/subjects">
                <Button variant="outline" className="w-full bg-transparent group-hover:bg-primary/5">
                  Manage Subjects
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors group-hover:scale-110 duration-300">
                <Building className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="group-hover:text-primary transition-colors">Classroom Setup</CardTitle>
              <CardDescription>Configure classrooms with capacity and type (lab/theory)</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/classrooms">
                <Button variant="outline" className="w-full bg-transparent group-hover:bg-primary/5">
                  Manage Classrooms
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-400">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors group-hover:scale-110 duration-300">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="group-hover:text-primary transition-colors">Section Setup</CardTitle>
              <CardDescription>Create sections with student count and assign subjects</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/sections">
                <Button variant="outline" className="w-full bg-transparent group-hover:bg-primary/5">
                  Manage Sections
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-success/40 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500 border-success/20">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center mb-2 group-hover:bg-success/20 transition-colors group-hover:scale-110 duration-300">
                <Play className="w-6 h-6 text-success animate-pulse" />
              </div>
              <CardTitle className="group-hover:text-success transition-colors">Generate Timetable</CardTitle>
              <CardDescription>Run ILP-based generation and GA optimization</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/generate">
                <Button className="w-full bg-success hover:bg-success/90 text-white group-hover:scale-105 transition-transform">
                  Generate Now
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-600">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors group-hover:scale-110 duration-300">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="group-hover:text-primary transition-colors">View Timetable</CardTitle>
              <CardDescription>Browse generated timetables by section or faculty</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/timetable">
                <Button variant="outline" className="w-full bg-transparent group-hover:bg-primary/5">
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
