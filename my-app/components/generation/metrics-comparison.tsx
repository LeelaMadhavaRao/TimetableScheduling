"use client"

import { Fragment } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Download, Trophy, FlaskConical } from "lucide-react"
import type { TimetableJob } from "@/lib/database"
import { comparisonCsv, comparisonRows, METRICS } from "@/lib/metrics-display"

interface MetricsComparisonProps {
  baseline: TimetableJob | null
  enhanced: TimetableJob | null
  sectionNames: string[]
}

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export function MetricsComparison({ baseline, enhanced, sectionNames }: MetricsComparisonProps) {
  if (!baseline && !enhanced) return null

  if (!baseline || !enhanced) {
    const job = (baseline || enhanced)!
    const missing = baseline ? "After Enhancement" : "Before Enhancement"
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4 space-y-3">
        <div className="flex items-center gap-2 text-white font-semibold">
          <FlaskConical className="w-4 h-4 text-amber-400" />
          Evaluation metrics - {job.algorithm_mode === "enhanced" ? "After Enhancement" : "Before Enhancement"}
        </div>
        <p className="text-sm text-slate-400">Run <strong className="text-slate-200">{missing}</strong> on the same sections to compare both pipelines.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {METRICS.filter((m) => ["violations", "coverage", "quality", "cp", "pie", "hv", "front", "optTime"].includes(m.key)).map((def) => {
            const v = def.get(job.metrics || {}, job)
            return (
              <div key={def.key} className="p-2 rounded bg-slate-800/60 border border-slate-700">
                <div className="text-[11px] text-slate-400">{def.label}</div>
                <div className="text-white font-semibold">{v === undefined || v === null ? "-" : def.format(v)}</div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const rows = comparisonRows(baseline, enhanced)
  const counted = rows.filter((r) => r.def.countsTowardVerdict && r.winner && r.winner !== "tie")
  const enhancedWins = counted.filter((r) => r.winner === "enhanced").length
  const baselineWins = counted.filter((r) => r.winner === "baseline").length
  const bHard = baseline.metrics?.final?.hard
  const eHard = enhanced.metrics?.final?.hard
  const feasibilityLeader =
    bHard && eHard
      ? eHard.totalViolations < bHard.totalViolations
        ? "enhanced"
        : eHard.totalViolations > bHard.totalViolations
          ? "baseline"
          : null
      : null
  const qualityDelta =
    baseline.metrics?.final?.quality && enhanced.metrics?.final?.quality
      ? ((enhanced.metrics.final.quality - baseline.metrics.final.quality) / baseline.metrics.final.quality) * 100
      : null
  const overall = enhancedWins > baselineWins ? "enhanced" : baselineWins > enhancedWins ? "baseline" : "tie"

  let lastGroup = ""

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            Before vs After Enhancement
          </h3>
          <p className="text-xs text-slate-400">
            Same sections ({sectionNames.join(", ")}), same occupancy, same population × generation budget
            {baseline.metrics?.process && ` (${baseline.metrics.process.populationSize} × ${baseline.metrics.process.generations})`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="border-slate-600 text-slate-200"
            onClick={() => download("baseline-vs-enhanced.csv", comparisonCsv(baseline, enhanced), "text/csv")}>
            <Download className="w-3 h-3 mr-1" />CSV
          </Button>
          <Button size="sm" variant="outline" className="border-slate-600 text-slate-200"
            onClick={() => download("baseline-vs-enhanced.json", JSON.stringify({ sections: sectionNames, baseline: { id: baseline.id, created_at: baseline.created_at, metrics: baseline.metrics }, enhanced: { id: enhanced.id, created_at: enhanced.created_at, metrics: enhanced.metrics } }, null, 2), "application/json")}>
            <Download className="w-3 h-3 mr-1" />JSON
          </Button>
        </div>
      </div>

      <div className={`rounded-md p-3 text-sm ${overall === "enhanced" ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-200" : overall === "baseline" ? "bg-amber-500/10 border border-amber-500/30 text-amber-200" : "bg-slate-800 border border-slate-700 text-slate-200"}`}>
        {overall === "enhanced" && <>The enhanced architecture is better on <strong>{enhancedWins}</strong> of {counted.length} decided metrics (baseline better on {baselineWins}).</>}
        {overall === "baseline" && <>The baseline is better on <strong>{baselineWins}</strong> of {counted.length} decided metrics on this run (enhanced better on {enhancedWins}).</>}
        {overall === "tie" && <>Both pipelines win the same number of metrics ({enhancedWins} each).</>}
        {feasibilityLeader === "enhanced" && <> It also has fewer hard-constraint violations ({eHard?.totalViolations} vs {bHard?.totalViolations}).</>}
        {feasibilityLeader === "baseline" && <> Note: the baseline has fewer hard-constraint violations on this run.</>}
        {qualityDelta !== null && <> Weighted quality changed by <strong>{qualityDelta >= 0 ? "+" : ""}{qualityDelta.toFixed(2)}%</strong>.</>}
        <span className="block text-xs opacity-70 mt-1">Not counted: runtime, and metrics that differ by design (number of timetables offered, their hypervolume, crossover acceptance).</span>
        <span className="block text-xs opacity-70">Runs compared: before {new Date(baseline.created_at).toLocaleString()} · after {new Date(enhanced.created_at).toLocaleString()}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 text-xs">
              <th className="text-left py-2 pr-2">Metric</th>
              <th className="text-right py-2 px-2">Before enhancement</th>
              <th className="text-right py-2 px-2">After enhancement</th>
              <th className="text-right py-2 px-2">Change</th>
              <th className="text-center py-2 pl-2">Better</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ def, b, e, winner, deltaPercent }) => {
              const groupHeader = def.group !== lastGroup
              lastGroup = def.group
              return (
                <Fragment key={def.key}>
                  {groupHeader && (
                    <tr>
                      <td colSpan={5} className="pt-3 pb-1 text-[11px] uppercase tracking-wide text-slate-500">{def.group}</td>
                    </tr>
                  )}
                  <tr className="border-t border-slate-800" title={def.description}>
                    <td className="py-1.5 pr-2 text-slate-200">
                      {def.label}
                      <span className="ml-1 text-[10px] text-slate-500">{def.higherIsBetter ? "↑" : "↓"}</span>
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono text-slate-300">{b === undefined || b === null ? "-" : def.format(b)}</td>
                    <td className="py-1.5 px-2 text-right font-mono text-white">{e === undefined || e === null ? "-" : def.format(e)}</td>
                    <td className={`py-1.5 px-2 text-right font-mono text-xs ${winner === "enhanced" ? "text-emerald-400" : winner === "baseline" ? "text-amber-400" : "text-slate-500"}`}>
                      {deltaPercent === null ? "" : `${deltaPercent >= 0 ? "+" : ""}${deltaPercent.toFixed(1)}%`}
                    </td>
                    <td className="py-1.5 pl-2 text-center">
                      {winner === "enhanced" && <Badge className="bg-emerald-600 text-white text-[10px]">After</Badge>}
                      {winner === "baseline" && <Badge className="bg-amber-600 text-white text-[10px]">Before</Badge>}
                      {winner === "tie" && <span className="text-slate-500 text-xs">=</span>}
                    </td>
                  </tr>
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
