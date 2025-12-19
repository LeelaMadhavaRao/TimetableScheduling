"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, Users, BookOpen, Building, Play, Settings, Sparkles, ArrowRight, Zap, Shield, GraduationCap, LogIn, Clock, CheckCircle2, Target, BarChart3, Database, Cpu } from "lucide-react"
import ClickSpark from "@/components/ClickSpark"
import { useAuth } from "@/contexts/AuthContext"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { RegistrationRequestDialog } from "@/components/registration-request-dialog"

export default function HomePage() {
  const { isAuthenticated, role, user, isLoading } = useAuth()
  const router = useRouter()

  // Redirect authenticated users to their respective dashboards
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      if (role === 'admin') {
        router.push('/dashboard/admin')
      } else if (role === 'timetable_admin') {
        router.push('/admin')
      } else if (role === 'faculty') {
        router.push('/faculty')
      }
    }
  }, [isAuthenticated, role, isLoading, router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-300">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse delay-700" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-500" />
      </div>

      <div className="container mx-auto px-4 py-16 relative z-10">
        {/* Hero Section */}
        <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="inline-flex items-center gap-2 bg-blue-500/20 px-4 py-2 rounded-full text-sm text-blue-300 mb-6 border border-blue-500/30 backdrop-blur-xl">
            <Sparkles className="w-4 h-4" />
            Powered by ILP & GA Algorithms
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-4 text-balance">
            Timetable Scheduling System
          </h1>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto text-pretty mb-8 leading-relaxed">
            Advanced automated timetable generation using Integer Linear Programming and Genetic Algorithm optimization. 
            Streamline your academic scheduling with intelligent automation.
          </p>
          
          {/* Login Options - Only show if not authenticated */}
          {!isAuthenticated && (
            <div className="flex flex-wrap gap-4 justify-center mb-12">
              <Link href="/login/admin">
                <ClickSpark sparkColor="#a855f7" sparkSize={14} sparkRadius={25} sparkCount={12} duration={500}>
                  <Button size="lg" className="group bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg shadow-purple-500/30">
                    <Shield className="w-4 h-4 mr-2" />
                    Admin Login
                  </Button>
                </ClickSpark>
              </Link>
              <Link href="/login/timetable-admin">
                <ClickSpark sparkColor="#3b82f6" sparkSize={14} sparkRadius={25} sparkCount={12} duration={500}>
                  <Button size="lg" className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-lg shadow-blue-500/30">
                    <Calendar className="w-4 h-4 mr-2" />
                    Timetable Admin
                  </Button>
                </ClickSpark>
              </Link>
              <Link href="/login/faculty">
                <ClickSpark sparkColor="#22c55e" sparkSize={14} sparkRadius={25} sparkCount={12} duration={500}>
                  <Button size="lg" className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-500/30">
                    <GraduationCap className="w-4 h-4 mr-2" />
                    Faculty Login
                  </Button>
                </ClickSpark>
              </Link>
            </div>
          )}

          {/* Registration Request Button - Always visible for new users */}
          <div className="mt-8 text-center">
            <p className="text-slate-300 mb-4">
              Want to manage timetables for your institution?
            </p>
            <RegistrationRequestDialog />
          </div>
        </div>

        {/* Key Features Section */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-white text-center mb-4">Key Features</h2>
          <p className="text-slate-300 text-center mb-8 max-w-2xl mx-auto">
            Our intelligent system automates the complex process of timetable generation with advanced algorithms
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-xl hover:shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/50">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center mb-2">
                  <Cpu className="w-6 h-6 text-blue-400" />
                </div>
                <CardTitle className="text-white">ILP Algorithm</CardTitle>
                <CardDescription className="text-slate-300">
                  Integer Linear Programming ensures optimal base timetable generation with constraint satisfaction
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-xl hover:shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-purple-500/50">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center mb-2">
                  <Zap className="w-6 h-6 text-purple-400" />
                </div>
                <CardTitle className="text-white">GA Optimization</CardTitle>
                <CardDescription className="text-slate-300">
                  Genetic Algorithm optimization fine-tunes schedules for quality and efficiency
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-xl hover:shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/50">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-emerald-500/20 flex items-center justify-center mb-2">
                  <Clock className="w-6 h-6 text-emerald-400" />
                </div>
                <CardTitle className="text-white">Time Efficiency</CardTitle>
                <CardDescription className="text-slate-300">
                  Generate complete timetables in minutes, not hours or days
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-xl hover:shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-cyan-500/50">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-cyan-500/20 flex items-center justify-center mb-2">
                  <CheckCircle2 className="w-6 h-6 text-cyan-400" />
                </div>
                <CardTitle className="text-white">Constraint Handling</CardTitle>
                <CardDescription className="text-slate-300">
                  Automatically handles faculty availability, classroom types, and period requirements
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-xl hover:shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-orange-500/50">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-orange-500/20 flex items-center justify-center mb-2">
                  <Database className="w-6 h-6 text-orange-400" />
                </div>
                <CardTitle className="text-white">Multi-Tenant</CardTitle>
                <CardDescription className="text-slate-300">
                  Support multiple institutions with complete data isolation and security
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-xl hover:shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-pink-500/50">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-pink-500/20 flex items-center justify-center mb-2">
                  <BarChart3 className="w-6 h-6 text-pink-400" />
                </div>
                <CardTitle className="text-white">Quality Metrics</CardTitle>
                <CardDescription className="text-slate-300">
                  Track quality scores and optimization progress with detailed analytics
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>

        {/* User Roles Section */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-white text-center mb-4">User Roles & Access</h2>
          <p className="text-slate-300 text-center mb-8 max-w-2xl mx-auto">
            Three distinct roles with tailored access levels for complete timetable management
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/30 backdrop-blur-xl hover:shadow-2xl hover:shadow-purple-500/20 transition-all duration-300 hover:-translate-y-2">
              <CardHeader>
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-3 shadow-lg shadow-purple-500/50">
                  <Shield className="w-7 h-7 text-white" />
                </div>
                <CardTitle className="text-white text-xl">System Admin</CardTitle>
                <CardDescription className="text-slate-300">
                  Create and manage Timetable Administrator accounts with full system access and control
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-slate-300 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-purple-400" />
                  <span>Create timetable admins</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-purple-400" />
                  <span>Manage institutions</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-purple-400" />
                  <span>System-wide oversight</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/30 backdrop-blur-xl hover:shadow-2xl hover:shadow-blue-500/20 transition-all duration-300 hover:-translate-y-2">
              <CardHeader>
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-3 shadow-lg shadow-blue-500/50">
                  <Calendar className="w-7 h-7 text-white" />
                </div>
                <CardTitle className="text-white text-xl">Timetable Admin</CardTitle>
                <CardDescription className="text-slate-300">
                  Manage faculty, subjects, classrooms, sections and generate optimized timetables
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-slate-300 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-blue-400" />
                  <span>Manage all resources</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-blue-400" />
                  <span>Generate timetables</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-blue-400" />
                  <span>View analytics</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500/30 backdrop-blur-xl hover:shadow-2xl hover:shadow-emerald-500/20 transition-all duration-300 hover:-translate-y-2">
              <CardHeader>
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mb-3 shadow-lg shadow-emerald-500/50">
                  <GraduationCap className="w-7 h-7 text-white" />
                </div>
                <CardTitle className="text-white text-xl">Faculty</CardTitle>
                <CardDescription className="text-slate-300">
                  View personalized teaching schedule with today's classes and weekly overview
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-slate-300 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>View personal schedule</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Today's classes</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Weekly timetable</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* How It Works Section */}
        <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-xl">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <Settings className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-white text-2xl">How It Works</CardTitle>
                <CardDescription className="text-slate-300">Simple 6-step process to generate optimal timetables</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white font-bold shadow-lg">
                  1
                </div>
                <div>
                  <h4 className="font-semibold text-white mb-1">Setup Faculty</h4>
                  <p className="text-sm text-slate-300">
                    Add faculty members with codes, departments, and define their available time slots for teaching
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white font-bold shadow-lg">
                  2
                </div>
                <div>
                  <h4 className="font-semibold text-white mb-1">Create Subjects</h4>
                  <p className="text-sm text-slate-300">
                    Define subjects with faculty mappings (e.g., JAVA - KSR) and specify periods per week
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white font-bold shadow-lg">
                  3
                </div>
                <div>
                  <h4 className="font-semibold text-white mb-1">Configure Classrooms</h4>
                  <p className="text-sm text-slate-300">
                    Add classrooms with capacity, type (lab/theory), building and floor information
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white font-bold shadow-lg">
                  4
                </div>
                <div>
                  <h4 className="font-semibold text-white mb-1">Setup Sections</h4>
                  <p className="text-sm text-slate-300">
                    Create sections with student counts, year levels and assign relevant subjects
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white font-bold shadow-lg">
                  5
                </div>
                <div>
                  <h4 className="font-semibold text-white mb-1">Generate Base Timetable</h4>
                  <p className="text-sm text-slate-300">
                    Click "Generate" to create base schedule using Integer Linear Programming algorithm
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white font-bold shadow-lg">
                  6
                </div>
                <div>
                  <h4 className="font-semibold text-white mb-1">Optimize Quality</h4>
                  <p className="text-sm text-slate-300">
                    Click "Optimize" to improve quality score using Genetic Algorithm optimization
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
