"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Play, Zap, CheckCircle, AlertCircle, Loader2, Eye, Download } from "lucide-react"
import { getSupabaseBrowserClient } from "@/lib/client"
import type { TimetableJob } from "@/lib/database"
import { generateTimetablePDF } from "@/lib/pdf-generator"
import type { REALTIME_SUBSCRIBE_STATES } from "@supabase/supabase-js"
import ClickSpark from "@/components/ClickSpark"
import { useAuth } from "@/contexts/AuthContext"

interface ErrorDetail {
  section: string
  subject: string
  faculty?: string
  type: string
  expected: number | string
  scheduled: number
  reason: string
}

interface ReducedCourse {
  courseId: string
  originalPeriods: number
  newPeriods: number
}

interface Diagnostics {
  summary: {
    labRooms: number
    theoryRooms: number
    labBlocksNeeded: number
    labBlocksAvailable: number
    labUtilization: string
    theoryPeriodsNeeded: number
    theoryPeriodsAvailable: number
    theoryUtilization: string
  }
  issues: {
    labFailures: number
    theoryFailures: number
    facultyWithLimitedAvailability: number
  }
  reducedCourses?: ReducedCourse[]
  suggestions: string[]
}

export function GenerateTimetable() {
  const router = useRouter()
  const { user, role } = useAuth()
  const [currentJob, setCurrentJob] = useState<TimetableJob | null>(null)
  const [generating, setGenerating] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [errorDetails, setErrorDetails] = useState<ErrorDetail[]>([])
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null)
  const [showErrorDialog, setShowErrorDialog] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  
  // Get admin ID if user is a timetable administrator
  const adminId = role === 'timetable_admin' && user ? (user as { id: string }).id : null

  useEffect(() => {
    // Subscribe to job updates
    const supabase = getSupabaseBrowserClient()

    const channel = supabase
      .channel("timetable_jobs_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "timetable_jobs" },
        (payload: { new: TimetableJob | null; old: TimetableJob | null; eventType: string }) => {
          console.log("[GenerateTimetable] Real-time job update:", payload.new?.status, payload)
          if (payload.new) {
            const newStatus = payload.new.status
            console.log("[GenerateTimetable] Real-time update - Status:", newStatus, "Progress:", payload.new.progress)
            
            setCurrentJob(payload.new)
            setLastUpdated(new Date())
            
            // Update generating state based on job status
            const isComplete = newStatus === "completed" || newStatus === "failed" || newStatus === "base_complete"
            const isGenerating = newStatus === "generating_base" || newStatus === "optimizing"
            
            console.log("[GenerateTimetable] Real-time status check - isComplete:", isComplete, "isGenerating:", isGenerating)
            
            if (isComplete) {
              console.log("[GenerateTimetable] ✅ Real-time: Job complete, stopping loader")
              setGenerating(false)
            } else if (isGenerating) {
              console.log("[GenerateTimetable] 🔄 Real-time: Job generating, showing loader")
              setGenerating(true)
            }
          }
        },
      )
      .subscribe((status: `${REALTIME_SUBSCRIBE_STATES}`) => {
        console.log("[GenerateTimetable] Subscription status:", status)
      })

    // Fetch latest job on mount
    fetchLatestJob()

    return () => {
      console.log("[GenerateTimetable] Cleaning up subscription")
      supabase.removeChannel(channel)
    }
  }, [])

  // Aggressive polling when generating for immediate feedback
  useEffect(() => {
    if (!generating) return

    // More frequent polling for better UX
    const interval = setInterval(() => {
      console.log("[GenerateTimetable] Polling for job updates...")
      fetchLatestJob()
    }, 1000) // Poll every 1 second for faster updates

    return () => clearInterval(interval)
  }, [generating])

  const fetchLatestJob = async () => {
    try {
      const supabase = getSupabaseBrowserClient()
      
      console.log("[GenerateTimetable] fetchLatestJob called")
      
      // Get the most recent job (no admin filter for now since edge function doesn't set created_by)
      const { data, error } = await supabase
        .from("timetable_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error("[GenerateTimetable] ❌ Error fetching job:", error)
        setIsLoading(false)
        return
      }

      if (!data) {
        console.log("[GenerateTimetable] ⚠️ No job data returned from query")
        setIsLoading(false)
        return
      }

      console.log("[GenerateTimetable] ✅ Fetched job:", {
        id: data.id,
        status: data.status,
        progress: data.progress,
        message: data.message,
        currentGeneratingState: generating
      })
      
      setCurrentJob(data)
      setLastUpdated(new Date())
      
      // Update generating state based on job status
      const isComplete = data.status === "completed" || data.status === "failed" || data.status === "base_complete"
      const isGenerating = data.status === "generating_base" || data.status === "optimizing"
      
      console.log("[GenerateTimetable] Status check - isComplete:", isComplete, "isGenerating:", isGenerating, "status:", data.status)
      
      if (isComplete) {
        console.log("[GenerateTimetable] 🎉 Job complete, stopping loader")
        setGenerating(false)
      } else if (isGenerating) {
        console.log("[GenerateTimetable] 🔄 Job generating, keeping loader active")
        setGenerating(true)
      } else {
        console.log("[GenerateTimetable] ⚠️ Unknown status, stopping loader to be safe")
        setGenerating(false)
      }
    } catch (err) {
      console.error("[GenerateTimetable] 💥 Exception fetching job:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGenerateBase = async () => {
    console.log("[GenerateTimetable] Starting base timetable generation...")
    setGenerating(true)
    setShowErrorDialog(false)  // Clear previous errors
    setDiagnostics(null)  // Clear previous diagnostics
    setCurrentJob(null)  // Clear old job data to show fresh state

    try {
      const supabase = getSupabaseBrowserClient()
      
      // Step 1: Delete old timetable jobs for this administrator
      if (adminId) {
        console.log("[GenerateTimetable] Deleting old timetable jobs for admin:", adminId)
        const { error: deleteError } = await supabase
          .from('timetable_jobs')
          .delete()
          .eq('created_by', adminId)
        
        if (deleteError) {
          console.error("[GenerateTimetable] Error deleting old jobs:", deleteError)
          // Continue anyway - not critical if this fails
        } else {
          console.log("[GenerateTimetable] ✅ Old timetable jobs deleted successfully")
        }
      }
      
      // Step 2: Call Supabase Edge Function
      console.log("[GenerateTimetable] Calling Edge Function...", adminId ? `with admin ID: ${adminId}` : 'without admin ID')
      const { data, error } = await supabase.functions.invoke("generate-base-timetable", {
        method: "POST",
        body: adminId ? { adminId } : undefined,
      })

      if (error) {
        console.error("[GenerateTimetable] Function error:", error)
        setErrorDetails([{
          section: "System",
          subject: "Error",
          type: "system",
          expected: "N/A",
          scheduled: 0,
          reason: error.message || "Unknown error occurred"
        }])
        setShowErrorDialog(true)
        setGenerating(false)
        return
      }

      console.log("[GenerateTimetable] Edge Function response:", data)
      
      // Handle conflicts detected
      if (!data?.success && data?.error === "CONFLICTS_DETECTED" && data?.conflicts) {
        setErrorDetails(data.conflicts.map((c: string) => ({
          section: "Conflict",
          subject: "Validation",
          type: "conflict",
          expected: "No conflicts",
          scheduled: 0,
          reason: c
        })))
        setShowErrorDialog(true)
        setGenerating(false)
        // Fetch updated job to show failed status in UI
        setTimeout(() => fetchLatestJob(), 500)
        return
      }
      
      // Handle incomplete schedule errors
      if (!data?.success && data?.error === "INCOMPLETE_SCHEDULE" && data?.details) {
        setErrorDetails(data.details)
        if (data.diagnostics) {
          setDiagnostics(data.diagnostics)
        }
        setShowErrorDialog(true)
        setGenerating(false)
        // Fetch updated job to show failed status in UI
        setTimeout(() => fetchLatestJob(), 500)
        return
      }
      
      // Start polling immediately after successful start
      if (data?.success && data?.jobId) {
        console.log("[GenerateTimetable] ✅ Job started with ID:", data.jobId)
        
        // If fallback was applied, store the info for display
        if (data.reducedCoursesInfo) {
          console.log("[GenerateTimetable] 🔄 Fallback applied:", data.reducedCoursesInfo)
          setDiagnostics({
            summary: {
              labRooms: 0, theoryRooms: 0,
              labBlocksNeeded: 0, labBlocksAvailable: 0, labUtilization: "N/A",
              theoryPeriodsNeeded: 0, theoryPeriodsAvailable: 0, theoryUtilization: "N/A",
            },
            issues: { labFailures: 0, theoryFailures: 0, facultyWithLimitedAvailability: 0 },
            reducedCourses: data.reducedCoursesInfo.reducedCourses,
            suggestions: [data.reducedCoursesInfo.fallbackMessage]
          })
        }
        
        // Wait for job to be inserted and edge function to update it
        setTimeout(() => {
          console.log("[GenerateTimetable] Fetching new job after 1.5s delay...")
          fetchLatestJob()
        }, 1500)
      } else {
        console.error("[GenerateTimetable] ❌ Edge function did not return success/jobId:", data)
        setGenerating(false)
      }
    } catch (error) {
      console.error("[GenerateTimetable] Exception:", error)
      setErrorDetails([{
        section: "System",
        subject: "Error",
        type: "system",
        expected: "N/A",
        scheduled: 0,
        reason: error instanceof Error ? error.message : "Unknown error generating timetable"
      }])
      setShowErrorDialog(true)
      setGenerating(false)
    }
  }

  const handleOptimize = async () => {
    if (!currentJob || currentJob.status !== "base_complete") {
      alert("Please generate base timetable first")
      return
    }

    console.log("[GenerateTimetable] Starting optimization...")
    setGenerating(true)

    try {
      const supabase = getSupabaseBrowserClient()
      
      console.log("[GenerateTimetable] Calling optimize Edge Function...", adminId ? `with admin ID: ${adminId}` : 'without admin ID')
      const { data, error } = await supabase.functions.invoke("optimize-timetable", {
        method: "POST",
        body: { jobId: currentJob.id, adminId },
      })

      if (error) {
        console.error("[GenerateTimetable] Optimization error:", error)
        alert("Error: " + error.message)
        setGenerating(false)
        return
      }

      console.log("[GenerateTimetable] Optimization response:", data)
      
      // Start polling immediately
      if (data?.success) {
        setTimeout(() => {
          console.log("[GenerateTimetable] Fetching optimized job...")
          fetchLatestJob()
        }, 500)
      }
    } catch (error) {
      console.error("[GenerateTimetable] Exception:", error)
      alert("Error optimizing timetable")
      setGenerating(false)
    }
  }

  const handleViewTimetable = () => {
    // Force a fresh navigation with cache bust
    router.push("/timetable?t=" + Date.now())
  }

  const handleDownloadPDF = async () => {
    if (!currentJob) return

    try {
      setGenerating(true)
      const supabase = getSupabaseBrowserClient()

      const isOptimized = currentJob.status === "completed"
      const tableName = isOptimized ? "timetable_optimized" : "timetable_base"

      const { data: timetableSlots, error } = await supabase
        .from(tableName)
        .select(
          "*, sections(name, year_level), subjects(name, code, subject_type), faculty(name, code), classrooms(name)",
        )
        .eq("job_id", currentJob.id)

      if (error) {
        console.error("Error fetching timetable:", error)
        alert("Error fetching timetable data")
        setGenerating(false)
        return
      }

      if (!timetableSlots || timetableSlots.length === 0) {
        alert("No timetable data found")
        setGenerating(false)
        return
      }

      const fileName = await generateTimetablePDF(timetableSlots, currentJob.id, isOptimized)
      console.log("PDF generated:", fileName)

      setGenerating(false)
    } catch (error) {
      console.error("Error generating PDF:", error)
      alert("Error generating PDF")
      setGenerating(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline">Pending</Badge>
      case "generating_base":
        return (
          <Badge className="bg-primary text-primary-foreground">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Generating Base
          </Badge>
        )
      case "base_complete":
        return (
          <Badge className="bg-success text-white">
            <CheckCircle className="w-3 h-3 mr-1" />
            Base Complete
          </Badge>
        )
      case "optimizing":
        return (
          <Badge className="bg-primary text-primary-foreground">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Optimizing
          </Badge>
        )
      case "completed":
        return (
          <Badge className="bg-success text-white">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        )
      case "failed":
        return (
          <Badge variant="destructive">
            <AlertCircle className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-100">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading timetable status...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Full-screen loading overlay during generation */}
      {generating && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <Card className="p-8 bg-slate-900/95 border-slate-700 max-w-md mx-4 shadow-2xl">
            <div className="flex flex-col items-center gap-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  {currentJob?.status === "optimizing" ? (
                    <Zap className="w-8 h-8 text-primary animate-pulse" />
                  ) : (
                    <Play className="w-8 h-8 text-success animate-pulse" />
                  )}
                </div>
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-white">
                  {currentJob?.status === "optimizing" 
                    ? "Optimizing Timetable..." 
                    : "Generating Base Timetable..."}
                </h3>
                <p className="text-slate-300">
                  {currentJob?.status === "optimizing"
                    ? "Running Genetic Algorithm to improve quality"
                    : "Using ILP solver to create a valid schedule"}
                </p>
              </div>
              {currentJob && (
                <div className="w-full space-y-2">
                  <div className="flex justify-between text-sm text-slate-400">
                    <span>Progress</span>
                    <span className="font-medium text-white">{currentJob.progress}%</span>
                  </div>
                  <Progress value={currentJob.progress} className="h-2" />
                  {currentJob.message && (
                    <p className="text-xs text-slate-400 text-center mt-2">{currentJob.message}</p>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
                <span>Live updating...</span>
              </div>
              {/* Emergency stop button if loader gets stuck */}
              <Button
                onClick={() => {
                  console.log("[GenerateTimetable] Manual stop clicked")
                  setGenerating(false)
                  fetchLatestJob()
                }}
                variant="outline"
                size="sm"
                className="mt-4 w-full text-xs"
              >
                Refresh Status
              </Button>
            </div>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-6 bg-slate-800/50 border-slate-700 backdrop-blur-xl">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <Play className="w-5 h-5 text-success" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Step 1: Generate Base Timetable</h3>
                <p className="text-sm text-slate-300">Uses ILP to satisfy all hard constraints</p>
              </div>
            </div>
            <ClickSpark
              sparkColor="#22c55e"
              sparkSize={12}
              sparkRadius={20}
              sparkCount={10}
              duration={500}
            >
              <Button
                onClick={handleGenerateBase}
                disabled={generating}
                className="w-full bg-success hover:bg-success/90 text-white"
              >
                {generating && currentJob?.status === "generating_base" ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Generate Base Timetable
                  </>
                )}
              </Button>
            </ClickSpark>
          </div>
        </Card>

        <Card className="p-6 bg-slate-800/50 border-slate-700 backdrop-blur-xl">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Step 2: Optimize Timetable</h3>
                <p className="text-sm text-slate-300">Uses GA to improve quality metrics</p>
              </div>
            </div>
            <ClickSpark
              sparkColor="#3b82f6"
              sparkSize={12}
              sparkRadius={20}
              sparkCount={10}
              duration={500}
            >
              <Button
                onClick={handleOptimize}
                disabled={generating || (!currentJob || currentJob.status !== "base_complete")}
                className="w-full"
                variant="outline"
              >
                {generating && currentJob?.status === "optimizing" ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Optimizing...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Optimize Timetable
                  </>
                )}
              </Button>
            </ClickSpark>
          </div>
        </Card>
      </div>

      {currentJob && (
        <Card className="p-6 relative">
          {generating && (
            <div className="absolute top-4 right-4">
              <div className="flex items-center gap-2 text-xs text-primary">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                <span>Live updating...</span>
              </div>
            </div>
          )}
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-foreground">Current Job Status</h3>
                {lastUpdated && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Last updated: {lastUpdated.toLocaleTimeString()}
                  </p>
                )}
                {/* Debug info */}
                <p className="text-xs text-muted-foreground mt-1">
                  Loader: {generating ? "ON" : "OFF"} • Status: {currentJob.status}
                </p>
              </div>
              {getStatusBadge(currentJob.status)}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{currentJob.progress}%</span>
              </div>
              <Progress value={currentJob.progress} className="h-2" />
            </div>

            {currentJob.message && (
              <div className="p-3 bg-muted/50 rounded-lg border">
                <p className="text-sm text-foreground">{currentJob.message}</p>
              </div>
            )}

            {currentJob.base_generation_time && (
              <div className="flex items-center justify-between text-sm py-2 border-t">
                <span className="text-muted-foreground">Base Generation Time</span>
                <span className="font-medium">{currentJob.base_generation_time}ms</span>
              </div>
            )}

            {currentJob.optimization_time && (
              <div className="flex items-center justify-between text-sm py-2 border-t">
                <span className="text-muted-foreground">Optimization Time</span>
                <span className="font-medium">{currentJob.optimization_time}ms</span>
              </div>
            )}

            {/* Show reduced courses info on success */}
            {(currentJob.status === "base_complete" || currentJob.status === "completed") && 
             diagnostics?.reducedCourses && diagnostics.reducedCourses.length > 0 && (
              <div className="rounded-lg border-2 border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 p-3 mt-2">
                <h4 className="font-semibold text-xs mb-1 text-amber-700 dark:text-amber-300 flex items-center gap-1">
                  🔄 Fallback Applied
                </h4>
                <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
                  {diagnostics.reducedCourses.length} theory subject(s) reduced to 2 periods/week due to tight room capacity:
                </p>
                <div className="flex flex-wrap gap-1">
                  {diagnostics.reducedCourses.slice(0, 6).map((course, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200">
                      {course.courseId.split('-').pop()?.slice(0, 8)} ({course.originalPeriods}→{course.newPeriods})
                    </Badge>
                  ))}
                  {diagnostics.reducedCourses.length > 6 && (
                    <Badge variant="outline" className="text-xs">+{diagnostics.reducedCourses.length - 6} more</Badge>
                  )}
                </div>
              </div>
            )}

            {(currentJob.status === "base_complete" || currentJob.status === "completed") && (
              <div className="pt-4 border-t space-y-2">
                <ClickSpark
                  sparkColor="#3b82f6"
                  sparkSize={10}
                  sparkRadius={18}
                  sparkCount={8}
                  duration={450}
                >
                  <Button onClick={handleViewTimetable} className="w-full" variant="default" disabled={generating}>
                    <Eye className="w-4 h-4 mr-2" />
                    View Timetable
                  </Button>
                </ClickSpark>
                <ClickSpark
                  sparkColor="#8b5cf6"
                  sparkSize={10}
                  sparkRadius={18}
                  sparkCount={8}
                  duration={450}
                >
                  <Button onClick={handleDownloadPDF} className="w-full" variant="outline" disabled={generating}>
                    {generating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating PDF...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Download PDF
                      </>
                    )}
                  </Button>
                </ClickSpark>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Error Details Dialog */}
      {showErrorDialog && errorDetails.length > 0 && (
        <Card className="p-6 border-destructive">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-destructive flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Timetable Generation Failed
                </h3>
                <p className="text-sm text-muted-foreground">
                  Unable to generate complete timetable. Please review the issues below and make necessary changes.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowErrorDialog(false)}
              >
                ✕
              </Button>
            </div>

            {/* Diagnostics Summary */}
            {diagnostics && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-muted/50 rounded-lg text-center">
                  <p className="text-2xl font-bold">{diagnostics.summary.labRooms}</p>
                  <p className="text-xs text-muted-foreground">Lab Rooms</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg text-center">
                  <p className="text-2xl font-bold">{diagnostics.summary.theoryRooms}</p>
                  <p className="text-xs text-muted-foreground">Theory Rooms</p>
                </div>
                <div className={`p-3 rounded-lg text-center ${Number(diagnostics.summary.labUtilization.replace('%', '')) > 90 ? 'bg-destructive/20' : 'bg-muted/50'}`}>
                  <p className="text-2xl font-bold">{diagnostics.summary.labUtilization}</p>
                  <p className="text-xs text-muted-foreground">Lab Usage</p>
                </div>
                <div className={`p-3 rounded-lg text-center ${Number(diagnostics.summary.theoryUtilization.replace('%', '')) > 80 ? 'bg-destructive/20' : 'bg-muted/50'}`}>
                  <p className="text-2xl font-bold">{diagnostics.summary.theoryUtilization}</p>
                  <p className="text-xs text-muted-foreground">Theory Usage</p>
                </div>
              </div>
            )}

            {/* Reduced Courses Info - Fallback Applied */}
            {diagnostics?.reducedCourses && diagnostics.reducedCourses.length > 0 && (
              <div className="rounded-lg border-2 border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 p-4">
                <h4 className="font-semibold text-sm mb-2 text-amber-700 dark:text-amber-300 flex items-center gap-2">
                  🔄 Fallback Applied: Reduced Periods
                </h4>
                <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
                  Due to tight room capacity, {diagnostics.reducedCourses.length} theory subject(s) were reduced from 4 to 2 periods/week:
                </p>
                <div className="flex flex-wrap gap-2">
                  {diagnostics.reducedCourses.map((course, idx) => (
                    <Badge key={idx} variant="outline" className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200">
                      {course.courseId.split('-').pop()} ({course.originalPeriods}→{course.newPeriods}p)
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* AI-Generated Suggestions */}
            {diagnostics?.suggestions && diagnostics.suggestions.length > 0 && (
              <div className="rounded-lg border-2 border-primary/50 bg-primary/5 p-4">
                <h4 className="font-semibold text-sm mb-2 text-primary flex items-center gap-2">
                  💡 System Recommendations
                </h4>
                <ul className="space-y-2">
                  {diagnostics.suggestions.map((suggestion, idx) => (
                    <li key={idx} className="text-sm">
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
              <h4 className="font-medium text-sm">Issues Found ({errorDetails.length}):</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {errorDetails.map((detail, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-background rounded border-l-4 border-destructive space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-sm">
                        {detail.section} - {detail.subject}
                        {detail.faculty && <span className="text-muted-foreground ml-2">({detail.faculty})</span>}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {detail.type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{detail.reason}</p>
                    <div className="flex gap-4 text-xs">
                      <span>
                        <span className="text-muted-foreground">Expected:</span>{" "}
                        <span className="font-medium">{detail.expected} periods</span>
                      </span>
                      <span>
                        <span className="text-muted-foreground">Scheduled:</span>{" "}
                        <span className="font-medium text-destructive">{detail.scheduled} periods</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/20 p-4">
              <h4 className="font-medium text-sm mb-2 text-blue-900 dark:text-blue-100">
                📋 Quick Actions:
              </h4>
              <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
                <li>• <strong>Add Lab Room:</strong> Go to Classrooms → Add a new lab room with adequate capacity</li>
                <li>• <strong>Add Theory Room:</strong> Go to Classrooms → Add more theory classrooms</li>
                <li>• <strong>Fix Faculty Availability:</strong> Go to Faculty → Edit faculty → Set availability slots</li>
                <li>• <strong>Reduce Load:</strong> Remove some section-subject mappings in Sections tab</li>
              </ul>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => router.push("/admin/faculty")}
                className="flex-1"
              >
                Manage Faculty
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push("/admin/classrooms")}
                className="flex-1"
              >
                Manage Classrooms
              </Button>
              <Button
                onClick={() => setShowErrorDialog(false)}
                className="flex-1"
              >
                Close
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="bg-slate-800/50 border-slate-700 p-6">
        <h3 className="font-semibold text-white mb-3">How it Works</h3>
        <ul className="space-y-2 text-sm text-slate-300">
          <li className="flex gap-2">
            <span>1.</span>
            <span>
              <strong className="text-white">ILP Phase:</strong> Generates a valid base timetable that satisfies
              all hard constraints (no conflicts, capacity limits, faculty availability, lab priority, Saturday rules)
            </span>
          </li>
          <li className="flex gap-2">
            <span>2.</span>
            <span>
              <strong className="text-white">GA Phase:</strong> Optimizes the base timetable to minimize faculty
              gaps, balance workload, prefer morning slots, and compact lab schedules
            </span>
          </li>
        </ul>
      </Card>
    </div>
  )
}
