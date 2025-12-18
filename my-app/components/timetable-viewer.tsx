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
  const [selectedSection, setSelectedSection] = useState<string>(sections.length > 0 ? sections[0].id : "")
  const [selectedFaculty, setSelectedFaculty] = useState<string>(faculty.length > 0 ? faculty[0].id : "")

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
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-800">
              <th className="border border-slate-300 dark:border-slate-600 p-3 text-left font-semibold min-w-24 text-slate-900 dark:text-slate-100">Day / Period</th>
              {PERIOD_TIMINGS.map((timing) => (
                <th key={timing.period} className="border border-slate-300 dark:border-slate-600 p-3 text-center min-w-32 text-slate-900 dark:text-slate-100">
                  <div className="font-semibold">P{timing.period}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    {timing.start}-{timing.end}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day, dayIndex) => (
              <tr key={day}>
                <td className="border border-slate-300 dark:border-slate-600 p-3 bg-slate-50 dark:bg-slate-800/50 font-medium text-slate-900 dark:text-slate-100">{day}</td>
                {grid[dayIndex].map((slot, periodIndex) => {
                  // Skip if this cell is part of a multi-period slot
                  if (slot && periodIndex > 0 && grid[dayIndex][periodIndex - 1]?.id === slot.id) {
                    return null
                  }

                  if (!slot) {
                    return <td key={periodIndex} className="border border-slate-300 dark:border-slate-600 p-3 bg-white dark:bg-slate-900"></td>
                  }

                  const colspan = slot.end_period - slot.start_period + 1
                  const isLab = slot.subjects.subject_type === "lab"

                  return (
                    <td key={periodIndex} colSpan={colspan} className={`border border-slate-300 dark:border-slate-600 p-3 ${
                      isLab ? "bg-blue-50 dark:bg-blue-950/30" : "bg-green-50 dark:bg-green-950/30"
                    }`}>
                      <div className="space-y-1.5">
                        <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">{slot.subjects.name}</div>
                        <div className="flex items-center gap-1 flex-wrap">
                          <Badge variant="outline" className="text-xs bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600">
                            {slot.subjects.code}
                          </Badge>
                          <Badge
                            variant={isLab ? "default" : "secondary"}
                            className={`text-xs ${
                              isLab 
                                ? "bg-blue-600 dark:bg-blue-700 text-white" 
                                : "bg-green-600 dark:bg-green-700 text-white"
                            }`}
                          >
                            {slot.subjects.subject_type}
                          </Badge>
                        </div>
                        {viewMode === "section" ? (
                          <div className="text-xs text-slate-700 dark:text-slate-300">
                            {slot.faculty.name} ({slot.faculty.code})
                          </div>
                        ) : (
                          <div className="text-xs text-slate-700 dark:text-slate-300">{slot.sections.name}</div>
                        )}
                        <div className="text-xs text-slate-600 dark:text-slate-400">{slot.classrooms.name}</div>
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
    <Card className="bg-white dark:bg-slate-900">
      <CardHeader className="bg-slate-50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-900 dark:text-slate-100">
            {isOptimized && <Badge className="mr-2 bg-emerald-600 dark:bg-emerald-700 text-white">Optimized</Badge>}
            Timetable View
          </CardTitle>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "section" | "faculty")}>
            <TabsList className="bg-white dark:bg-slate-800">
              <TabsTrigger value="section" className="data-[state=active]:bg-slate-200 dark:data-[state=active]:bg-slate-700">By Section</TabsTrigger>
              <TabsTrigger value="faculty" className="data-[state=active]:bg-slate-200 dark:data-[state=active]:bg-slate-700">By Faculty</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-slate-900 dark:text-slate-100">
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

        {sections.length === 0 && viewMode === "section" ? (
          <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <p className="text-slate-600 dark:text-slate-400">No sections available. Please add sections first.</p>
          </div>
        ) : faculty.length === 0 && viewMode === "faculty" ? (
          <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <p className="text-slate-600 dark:text-slate-400">No faculty available. Please add faculty first.</p>
          </div>
        ) : filteredSlots.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <p className="text-slate-600 dark:text-slate-400">No timetable slots found for the selected {viewMode}</p>
          </div>
        ) : (
          renderTimetableGrid()
        )}
      </CardContent>
    </Card>
  )
}
