"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, GitBranch } from "lucide-react"
import type { TimetableJob } from "@/lib/database"

const OBJECTIVES = [
  { key: "facultyGap", label: "f1 Faculty gaps" },
  { key: "studentGap", label: "f2 Student gaps" },
  { key: "workloadBalance", label: "f3 Workload" },
  { key: "morningPreference", label: "f4 Morning" },
  { key: "labCompactness", label: "f5 Labs early" },
] as const

interface ParetoFrontProps {
  job: TimetableJob
  onSelected: (message: string) => void
}

// The enhanced pipeline returns several non-dominated timetables; the administrator picks the
// trade-off that suits the department (the default is the best weighted quality).
export function ParetoFront({ job, onSelected }: ParetoFrontProps) {
  const [busy, setBusy] = useState<number | null>(null)
  const front = job.pareto_front || []
  if (front.length === 0) return null

  const best = OBJECTIVES.map(({ key }) => Math.max(...front.map((f) => f.objectives[key])))

  const choose = async (index: number) => {
    setBusy(index)
    try {
      const res = await fetch("/api/timetable/select-solution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, index }),
      })
      const result = await res.json()
      onSelected(result.message || (res.ok ? "Solution selected" : "Could not select solution"))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4 space-y-3">
      <div>
        <h3 className="text-white font-semibold flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-violet-400" />
          Pareto front - {front.length} non-dominated timetables
        </h3>
        <p className="text-xs text-slate-400">
          No alternative is better on every objective. Bold values are the best on the front. Selecting one replaces this run&apos;s timetable{job.is_published ? " (disabled: already published)" : ""}.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-400">
              <th className="text-left py-1">#</th>
              {OBJECTIVES.map((o) => (
                <th key={o.key} className="text-right py-1 px-2">{o.label}</th>
              ))}
              <th className="text-right py-1 px-2">Q</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {front.map((entry, i) => {
              const selected = (job.selected_solution ?? 0) === i
              return (
                <tr key={i} className={`border-t border-slate-800 ${selected ? "bg-violet-500/10" : ""}`}>
                  <td className="py-1 text-slate-300">{i + 1}</td>
                  {OBJECTIVES.map((o, k) => (
                    <td key={o.key} className={`text-right py-1 px-2 font-mono ${entry.objectives[o.key] === best[k] ? "text-white font-bold" : "text-slate-300"}`}>
                      {entry.objectives[o.key].toFixed(3)}
                    </td>
                  ))}
                  <td className="text-right py-1 px-2 font-mono text-slate-200">{entry.quality.toFixed(4)}</td>
                  <td className="text-right py-1 pl-2">
                    {selected ? (
                      <Badge className="bg-violet-600 text-white text-[10px]">In use</Badge>
                    ) : (
                      <Button size="sm" variant="outline" className="h-6 text-[10px] border-slate-600 text-slate-200" disabled={busy !== null || job.is_published} onClick={() => choose(i)}>
                        {busy === i ? <Loader2 className="w-3 h-3 animate-spin" /> : "Use"}
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
