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

export function AvailabilityDialog({ faculty, open, onOpenChange }: AvailabilityDialogProps) {
  const [availabilities, setAvailabilities] = useState<FacultyAvailability[]>([])
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({
    day_of_week: "0" as string,
    start_period: "1" as string,
    end_period: "4" as string,
  })

  useEffect(() => {
    if (open) {
      fetchAvailabilities()
    }
  }, [open])

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
    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase.from("faculty_availability").insert({
      faculty_id: faculty.id,
      day_of_week: Number.parseInt(formData.day_of_week) as DayOfWeek,
      start_period: Number.parseInt(formData.start_period) as Period,
      end_period: Number.parseInt(formData.end_period) as Period,
    })

    if (error) {
      alert("Error adding availability: " + error.message)
      return
    }

    fetchAvailabilities()
  }

  const handleDelete = async (id: string) => {
    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase.from("faculty_availability").delete().eq("id", id)

    if (error) {
      alert("Error deleting availability: " + error.message)
      return
    }

    setAvailabilities(availabilities.filter((a) => a.id !== id))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            Availability - {faculty.name} ({faculty.code})
          </DialogTitle>
          <DialogDescription>Manage available time slots for this faculty member</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
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
                  onValueChange={(value) => setFormData({ ...formData, start_period: value })}
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
                  onValueChange={(value) => setFormData({ ...formData, end_period: value })}
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
