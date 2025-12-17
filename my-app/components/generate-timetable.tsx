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

export function GenerateTimetable() {
  const router = useRouter()
  const [currentJob, setCurrentJob] = useState<TimetableJob | null>(null)
  const [generating, setGenerating] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Subscribe to job updates
    const supabase = getSupabaseBrowserClient()

    const channel = supabase
      .channel("timetable_jobs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "timetable_jobs" },
        (payload: { new: TimetableJob | null; old: TimetableJob | null; eventType: string }) => {
          console.log("[v0] Job update:", payload)
          if (payload.new) {
            setCurrentJob(payload.new)
            if (payload.new.status === "completed" || payload.new.status === "failed") {
              setGenerating(false)
            }
          }
        },
      )
      .subscribe()

    // Fetch latest job
    fetchLatestJob()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Poll for job updates when generating
  useEffect(() => {
    if (!generating) return

    const interval = setInterval(() => {
      fetchLatestJob()
    }, 2000) // Poll every 2 seconds

    return () => clearInterval(interval)
  }, [generating])

  const fetchLatestJob = async () => {
    const supabase = getSupabaseBrowserClient()
    const { data, error } = await supabase
      .from("timetable_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (data && !error) {
      setCurrentJob(data)
      
      // Stop loading/generating when job completes or fails
      if (data.status === "completed" || data.status === "failed" || data.status === "base_complete") {
        setGenerating(false)
      }
    }
    setIsLoading(false)
  }

  const handleGenerateBase = async () => {
    setGenerating(true)

    try {
      // Call Supabase Edge Function instead of Next.js API route
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase.functions.invoke("generate-base-timetable", {
        method: "POST",
      })

      if (error) {
        alert("Error: " + error.message)
        setGenerating(false)
        return
      }

      console.log("[v0] Generation result:", data)
      
      // Fetch the updated job immediately
      if (data?.success && data?.jobId) {
        setTimeout(() => fetchLatestJob(), 1000)
      }
    } catch (error) {
      console.error("[v0] Error:", error)
      alert("Error generating timetable")
      setGenerating(false)
    }
  }

  const handleOptimize = async () => {
    if (!currentJob || currentJob.status !== "base_complete") {
      alert("Please generate base timetable first")
      return
    }

    setGenerating(true)

    try {
      // Call Supabase Edge Function instead of Next.js API route
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase.functions.invoke("optimize-timetable", {
        method: "POST",
        body: { jobId: currentJob.id },
      })

      if (error) {
        alert("Error: " + error.message)
        setGenerating(false)
        return
      }

      console.log("[v0] Optimization result:", data)
      
      // Fetch the updated job immediately
      if (data?.success) {
        setTimeout(() => fetchLatestJob(), 1000)
      }
    } catch (error) {
      console.error("[v0] Error:", error)
      alert("Error optimizing timetable")
      setGenerating(false)
    }
  }

  const handleViewTimetable = () => {
    router.push("/timetable")
  }

  const handleDownloadPDF = async () => {
    if (!currentJob) return

    try {
      setGenerating(true)
      const supabase = getSupabaseBrowserClient()

      // Determine which table to use
      const isOptimized = currentJob.status === "completed"
      const tableName = isOptimized ? "timetable_optimized" : "timetable_base"

      // Fetch timetable data
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

      // Generate PDF
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <Play className="w-5 h-5 text-success" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Step 1: Generate Base Timetable</h3>
                <p className="text-sm text-muted-foreground">Uses ILP to satisfy all hard constraints</p>
              </div>
            </div>
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
              ) : currentJob?.status === "failed" && currentJob?.message && !currentJob.message.toLowerCase().includes("optimiz") ? (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Retry Base Generation
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Generate Base Timetable
                </>
              )}
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Step 2: Optimize Timetable</h3>
                <p className="text-sm text-muted-foreground">Uses GA to improve quality metrics</p>
              </div>
            </div>
            <Button
              onClick={handleOptimize}
              disabled={generating || (!currentJob || (currentJob.status !== "base_complete" && currentJob.status !== "failed"))}
              className="w-full bg-transparent"
              variant="outline"
            >
              {generating && currentJob?.status === "optimizing" ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Optimizing...
                </>
              ) : currentJob?.status === "failed" && currentJob?.message && currentJob.message.toLowerCase().includes("optimiz") ? (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Retry Optimization
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Optimize Timetable
                </>
              )}
            </Button>
          </div>
        </Card>
      </div>

      {currentJob && (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Current Job Status</h3>
              {getStatusBadge(currentJob.status)}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{currentJob.progress}%</span>
              </div>
              <Progress value={currentJob.progress} className="h-2" />
            </div>

            {currentJob.message && <p className="text-sm text-muted-foreground">{currentJob.message}</p>}

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

            {/* Action Buttons */}
            {(currentJob.status === "base_complete" || currentJob.status === "completed") && (
              <div className="pt-4 border-t space-y-2">
                <Button onClick={handleViewTimetable} className="w-full" variant="default" disabled={generating}>
                  <Eye className="w-4 h-4 mr-2" />
                  View Timetable
                </Button>
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
              </div>
            )}
          </div>
        </Card>
      )}

      <Card className="bg-muted/30 p-6">
        <h3 className="font-semibold text-foreground mb-3">How it Works</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <span>1.</span>
            <span>
              <strong className="text-foreground">ILP Phase:</strong> Generates a valid base timetable that satisfies
              all hard constraints (no conflicts, capacity limits, faculty availability, lab priority, Saturday rules)
            </span>
          </li>
          <li className="flex gap-2">
            <span>2.</span>
            <span>
              <strong className="text-foreground">GA Phase:</strong> Optimizes the base timetable to minimize faculty
              gaps, balance workload, prefer morning slots, and compact lab schedules
            </span>
          </li>
        </ul>
      </Card>
    </div>
  )
}
