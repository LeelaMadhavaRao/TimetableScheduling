"use client"

import { useEffect, useState, useCallback } from "react"
import { getSupabaseBrowserClient } from "@/lib/client"
import { TimetableViewer } from "@/components/timetable-viewer"
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar, ArrowLeft, Loader2, RefreshCw, AlertCircle } from "lucide-react"
import Link from "next/link"
import type { TimetableJob, Section, Faculty } from "@/lib/database"
import { useAuth } from "@/contexts/AuthContext"

interface TimetableSlotWithDetails {
  id: string
  section_id: string
  subject_id: string
  faculty_id: string
  classroom_id: string
  day_of_week: number
  start_period: number
  end_period: number
  sections: { name: string; year_level: number }
  subjects: { name: string; code: string; subject_type: string }
  faculty: { name: string; code: string }
  classrooms: { name: string }
  fitness_score?: number
}

export default function TimetablePage() {
  const { user, role } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [latestJob, setLatestJob] = useState<TimetableJob | null>(null)
  const [timetableSlots, setTimetableSlots] = useState<TimetableSlotWithDetails[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [faculty, setFaculty] = useState<Faculty[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Get admin ID if user is a timetable administrator
  const adminId = role === 'timetable_admin' && user ? (user as { id: string }).id : null

  const fetchTimetableData = useCallback(async (showRefreshLoader = false) => {
    if (showRefreshLoader) {
      setIsRefreshing(true)
    }
    setError(null)

    try {
      const supabase = getSupabaseBrowserClient()

      // Fetch latest completed job
      const { data: jobData, error: jobError } = await supabase
        .from("timetable_jobs")
        .select("*")
        .in("status", ["base_complete", "completed"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (jobError) {
        console.error("[TimetablePage] Error fetching job:", jobError)
        setError("Failed to fetch timetable job")
        setIsLoading(false)
        setIsRefreshing(false)
        return
      }

      if (!jobData) {
        console.log("[TimetablePage] No completed job found")
        setLatestJob(null)
        setIsLoading(false)
        setIsRefreshing(false)
        return
      }

      console.log("[TimetablePage] Found job:", jobData.id, "Status:", jobData.status)
      setLatestJob(jobData)

      // Decide which timetable to show
      const useOptimized = jobData.status === "completed"
      const tableName = useOptimized ? "timetable_optimized" : "timetable_base"

      // Fetch timetable data
      const { data: slotsData, error: slotsError } = await supabase
        .from(tableName)
        .select("*, sections(name, year_level), subjects(name, code, subject_type), faculty(name, code), classrooms(name)")
        .eq("job_id", jobData.id)

      if (slotsError) {
        console.error("[TimetablePage] Error fetching slots:", slotsError)
        setError("Failed to fetch timetable slots")
        setIsLoading(false)
        setIsRefreshing(false)
        return
      }

      console.log("[TimetablePage] Fetched slots:", slotsData?.length || 0)
      setTimetableSlots(slotsData || [])

      // Extract unique section and faculty IDs from the timetable slots
      const sectionIdsInTimetable = [...new Set(slotsData?.map(slot => slot.section_id) || [])]
      const facultyIdsInTimetable = [...new Set(slotsData?.map(slot => slot.faculty_id) || [])]

      console.log("[TimetablePage] Section IDs in timetable:", sectionIdsInTimetable.length)
      console.log("[TimetablePage] Faculty IDs in timetable:", facultyIdsInTimetable.length)
      console.log("[TimetablePage] Admin ID:", adminId)

      // Fetch only sections and faculty that are in the timetable
      const [sectionsRes, facultyRes] = await Promise.all([
        supabase
          .from("sections")
          .select("*")
          .in("id", sectionIdsInTimetable.length > 0 ? sectionIdsInTimetable : [""])
          .order("year_level")
          .order("name"),
        supabase
          .from("faculty")
          .select("*")
          .in("id", facultyIdsInTimetable.length > 0 ? facultyIdsInTimetable : [""])
          .order("name")
      ])

      console.log("[TimetablePage] Fetched sections:", sectionsRes.data?.length || 0)
      console.log("[TimetablePage] Fetched faculty:", facultyRes.data?.length || 0)

      setSections(sectionsRes.data || [])
      setFaculty(facultyRes.data || [])

    } catch (err) {
      console.error("[TimetablePage] Exception:", err)
      setError("An unexpected error occurred")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [adminId])

  useEffect(() => {
    console.log("[TimetablePage] Initial load, fetching data...")
    fetchTimetableData()
  }, [fetchTimetableData])

  // Loading state with animated spinner
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="container mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="mb-6">
            <Link href="/">
              <Button variant="ghost" size="sm" className="mb-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>
          <Card className="flex flex-col items-center justify-center min-h-[400px] bg-white dark:bg-slate-900">
            <CardContent className="flex flex-col items-center gap-4 pt-6">
              <div className="relative">
                <Loader2 className="w-16 h-16 animate-spin text-blue-600 dark:text-blue-400" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-blue-400 dark:text-blue-600" />
                </div>
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Loading Timetable</h3>
                <p className="text-slate-600 dark:text-slate-400">Fetching your generated timetable...</p>
              </div>
              <div className="flex gap-2 items-center text-sm text-slate-600 dark:text-slate-400">
                <div className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full animate-pulse" />
                <span>Please wait</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="container mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="mb-6">
            <Link href="/">
              <Button variant="ghost" size="sm" className="mb-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>
          <Card className="border-red-300 dark:border-red-800 bg-white dark:bg-slate-900">
            <CardHeader className="bg-red-50 dark:bg-red-950/30">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertCircle className="w-5 h-5" />
                <CardTitle className="text-red-900 dark:text-red-100">Error Loading Timetable</CardTitle>
              </div>
              <CardDescription className="text-red-700 dark:text-red-300">{error}</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <Button onClick={() => fetchTimetableData(true)} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // No timetable available
  if (!latestJob) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="container mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="mb-6">
            <Link href="/">
              <Button variant="ghost" size="sm" className="mb-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>
          <Card className="flex flex-col items-center justify-center min-h-[400px] bg-white dark:bg-slate-900">
            <CardContent className="flex flex-col items-center gap-4 pt-6 text-center">
              <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800">
                <Calendar className="w-12 h-12 text-slate-600 dark:text-slate-400" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">No Timetable Available</h3>
                <p className="text-slate-600 dark:text-slate-400 max-w-md">
                  Generate a timetable first to view it here. Go to the admin panel to create a new timetable.
                </p>
              </div>
              <div className="flex gap-3 mt-4">
                <Link href="/admin/generate">
                  <Button className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800">
                    Generate Timetable
                  </Button>
                </Link>
                <Button onClick={() => fetchTimetableData(true)} variant="outline" className="bg-white dark:bg-slate-800">
                  <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const useOptimized = latestJob.status === "completed"

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                📅 Timetable Viewer
              </h1>
              <p className="text-slate-600 dark:text-slate-400">View generated timetables by section or faculty</p>
            </div>
            <Button 
              onClick={() => fetchTimetableData(true)} 
              variant="outline" 
              size="sm"
              disabled={isRefreshing}
              className="bg-white dark:bg-slate-800"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        <Card className="mb-6 hover:shadow-lg transition-shadow bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <CardTitle className="text-slate-900 dark:text-slate-100">
                {useOptimized ? "✨ Optimized Timetable" : "📋 Base Timetable"} - Job {latestJob.id.slice(0, 8)}
              </CardTitle>
            </div>
            <CardDescription className="text-slate-700 dark:text-slate-300">
              {latestJob.message}
              <span className="block mt-1 text-xs text-slate-600 dark:text-slate-400">
                Generated at: {new Date(latestJob.created_at).toLocaleString()} • {timetableSlots.length} slots scheduled
              </span>
            </CardDescription>
          </CardHeader>
        </Card>

        {timetableSlots.length === 0 ? (
          <Card className="flex flex-col items-center justify-center min-h-[300px] bg-white dark:bg-slate-900">
            <CardContent className="flex flex-col items-center gap-4 pt-6 text-center">
              <AlertCircle className="w-12 h-12 text-slate-400 dark:text-slate-600" />
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">No Slots Found</h3>
                <p className="text-slate-600 dark:text-slate-400">
                  The timetable job exists but no slots were generated. Try regenerating.
                </p>
              </div>
              <Button onClick={() => fetchTimetableData(true)} variant="outline">
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh Data
              </Button>
            </CardContent>
          </Card>
        ) : (
          <TimetableViewer
            timetableSlots={timetableSlots}
            sections={sections}
            faculty={faculty}
            isOptimized={useOptimized}
          />
        )}
      </div>
    </div>
  )
}
