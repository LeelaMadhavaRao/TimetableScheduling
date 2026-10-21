"use client"

import { useEffect, useState, useCallback, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { getSupabaseBrowserClient } from "@/lib/client"
import { TimetableViewer } from "@/components/timetable-viewer"
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar, ArrowLeft, Loader2, RefreshCw, AlertCircle } from "lucide-react"
import Link from "next/link"
import type { TimetableJob, Section, Faculty, Classroom } from "@/lib/database"
import { useAuth } from "@/contexts/AuthContext"
import { getUserScope, ROLE_HOME } from "@/lib/auth"

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

const SLOT_SELECT = "*, sections(name, year_level), subjects(name, code, subject_type), faculty(name, code), classrooms(name)"

export default function TimetablePage() {
  return (
    <Suspense fallback={null}>
      <TimetablePageContent />
    </Suspense>
  )
}

function TimetablePageContent() {
  const { user, role, isLoading: authLoading } = useAuth()
  const searchParams = useSearchParams()
  const jobParam = searchParams.get("job")
  const [isLoading, setIsLoading] = useState(true)
  const [latestJob, setLatestJob] = useState<TimetableJob | null>(null)
  const [timetableSlots, setTimetableSlots] = useState<TimetableSlotWithDetails[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [faculty, setFaculty] = useState<Faculty[]>([])
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const { collegeId, departmentId } = getUserScope(user, role)
  const backHref = role ? ROLE_HOME[role] : "/"

  const fetchTimetableData = useCallback(async (showRefreshLoader = false) => {
    if (showRefreshLoader) {
      setIsRefreshing(true)
    }
    setError(null)

    try {
      const supabase = getSupabaseBrowserClient()

      let slotsData: TimetableSlotWithDetails[] | null = null

      if (jobParam) {
        // One specific run (baseline, enhanced or rescheduled)
        const { data: jobData, error: jobError } = await supabase.from("timetable_jobs").select("*").eq("id", jobParam).maybeSingle()
        // Runs are only visible inside their own college
        if (jobError || !jobData || !collegeId || jobData.college_id !== collegeId) {
          setError("Timetable run not found")
          return
        }
        setLatestJob(jobData)
        const tableName = jobData.status === "completed" ? "timetable_optimized" : "timetable_base"
        const { data, error: slotsError } = await supabase.from(tableName).select(SLOT_SELECT).eq("job_id", jobData.id)
        if (slotsError) {
          setError("Failed to fetch timetable slots")
          return
        }
        slotsData = data
      } else {
        // Every published (committed) timetable in the viewer's department or college
        if (!collegeId) {
          setLatestJob(null)
          return
        }
        // Paged: a published college easily exceeds PostgREST's 1000-row response limit
        const data: (TimetableSlotWithDetails & { job_id: string })[] = []
        let slotsError: { message: string } | null = null
        for (let from = 0; ; from += 1000) {
          let query = supabase
            .from("timetable_optimized")
            .select(`${SLOT_SELECT}, timetable_jobs!inner(is_published, college_id, department_id, published_at, message)`)
            .eq("timetable_jobs.is_published", true)
            .eq("timetable_jobs.college_id", collegeId)
            .order("id")
            .range(from, from + 999)
          if (departmentId) query = query.eq("timetable_jobs.department_id", departmentId)
          const page = await query
          if (page.error) {
            slotsError = page.error
            break
          }
          data.push(...(page.data || []))
          if (!page.data || page.data.length < 1000) break
        }
        if (slotsError) {
          console.error("[TimetablePage] Error fetching published slots:", slotsError)
          setError("Failed to fetch published timetables")
          return
        }
        if (!data || data.length === 0) {
          setLatestJob(null)
          setTimetableSlots([])
          return
        }
        const jobCount = new Set(data.map((row: { job_id: string }) => row.job_id)).size
        setLatestJob({
          id: "published",
          status: "completed",
          progress: 100,
          message: `${departmentId ? "Department" : "College-wide"} view of ${jobCount} published timetable(s)`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_published: true,
        } as TimetableJob)
        slotsData = data
      }

      console.log("[TimetablePage] Fetched slots:", slotsData?.length || 0)
      setTimetableSlots(slotsData || [])

      // Extract unique section, faculty, and classroom IDs from the timetable slots
      const sectionIdsInTimetable = [...new Set(slotsData?.map((slot: { section_id: string }) => slot.section_id) || [])]
      const facultyIdsInTimetable = [...new Set(slotsData?.map((slot: { faculty_id: string }) => slot.faculty_id) || [])]
      const classroomIdsInTimetable = [...new Set(slotsData?.map((slot: { classroom_id: string }) => slot.classroom_id) || [])]

      console.log("[TimetablePage] Section IDs in timetable:", sectionIdsInTimetable.length)
      console.log("[TimetablePage] Faculty IDs in timetable:", facultyIdsInTimetable.length)
      console.log("[TimetablePage] Classroom IDs in timetable:", classroomIdsInTimetable.length)

      // Fetch only sections, faculty, and classrooms that are in the timetable
      const [sectionsRes, facultyRes, classroomsRes] = await Promise.all([
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
          .order("name"),
        supabase
          .from("classrooms")
          .select("*")
          .in("id", classroomIdsInTimetable.length > 0 ? classroomIdsInTimetable : [""])
          .order("name")
      ])

      console.log("[TimetablePage] Fetched sections:", sectionsRes.data?.length || 0)
      console.log("[TimetablePage] Fetched faculty:", facultyRes.data?.length || 0)
      console.log("[TimetablePage] Fetched classrooms:", classroomsRes.data?.length || 0)

      setSections(sectionsRes.data || [])
      setFaculty(facultyRes.data || [])
      setClassrooms(classroomsRes.data || [])

    } catch (err) {
      console.error("[TimetablePage] Exception:", err)
      setError("An unexpected error occurred")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [jobParam, collegeId, departmentId])

  useEffect(() => {
    if (!authLoading) fetchTimetableData()
  }, [fetchTimetableData, authLoading])

  // Loading state with animated spinner
  if (isLoading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="container mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="mb-6">
            <Link href={backHref}>
              <Button variant="ghost" size="sm" className="mb-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
          </div>
          <Card className="flex flex-col items-center justify-center min-h-100 bg-white dark:bg-slate-900">
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
      <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="container mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="mb-6">
            <Link href={backHref}>
              <Button variant="ghost" size="sm" className="mb-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
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
      <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="container mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="mb-6">
            <Link href={backHref}>
              <Button variant="ghost" size="sm" className="mb-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
          </div>
          <Card className="flex flex-col items-center justify-center min-h-100 bg-white dark:bg-slate-900">
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
                {role === "department_admin" && (
                  <Link href="/department/generate">
                    <Button className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800">
                      Generate Timetable
                    </Button>
                  </Link>
                )}
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
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="mb-6">
          <Link href={backHref}>
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
          <CardHeader className="bg-linear-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <CardTitle className="text-slate-900 dark:text-slate-100">
                {latestJob.id === "published"
                  ? "✅ Published Timetables"
                  : `${latestJob.run_type === "reschedule" ? "🔁 Rescheduled" : latestJob.algorithm_mode === "enhanced" ? "✨ After Enhancement" : "📋 Before Enhancement"}${useOptimized ? "" : " (base only)"} - Run ${latestJob.id.slice(0, 8)}${latestJob.is_published ? " • published" : ""}`}
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
          <Card className="flex flex-col items-center justify-center min-h-75 bg-white dark:bg-slate-900">
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
            classrooms={classrooms}
            isOptimized={useOptimized}
          />
        )}
      </div>
    </div>
  )
}
