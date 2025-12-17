"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import type { Section, Faculty } from "@/lib/database"
import { DAYS, PERIOD_TIMINGS } from "@/lib/timetable"

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

interface TimetableViewerProps {
  timetableSlots: TimetableSlotWithDetails[]
  sections: Section[]
  faculty: Faculty[]
  isOptimized: boolean
}

export function TimetableViewer({ timetableSlots, sections, faculty, isOptimized }: TimetableViewerProps) {
  const [viewMode, setViewMode] = useState<"section" | "faculty">("section")
  const [selectedSection, setSelectedSection] = useState<string>(sections[0]?.id || "")
  const [selectedFaculty, setSelectedFaculty] = useState<string>(faculty[0]?.id || "")

  const getFilteredSlots = () => {
    if (viewMode === "section") {
      return timetableSlots.filter((slot) => slot.section_id === selectedSection)
    } else {
      return timetableSlots.filter((slot) => slot.faculty_id === selectedFaculty)
    }
  }

  const filteredSlots = getFilteredSlots()

  const renderTimetableGrid = () => {
    const grid: (TimetableSlotWithDetails | null)[][] = Array(6)
      .fill(null)
      .map(() => Array(8).fill(null))

    // Fill grid with slots
    for (const slot of filteredSlots) {
      for (let p = slot.start_period; p <= slot.end_period; p++) {
        grid[slot.day_of_week][p - 1] = slot
      }
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border p-2 bg-muted text-left font-semibold min-w-24">Day / Period</th>
              {PERIOD_TIMINGS.map((timing) => (
                <th key={timing.period} className="border p-2 bg-muted text-center min-w-32">
                  <div className="font-semibold">P{timing.period}</div>
                  <div className="text-xs text-muted-foreground">
                    {timing.start}-{timing.end}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day, dayIndex) => (
              <tr key={day}>
                <td className="border p-2 bg-muted/50 font-medium">{day}</td>
                {grid[dayIndex].map((slot, periodIndex) => {
                  // Skip if this cell is part of a multi-period slot
                  if (slot && periodIndex > 0 && grid[dayIndex][periodIndex - 1]?.id === slot.id) {
                    return null
                  }

                  if (!slot) {
                    return <td key={periodIndex} className="border p-2 bg-background"></td>
                  }

                  const colspan = slot.end_period - slot.start_period + 1

                  return (
                    <td key={periodIndex} colSpan={colspan} className="border p-2 bg-primary/5">
                      <div className="space-y-1">
                        <div className="font-semibold text-sm">{slot.subjects.name}</div>
                        <div className="flex items-center gap-1 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {slot.subjects.code}
                          </Badge>
                          <Badge
                            variant={slot.subjects.subject_type === "lab" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {slot.subjects.subject_type}
                          </Badge>
                        </div>
                        {viewMode === "section" ? (
                          <div className="text-xs text-muted-foreground">
                            {slot.faculty.name} ({slot.faculty.code})
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">{slot.sections.name}</div>
                        )}
                        <div className="text-xs text-muted-foreground">{slot.classrooms.name}</div>
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            {isOptimized && <Badge className="mr-2 bg-success text-white">Optimized</Badge>}
            Timetable View
          </CardTitle>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "section" | "faculty")}>
            <TabsList>
              <TabsTrigger value="section">By Section</TabsTrigger>
              <TabsTrigger value="faculty">By Faculty</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium">
            {viewMode === "section" ? "Select Section:" : "Select Faculty:"}
          </label>
          {viewMode === "section" ? (
            <Select value={selectedSection} onValueChange={setSelectedSection}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sections.map((section) => (
                  <SelectItem key={section.id} value={section.id}>
                    {section.name} (Year {section.year_level})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Select value={selectedFaculty} onValueChange={setSelectedFaculty}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {faculty.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name} ({f.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {filteredSlots.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No timetable slots found for the selected {viewMode}</p>
          </div>
        ) : (
          renderTimetableGrid()
        )}
      </CardContent>
    </Card>
  )
}
