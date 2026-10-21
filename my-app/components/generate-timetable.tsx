"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Play, Zap, CheckCircle, AlertCircle, Loader2, Eye, Download, Upload, Sparkles, History, Scale } from "lucide-react"
import { getSupabaseBrowserClient } from "@/lib/client"
import type { AlgorithmMode, TimetableJob } from "@/lib/database"
import { generateTimetablePDF } from "@/lib/pdf-generator"
import ClickSpark from "@/components/ClickSpark"
import { useAuth } from "@/contexts/AuthContext"
import { getStoredSessionToken, getUserScope } from "@/lib/auth"
import { invokeEdgeFunction } from "@/lib/edge"
import { MetricsComparison } from "@/components/generation/metrics-comparison"
import { ParetoFront } from "@/components/generation/pareto-front"
import { ReschedulePanel } from "@/components/generation/reschedule-panel"

export interface GeneratableSection {
  id: string
  name: string
  yearLevel: number
  studentCount: number
  subjectCount: number
  /** When one of the department's published timetables covers this section */
  publishedAt: string | null
}

interface ErrorDetail {
  section: string
  subject: string
  faculty?: string
  type: string
  expected: number | string
  scheduled: number
  reason: string
}

interface Diagnostics {
  summary: {
    labRooms: number
    theoryRooms: number
    labUtilization: string
    theoryUtilization: string
  }
  suggestions: string[]
}

const MODE_INFO: Record<AlgorithmMode, { title: string; subtitle: string; points: string[] }> = {
  baseline: {
    title: "Before Enhancement",
    subtitle: "Original ILP + weighted-sum GA",
    points: [
      "Single CP-SAT lab solution + 15-strategy greedy theory",
      "GA seeded from one timetable (+10% random swaps)",
      "Slot-level crossover/mutation with rejection checks",
      "Fitness F = 0.3 FG + 0.25 SG + 0.2 WB + 0.15 MP + 0.1 LC",
    ],
  },
  enhanced: {
    title: "After Enhancement",
    subtitle: "Research-paper framework",
    points: [
      "Relaxed-ILP: 4 diverse lab schedules (Hamming ≥ τ = 0.3)",
      "SCPX structural crossover - offspring always feasible",
      "Feasibility-screened block mutation, early stopping",
      "NSGA-II over 5 objectives → best 3 Pareto timetables",
    ],
  },
}

const JOB_COLUMNS =
  "id, status, progress, message, base_generation_time, optimization_time, created_at, updated_at, department_id, section_ids, section_key, algorithm_mode, run_type, parent_job_id, is_published, published_at, metrics, pareto_front, selected_solution"

