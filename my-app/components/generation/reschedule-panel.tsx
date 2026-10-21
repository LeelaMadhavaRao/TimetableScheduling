"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, RefreshCcw, Zap } from "lucide-react"
import { getSupabaseBrowserClient } from "@/lib/client"
import { getStoredSessionToken } from "@/lib/auth"
import { invokeEdgeFunction } from "@/lib/edge"
import { DAYS } from "@/lib/timetable"
import type { TimetableJob } from "@/lib/database"

interface ReschedulePanelProps {
  publishedJobs: TimetableJob[]
  sectionNames: Map<string, string>
  onDone: (jobId: string | null, message: string) => void
}

interface Option {
  id: string
  label: string
}

// Enhancement 3: when a faculty member goes on leave or a room is closed, only the affected
// periods are re-placed; the rest of the published timetable stays exactly where it is.
export function ReschedulePanel({ publishedJobs, sectionNames, onDone }: ReschedulePanelProps) {
  const [jobId, setJobId] = useState<string>(publishedJobs[0]?.id || "")
  const [type, setType] = useState<"faculty" | "room">("faculty")
  const [targetId, setTargetId] = useState("")
  const [days, setDays] = useState<number[]>([])
  const [faculty, setFaculty] = useState<Option[]>([])
  const [rooms, setRooms] = useState<Option[]>([])
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!jobId) return
    const supabase = getSupabaseBrowserClient()
    supabase
      .from("timetable_optimized")
      .select("faculty_id, classroom_id, faculty(code, name), classrooms(name)")
      .eq("job_id", jobId)
      .then(({ data, error }: { data: { faculty_id: string; classroom_id: string; faculty: { code: string; name: string } | null; classrooms: { name: string } | null }[] | null; error: { message: string } | null }) => {
        if (error) setError(`Could not load this timetable's faculty and rooms: ${error.message}`)
        const f = new Map<string, string>()
        const r = new Map<string, string>()
        for (const row of data || []) {
          f.set(row.faculty_id, row.faculty ? `${row.faculty.code} - ${row.faculty.name}` : row.faculty_id)
          r.set(row.classroom_id, row.classrooms?.name || row.classroom_id)
        }
        setFaculty([...f].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label)))
        setRooms([...r].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label)))
        setTargetId("")
      })
  }, [jobId])

  useEffect(() => {
    if (!publishedJobs.some((j) => j.id === jobId)) setJobId(publishedJobs[0]?.id || "")
  }, [publishedJobs, jobId])

  if (publishedJobs.length === 0) return null

  const run = async () => {
    setError(null)
    if (!targetId) {
      setError(`Choose the ${type === "faculty" ? "faculty member" : "room"} that is unavailable`)
      return
    }
    setRunning(true)
    try {
      const { data, error } = await invokeEdgeFunction("generate-base-timetable", {
        action: "reschedule",
        sessionToken: getStoredSessionToken(),
        parentJobId: jobId,
        disruption: type === "faculty" ? { type, facultyId: targetId, days } : { type, roomId: targetId, days },
      })
      if (error || !data?.success) {
        setError(data?.error || error || "Rescheduling failed")
        return
      }
      const m = data.metrics
      onDone(
        data.jobId,
        `Rescheduled in ${m.latencyMs} ms: ${m.affectedSlots}/${m.totalSlots} slots moved (${(m.scheduleAffectedFraction * 100).toFixed(1)}%), ` +
          `${m.periodsReplaced}/${m.periodsToReplace} periods re-placed, quality ${m.qualityBefore.toFixed(3)} → ${m.qualityAfter.toFixed(3)}. Review and publish it to apply.`,
      )
    } finally {
      setRunning(false)
    }
  }

  const options = type === "faculty" ? faculty : rooms

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4 space-y-4">
      <div>
        <h3 className="text-white font-semibold flex items-center gap-2">
          <RefreshCcw className="w-4 h-4 text-cyan-400" />
          Incremental rescheduling (after enhancement)
        </h3>
        <p className="text-xs text-slate-400">
          Locks every unaffected slot of a published timetable and re-places only the disrupted periods. Compare its latency with a full regeneration.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-slate-300 text-xs">Published timetable</Label>
          <Select value={jobId} onValueChange={setJobId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {publishedJobs.map((j) => (
                <SelectItem key={j.id} value={j.id}>
                  {(j.section_ids || []).map((id) => sectionNames.get(id) || "?").join(", ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-slate-300 text-xs">Disruption</Label>
          <Select value={type} onValueChange={(v) => { setType(v as "faculty" | "room"); setTargetId("") }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="faculty">Faculty member on leave</SelectItem>
              <SelectItem value="room">Room closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-slate-300 text-xs">{type === "faculty" ? "Faculty" : "Room"}</Label>
          <Select value={targetId} onValueChange={setTargetId}>
            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-slate-300 text-xs">Unavailable on (none selected = whole week)</Label>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((day, i) => {
            const active = days.includes(i)
            return (
              <button
                key={day}
                type="button"
                onClick={() => setDays(active ? days.filter((d) => d !== i) : [...days, i].sort())}
                className={`px-3 py-1 rounded-full text-xs border ${active ? "bg-cyan-600 border-cyan-500 text-white" : "border-slate-600 text-slate-300 hover:bg-slate-800"}`}
              >
                {day.slice(0, 3)}
              </button>
            )
          })}
        </div>
      </div>

      {error && <div className="p-2 rounded bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{error}</div>}

      <Button onClick={run} disabled={running} className="bg-cyan-600 hover:bg-cyan-700">
        {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
        Reschedule affected periods only
      </Button>
    </div>
  )
}
