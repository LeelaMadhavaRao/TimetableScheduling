"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2 } from "lucide-react"
import type { Faculty, FacultyAvailability, DayOfWeek, Period } from "@/lib/database"
import { DAYS } from "@/lib/timetable"
import { getSupabaseBrowserClient } from "@/lib/client"

interface AvailabilityDialogProps {
  faculty: Faculty
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface BookedSlot {
  day_of_week: number
  start_period: number
  end_period: number
  label: string
}

export function AvailabilityDialog({ faculty, open, onOpenChange }: AvailabilityDialogProps) {
  const [availabilities, setAvailabilities] = useState<FacultyAvailability[]>([])
  const [booked, setBooked] = useState<BookedSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({
    day_of_week: "0" as string,
    start_period: "1" as string,
    end_period: "4" as string,
  })
  const [periodError, setPeriodError] = useState("")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      fetchAvailabilities()
      fetchBooked()
    }
  }, [open])

  // Periods already committed by published department timetables
  const fetchBooked = async () => {
    const supabase = getSupabaseBrowserClient()
    const { data: rows } = await supabase
      .from("committed_timetable")
      .select("day_of_week, start_period, end_period, section_id, subject_id")
      .eq("faculty_id", faculty.id)
    if (!rows || rows.length === 0) {
      setBooked([])
      return
    }
    const sectionIds = [...new Set(rows.map((r: { section_id: string }) => r.section_id))]
    const subjectIds = [...new Set(rows.map((r: { subject_id: string }) => r.subject_id))]
    const [{ data: sections }, { data: subjects }] = await Promise.all([
      supabase.from("sections").select("id, name").in("id", sectionIds),
      supabase.from("subjects").select("id, code").in("id", subjectIds),
    ])
    const sectionName = new Map((sections || []).map((s: { id: string; name: string }) => [s.id, s.name]))
    const subjectCode = new Map((subjects || []).map((s: { id: string; code: string }) => [s.id, s.code]))
    setBooked(
      rows.map((r: { day_of_week: number; start_period: number; end_period: number; section_id: string; subject_id: string }) => ({
        day_of_week: r.day_of_week,
        start_period: r.start_period,
        end_period: r.end_period,
        label: `${subjectCode.get(r.subject_id) || ""} ${sectionName.get(r.section_id) || ""}`.trim(),
      })),
    )
  }

  const cellState = (day: number, period: number): { kind: "booked" | "available" | "unavailable" | "open"; label?: string } => {
    const b = booked.find((x) => x.day_of_week === day && x.start_period <= period && period <= x.end_period)
    if (b) return { kind: "booked", label: b.label }
    if (availabilities.length === 0) return { kind: "open" }
    const declared = availabilities.some((a) => a.day_of_week === day && a.start_period <= period && period <= a.end_period)
    return { kind: declared ? "available" : "unavailable" }
  }

  const fetchAvailabilities = async () => {
    setLoading(true)
    const supabase = getSupabaseBrowserClient()
    const { data, error } = await supabase
      .from("faculty_availability")
      .select("*")
      .eq("faculty_id", faculty.id)
      .order("day_of_week")
      .order("start_period")

    if (!error && data) {
      setAvailabilities(data)
    }
    setLoading(false)
  }

  const handleAdd = async () => {
    const startPer = Number.parseInt(formData.start_period)
    const endPer = Number.parseInt(formData.end_period)

    if (endPer < startPer) {
      setPeriodError("End period must be greater than or equal to start period")
      return
    }
    setPeriodError("")

    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase.from("faculty_availability").insert({
      faculty_id: faculty.id,
      day_of_week: Number.parseInt(formData.day_of_week) as DayOfWeek,
      start_period: Number.parseInt(formData.start_period) as Period,
      end_period: Number.parseInt(formData.end_period) as Period,
    })

    if (error) {
      setErrorMsg("Error adding availability: " + error.message)
      return
    }

    setErrorMsg(null)
    fetchAvailabilities()
  }

  const handleDelete = async (id: string) => {
    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase.from("faculty_availability").delete().eq("id", id)

    if (error) {
      setErrorMsg("Error deleting availability: " + error.message)
      return
    }

    setErrorMsg(null)
    setAvailabilities(availabilities.filter((a) => a.id !== id))
  }

  return (
    <Dialog open={open} onOpenChange={(openState) => { if (!openState) setErrorMsg(null); onOpenChange(openState) }}>
      <DialogContent className="sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>
            Availability - {faculty.name} ({faculty.code})
          </DialogTitle>
          <DialogDescription>Declared availability and the periods already booked by departments</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="border rounded-lg p-4">
            <h4 className="font-semibold mb-1">Weekly occupancy</h4>
            <p className="text-xs text-muted-foreground mb-3">
              Red periods are booked by published department timetables and are skipped automatically when other departments generate.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr>
                    <th className="p-1 text-left">Day</th>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((p) => (
                      <th key={p} className="p-1">P{p}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map((day, dayIndex) => (
                    <tr key={day}>
                      <td className="p-1 font-medium">{day.slice(0, 3)}</td>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((p) => {
                        const cell = cellState(dayIndex, p)
                        const style =
                          cell.kind === "booked"
                            ? "bg-red-500/30 text-red-200"
                            : cell.kind === "available"
                              ? "bg-emerald-500/20"
                              : cell.kind === "unavailable"
                                ? "bg-slate-700/60"
                                : "bg-emerald-500/10"
                        return (
                          <td key={p} className={`p-1 border border-slate-700 text-center truncate max-w-16 ${style}`} title={cell.label}>
                            {cell.kind === "booked" ? cell.label : ""}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-muted-foreground">
              <span><span className="inline-block w-2 h-2 bg-red-500/60 mr-1" />Booked ({booked.reduce((n, b) => n + b.end_period - b.start_period + 1, 0)} periods)</span>
              <span><span className="inline-block w-2 h-2 bg-emerald-500/40 mr-1" />Free</span>
              <span><span className="inline-block w-2 h-2 bg-slate-600 mr-1" />Outside declared availability</span>
            </div>
          </div>

          <div className="border rounded-lg p-4">
            <h4 className="font-semibold mb-3">Add Availability Slot</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Day</Label>
                <Select
                  value={formData.day_of_week}
                  onValueChange={(value) => setFormData({ ...formData, day_of_week: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((day, index) => (
                      <SelectItem key={index} value={index.toString()}>
                        {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Start Period</Label>
                <Select
                  value={formData.start_period}
                  onValueChange={(value) => {
                    setFormData({ ...formData, start_period: value })
                    if (Number.parseInt(formData.end_period) < Number.parseInt(value)) {
                      setPeriodError("End period must be greater than or equal to start period")
                    } else {
                      setPeriodError("")
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((p) => (
                      <SelectItem key={p} value={p.toString()}>
                        Period {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>End Period</Label>
                <Select
                  value={formData.end_period}
                  onValueChange={(value) => {
                    setFormData({ ...formData, end_period: value })
                    if (Number.parseInt(value) < Number.parseInt(formData.start_period)) {
                      setPeriodError("End period must be greater than or equal to start period")
                    } else {
                      setPeriodError("")
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((p) => (
                      <SelectItem key={p} value={p.toString()}>
                        Period {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleAdd} className="mt-3 w-full" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Slot
            </Button>
            {periodError && <p className="text-xs text-red-400 mt-1">{periodError}</p>}
            {errorMsg && <p className="text-sm text-red-400 mt-2">{errorMsg}</p>}
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold">Current Availability</h4>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : availabilities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No availability slots set</p>
            ) : (
              <div className="space-y-2">
                {availabilities.map((avail) => (
                  <div key={avail.id} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{DAYS[avail.day_of_week]}</Badge>
                      <span className="text-sm">
                        Period {avail.start_period} - {avail.end_period}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(avail.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