export function GenerateTimetable({ sections }: { sections: GeneratableSection[] }) {
  const router = useRouter()
  const { user, role } = useAuth()
  const { departmentId } = getUserScope(user, role)

  const schedulable = sections.filter((s) => s.subjectCount > 0)
  // Nothing preselected: the admin decides which sections (years, or any mix) to generate
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [mode, setMode] = useState<AlgorithmMode>("enhanced")
  const [jobs, setJobs] = useState<TimetableJob[]>([])
  const [liveJob, setLiveJob] = useState<TimetableJob | null>(null)
  const [running, setRunning] = useState<{ mode: AlgorithmMode; stage: string } | null>(null)
  // When the current pipeline run started: the progress poll only follows jobs created since
  const runStartedAt = useRef<string | null>(null)
  const [errorDetails, setErrorDetails] = useState<ErrorDetail[]>([])
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null)
  const [executionLogs, setExecutionLogs] = useState<string[]>([])
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [busyJob, setBusyJob] = useState<string | null>(null)

  const sectionNames = useMemo(() => new Map(sections.map((s) => [s.id, s.name])), [sections])
  const sectionKey = useMemo(() => [...selected].sort().join(","), [selected])

  useEffect(() => {
    if (!toastMessage) return
    const timer = setTimeout(() => setToastMessage(null), 6000)
    return () => clearTimeout(timer)
  }, [toastMessage])

  const fetchJobs = useCallback(async () => {
    if (!departmentId) return
    const supabase = getSupabaseBrowserClient()
    const { data } = await supabase
      .from("timetable_jobs")
      .select(JOB_COLUMNS)
      .eq("department_id", departmentId)
      .order("created_at", { ascending: false })
      .limit(20)
    setJobs((data || []) as TimetableJob[])
  }, [departmentId])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  // Live progress of the job being generated
  useEffect(() => {
    if (!running || !departmentId) return
    const supabase = getSupabaseBrowserClient()
    const interval = setInterval(async () => {
      if (!runStartedAt.current) return
      const { data } = await supabase
        .from("timetable_jobs")
        .select("id, status, progress, message, created_at, updated_at")
        .eq("department_id", departmentId)
        .eq("created_by", user?.id ?? "")
        .gte("created_at", runStartedAt.current)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (data) setLiveJob(data as TimetableJob)
    }, 1200)
    return () => clearInterval(interval)
  }, [running, departmentId, user?.id])

  const forSelection = jobs.filter((j) => j.section_key === sectionKey && j.run_type !== "reschedule")
  const latestBaseline = forSelection.find((j) => j.algorithm_mode === "baseline") || null
  const latestEnhanced = forSelection.find((j) => j.algorithm_mode === "enhanced") || null
  // Only the latest run of each mode is compared: if it failed there is nothing to compare,
  // rather than silently falling back to an older run made from different data
  const completedBaseline = latestBaseline?.status === "completed" ? latestBaseline : null
  const completedEnhanced = latestEnhanced?.status === "completed" ? latestEnhanced : null
  const publishedJobs = jobs.filter((j) => j.is_published)
  const rescheduleRuns = jobs.filter((j) => j.run_type === "reschedule").slice(0, 3)

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const showError = (details: ErrorDetail[], diag?: Diagnostics | null, logs?: string[]) => {
    setErrorDetails(details)
    setDiagnostics(diag || null)
    setExecutionLogs(logs || [])
  }

  const systemError = (reason: string): ErrorDetail[] => [
    { section: "System", subject: "Error", type: "system", expected: "N/A", scheduled: 0, reason },
  ]

  /** Base (ILP) stage followed by the optimization stage, for one mode */
  const runPipeline = async (runMode: AlgorithmMode): Promise<boolean> => {
    const sessionToken = getStoredSessionToken()
    showError([])
    setLiveJob(null)
    runStartedAt.current = new Date(Date.now() - 5000).toISOString()

    setRunning({ mode: runMode, stage: "Waking up the ILP solver..." })
    try {
      await fetch("/api/health", { method: "GET" })
    } catch {
      // solver may still be starting; the edge function retries via its own fallback
    }

    setRunning({ mode: runMode, stage: runMode === "enhanced" ? "Relaxed-ILP diversified seeding" : "ILP base timetable" })
    const { data: base, error: baseError } = await invokeEdgeFunction("generate-base-timetable", {
      sessionToken,
      sectionIds: [...selected],
      mode: runMode,
    })

    if (baseError || !base?.success) {
      if (base?.error === "INCOMPLETE_SCHEDULE" && base?.details) {
        showError(base.details, base.diagnostics, base.executionLogs)
      } else if (base?.error === "CONFLICTS_DETECTED" && base?.conflicts) {
        showError(
          base.conflicts.map((c: string) => ({ section: "Conflict", subject: "Validation", type: "conflict", expected: "No conflicts", scheduled: 0, reason: c })),
          null,
          base.executionLogs,
        )
      } else {
        showError(systemError(base?.error || baseError || "Base timetable generation failed"), base?.diagnostics, base?.executionLogs)
      }
      await fetchJobs()
      return false
    }

    setRunning({ mode: runMode, stage: runMode === "enhanced" ? "NSGA-II + SCPX optimization" : "Weighted-sum GA optimization" })
    const { data: opt, error: optError } = await invokeEdgeFunction("optimize-timetable", { sessionToken, jobId: base.jobId })
    await fetchJobs()

    if (optError || !opt?.success) {
      showError(systemError(opt?.error || optError || "Optimization failed"))
      return false
    }
    return true
  }

  const handleGenerate = async () => {
    if (selected.size === 0) return setToastMessage("Select at least one section")
    try {
      const ok = await runPipeline(mode)
      if (ok) setToastMessage(`${MODE_INFO[mode].title} run finished. Review the metrics, then publish.`)
    } finally {
      setRunning(null)
      setLiveJob(null)
    }
  }

  const handleCompare = async () => {
    if (selected.size === 0) return setToastMessage("Select at least one section")
    try {
      if (!(await runPipeline("baseline"))) return
      if (await runPipeline("enhanced")) setToastMessage("Both pipelines finished - see the comparison below.")
    } finally {
      setRunning(null)
      setLiveJob(null)
    }
  }

  const handlePublish = async (job: TimetableJob, allowWarnings = false) => {
    setBusyJob(job.id)
    try {
      const res = await fetch("/api/timetable/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, allowWarnings }),
      })
      const result = await res.json()
      if (result.requiresConfirmation && !allowWarnings) {
        if (window.confirm(result.message)) return handlePublish(job, true)
        return
      }
      setToastMessage(result.message || (res.ok ? "Published" : "Publish failed"))
      if (res.ok) {
        await fetchJobs()
        router.refresh()
      }
    } finally {
      setBusyJob(null)
    }
  }

  const handleDownloadPDF = async (job: TimetableJob) => {
    setBusyJob(job.id)
    try {
      const supabase = getSupabaseBrowserClient()
      const table = job.status === "completed" ? "timetable_optimized" : "timetable_base"
      const { data, error } = await supabase
        .from(table)
        .select("*, sections(name, year_level), subjects(name, code, subject_type), faculty(name, code), classrooms(name)")
        .eq("job_id", job.id)
      if (error || !data || data.length === 0) {
        setToastMessage("No timetable data found")
        return
      }
      await generateTimetablePDF(data, job.id, job.status === "completed")
    } catch (e) {
      console.error("Error generating PDF:", e)
      setToastMessage("Error generating PDF")
    } finally {
      setBusyJob(null)
    }
  }

  const statusBadge = (job: TimetableJob) => {
    if (job.is_published) return <Badge className="bg-emerald-600 text-white"><CheckCircle className="w-3 h-3 mr-1" />Published</Badge>
    switch (job.status) {
      case "completed":
        return <Badge className="bg-success text-white"><CheckCircle className="w-3 h-3 mr-1" />Ready to publish</Badge>
      case "base_complete":
        return <Badge variant="outline">Base only</Badge>
      case "failed":
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>
      default:
        return <Badge className="bg-primary text-primary-foreground"><Loader2 className="w-3 h-3 mr-1 animate-spin" />{job.status}</Badge>
    }
  }

  // A render function, not a component: a component defined here would remount on every poll
  const renderJobCard = (job: TimetableJob, title: string) => {
    const hard = job.metrics?.final?.hard
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="text-white font-semibold">{title}</h4>
            <p className="text-xs text-slate-400">{new Date(job.created_at).toLocaleString()}</p>
          </div>
          {statusBadge(job)}
        </div>
        {job.message && <p className="text-xs text-slate-300">{job.message}</p>}
        {hard && hard.totalViolations > 0 && (
          <p className="text-xs text-amber-300">
            ⚠ {hard.totalViolations} hard-constraint violation(s): {hard.facultyAvailability} availability, {hard.theoryDailyLimit} daily-limit, {hard.calendarRules} calendar, {hard.criticalViolations} double booking
          </p>
        )}
        {(job.status === "completed" || job.status === "base_complete") && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="border-slate-600 text-slate-200" onClick={() => router.push(`/timetable?job=${job.id}`)}>
              <Eye className="w-3 h-3 mr-1" />View
            </Button>
            <Button size="sm" variant="outline" className="border-slate-600 text-slate-200" disabled={busyJob === job.id} onClick={() => handleDownloadPDF(job)}>
              <Download className="w-3 h-3 mr-1" />PDF
            </Button>
            {job.status === "completed" && !job.is_published && (
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" disabled={busyJob === job.id || !!running} onClick={() => handlePublish(job)}>
                {busyJob === job.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Upload className="w-3 h-3 mr-1" />}
                Publish
              </Button>
            )}
          </div>
        )}
      </div>
    )
  }

  const selectedNames = [...selected].map((id) => sectionNames.get(id) || "?")

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 max-w-md bg-slate-800 text-white px-4 py-3 rounded-lg shadow-lg border border-slate-600 animate-in fade-in">
          {toastMessage}
        </div>
      )}

      {running && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <Card className="p-8 bg-slate-900/95 border-slate-700 max-w-md mx-4 shadow-2xl">
            <div className="flex flex-col items-center gap-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  {running.mode === "enhanced" ? <Sparkles className="w-8 h-8 text-violet-400 animate-pulse" /> : <Play className="w-8 h-8 text-success animate-pulse" />}
                </div>
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-white">{MODE_INFO[running.mode].title}</h3>
                <p className="text-slate-300">{running.stage}</p>
              </div>
              {liveJob && (
                <div className="w-full space-y-2">
                  <div className="flex justify-between text-sm text-slate-400">
                    <span>Progress</span>
                    <span className="font-medium text-white">{liveJob.progress}%</span>
                  </div>
                  <Progress value={liveJob.progress} className="h-2" />
                  {liveJob.message && <p className="text-xs text-slate-400 text-center mt-2">{liveJob.message}</p>}
                </div>
              )}
              <p className="text-xs text-slate-500 text-center">Sections: {selectedNames.join(", ")}</p>
            </div>
          </Card>
        </div>
      )}

      {/* 1. Sections */}
      <Card className="p-6 bg-slate-800/50 border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-white">1. Select the classes to schedule</h3>
            <p className="text-sm text-slate-400">Only these sections are generated; every other department&apos;s published timetable is respected.</p>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            {/* Year shortcuts toggle every section of that year; combine them freely with the checkboxes */}
            {[...new Set(schedulable.map((s) => s.yearLevel))].sort().map((year) => {
              const ids = schedulable.filter((s) => s.yearLevel === year).map((s) => s.id)
              const all = ids.every((id) => selected.has(id))
              return (
                <Button
                  key={year}
                  size="sm"
                  variant="outline"
                  aria-pressed={all}
                  className={all ? "border-emerald-500 bg-emerald-500/15 text-emerald-200" : "border-slate-600 text-slate-200"}
                  onClick={() => {
                    const next = new Set(selected)
                    for (const id of ids) {
                      if (all) next.delete(id)
                      else next.add(id)
                    }
                    setSelected(next)
                  }}
                >
                  Year {year}
                </Button>
              )
            })}
            <Button size="sm" variant="outline" className="border-slate-600 text-slate-200" onClick={() => setSelected(new Set(schedulable.map((s) => s.id)))}>All</Button>
            <Button size="sm" variant="outline" className="border-slate-600 text-slate-200" onClick={() => setSelected(new Set())}>None</Button>
          </div>
        </div>
        {sections.length === 0 ? (
          <p className="text-sm text-slate-400">No sections yet - create them under Sections first.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {sections.map((s) => {
              const disabled = s.subjectCount === 0
              return (
                <label key={s.id} className={`flex items-center gap-3 p-3 rounded-lg border ${selected.has(s.id) ? "border-emerald-500/60 bg-emerald-500/10" : "border-slate-700 bg-slate-900/40"} ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
                  <input type="checkbox" className="h-4 w-4 accent-emerald-500" checked={selected.has(s.id)} disabled={disabled} onChange={() => toggle(s.id)} />
                  <div className="flex-1">
                    <div className="text-white font-medium">{s.name}</div>
                    <div className="text-xs text-slate-400">Year {s.yearLevel} • {s.studentCount} students • {s.subjectCount} subjects</div>
                  </div>
                  {s.publishedAt !== null && <Badge variant="outline" className="border-emerald-500/50 text-emerald-300 text-[10px]">published</Badge>}
                  {disabled && <Badge variant="outline" className="text-[10px]">no subjects</Badge>}
                </label>
              )
            })}
          </div>
        )}
      </Card>

      {/* 2. Mode */}
      <Card className="p-6 bg-slate-800/50 border-slate-700 space-y-4">
        <div>
          <h3 className="font-semibold text-white">2. Choose the architecture</h3>
          <p className="text-sm text-slate-400">Run each one on the same sections to measure the improvement proposed in the research paper.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(["baseline", "enhanced"] as AlgorithmMode[]).map((m) => {
            const info = MODE_INFO[m]
            const active = mode === m
            return (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={`text-left rounded-lg border p-4 transition-all ${active ? (m === "enhanced" ? "border-violet-500 bg-violet-500/10" : "border-amber-500 bg-amber-500/10") : "border-slate-700 bg-slate-900/40 hover:border-slate-500"}`}>
                <div className="flex items-center gap-2 mb-1">
                  {m === "enhanced" ? <Sparkles className="w-4 h-4 text-violet-400" /> : <History className="w-4 h-4 text-amber-400" />}
                  <span className="font-semibold text-white">{info.title}</span>
                  {active && <Badge className="ml-auto text-[10px]">selected</Badge>}
                </div>
                <p className="text-xs text-slate-400 mb-2">{info.subtitle}</p>
                <ul className="space-y-1">
                  {info.points.map((p) => (
                    <li key={p} className="text-xs text-slate-300">• {p}</li>
                  ))}
                </ul>
              </button>
            )
          })}
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <ClickSpark sparkColor="#22c55e" sparkSize={12} sparkRadius={20} sparkCount={10} duration={500}>
            <Button onClick={handleGenerate} disabled={!!running || selected.size === 0} className="w-full bg-success hover:bg-success/90 text-white">
              <Play className="w-4 h-4 mr-2" />
              Generate - {MODE_INFO[mode].title}
            </Button>
          </ClickSpark>
          <ClickSpark sparkColor="#8b5cf6" sparkSize={12} sparkRadius={20} sparkCount={10} duration={500}>
            <Button onClick={handleCompare} disabled={!!running || selected.size === 0} variant="outline" className="w-full border-violet-500/50 text-violet-200">
              <Scale className="w-4 h-4 mr-2" />
              Run both & compare
            </Button>
          </ClickSpark>
        </div>
      </Card>

      {/* Errors */}
      {errorDetails.length > 0 && (
        <Card className="p-6 border-destructive bg-slate-900/60 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-destructive flex items-center gap-2"><AlertCircle className="w-5 h-5" />Timetable generation failed</h3>
              <p className="text-sm text-slate-400">Review the issues below. Faculty already booked by other departments reduce the free periods available to you.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => showError([])}>✕</Button>
          </div>
          {diagnostics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-800 rounded text-center"><p className="text-xl font-bold text-white">{diagnostics.summary.labRooms}</p><p className="text-xs text-slate-400">Lab rooms</p></div>
              <div className="p-3 bg-slate-800 rounded text-center"><p className="text-xl font-bold text-white">{diagnostics.summary.theoryRooms}</p><p className="text-xs text-slate-400">Theory rooms</p></div>
              <div className="p-3 bg-slate-800 rounded text-center"><p className="text-xl font-bold text-white">{diagnostics.summary.labUtilization}</p><p className="text-xs text-slate-400">Lab usage</p></div>
              <div className="p-3 bg-slate-800 rounded text-center"><p className="text-xl font-bold text-white">{diagnostics.summary.theoryUtilization}</p><p className="text-xs text-slate-400">Theory usage</p></div>
            </div>
          )}
          {diagnostics?.suggestions && diagnostics.suggestions.length > 0 && (
            <ul className="rounded-lg border border-primary/50 bg-primary/5 p-4 space-y-1 text-sm text-slate-200">
              {diagnostics.suggestions.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          )}
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {errorDetails.map((d, i) => (
              <div key={i} className="p-3 bg-slate-800 rounded border-l-4 border-destructive">
                <div className="flex items-center justify-between text-sm text-white">
                  <span>{d.section} - {d.subject}{d.faculty && <span className="text-slate-400 ml-2">({d.faculty})</span>}</span>
                  <Badge variant="outline" className="text-xs">{d.type}</Badge>
                </div>
                <p className="text-xs text-slate-400">{d.reason}</p>
              </div>
            ))}
          </div>
          {executionLogs.length > 0 && (
            <details className="rounded-lg border border-slate-700 bg-black/40 p-3">
              <summary className="text-xs text-slate-300 cursor-pointer">Execution logs ({executionLogs.length} lines)</summary>
              <div className="mt-2 max-h-48 overflow-y-auto font-mono text-[10px] text-slate-400">
                {executionLogs.map((log, i) => <div key={i} className={log.includes("[ERROR]") ? "text-red-400" : ""}>{log}</div>)}
              </div>
            </details>
          )}
        </Card>
      )}

      {/* 3. Results for this selection */}
      {(latestBaseline || latestEnhanced) && (
        <Card className="p-6 bg-slate-800/50 border-slate-700 space-y-4">
          <div>
            <h3 className="font-semibold text-white">3. Results for {selectedNames.join(", ")}</h3>
            <p className="text-sm text-slate-400">Publishing a run commits it: faculty see it in their portal and its periods are blocked for other departments.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {latestBaseline ? renderJobCard(latestBaseline, "Before Enhancement") :  <div className="rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-500">No baseline run for this selection yet</div>}
            {latestEnhanced ? renderJobCard(latestEnhanced, "After Enhancement") :  <div className="rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-500">No enhanced run for this selection yet</div>}
          </div>
          <MetricsComparison baseline={completedBaseline} enhanced={completedEnhanced} sectionNames={selectedNames} />
          {completedEnhanced && (
            <ParetoFront job={completedEnhanced} onSelected={async (message) => { setToastMessage(message); await fetchJobs() }} />
          )}
        </Card>
      )}

      {/* 4. Rescheduling */}
      {publishedJobs.length > 0 && (
        <Card className="p-6 bg-slate-800/50 border-slate-700 space-y-4">
          <ReschedulePanel
            publishedJobs={publishedJobs}
            sectionNames={sectionNames}
            onDone={async (_jobId, message) => { setToastMessage(message); await fetchJobs() }}
          />
          {rescheduleRuns.length > 0 && (
            <div className="space-y-3">
              {rescheduleRuns.map((job) => {
                const r = job.metrics?.reschedule
                return (
                  <div key={job.id} className="space-y-2">
                    {renderJobCard(job, "Rescheduled timetable")}
                    {r && (
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                        <div className="p-2 rounded bg-slate-900/60 border border-slate-700"><div className="text-slate-400">Latency</div><div className="text-white font-semibold">{r.latencyMs} ms</div></div>
                        <div className="p-2 rounded bg-slate-900/60 border border-slate-700"><div className="text-slate-400">Full regeneration</div><div className="text-white font-semibold">{r.referenceFullRegenerationMs} ms{r.speedup ? ` (${r.speedup.toFixed(1)}× faster)` : ""}</div></div>
                        <div className="p-2 rounded bg-slate-900/60 border border-slate-700"><div className="text-slate-400">Schedule affected (SAF)</div><div className="text-white font-semibold">{(r.scheduleAffectedFraction * 100).toFixed(1)}%</div></div>
                        <div className="p-2 rounded bg-slate-900/60 border border-slate-700"><div className="text-slate-400">Locked</div><div className="text-white font-semibold">{(r.lockRatio * 100).toFixed(1)}%</div></div>
                        <div className="p-2 rounded bg-slate-900/60 border border-slate-700"><div className="text-slate-400">Quality change</div><div className="text-white font-semibold">{r.qualityChangePercent >= 0 ? "+" : ""}{r.qualityChangePercent.toFixed(2)}%</div></div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      )}

      <Card className="bg-slate-800/50 border-slate-700 p-6">
        <h3 className="font-semibold text-white mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-primary" />How it works</h3>
        <ul className="space-y-2 text-sm text-slate-300">
          <li><strong className="text-white">Occupancy first:</strong> periods that published timetables of other departments already use for a faculty member or room are removed before scheduling, so shared faculty are never double-booked.</li>
          <li><strong className="text-white">Phase 1 (ILP):</strong> CP-SAT schedules labs; greedy strategies schedule theory. The enhanced mode asks the solver for several distinct solutions instead of one.</li>
          <li><strong className="text-white">Phase 2 (GA):</strong> the baseline GA optimizes one weighted score; the enhanced NSGA-II keeps every hard constraint via SCPX and returns a Pareto front.</li>
        </ul>
      </Card>
    </div>
  )
}
