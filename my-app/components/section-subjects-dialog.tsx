"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2 } from "lucide-react"
import type { Section, Subject, Faculty } from "@/lib/database"
import { getSupabaseBrowserClient } from "@/lib/client"

interface SubjectWithFaculty extends Subject {
  subject_faculty?: { faculty: Faculty }[]
}

interface SectionSubjectsDialogProps {
  section: Section
  subjects: SubjectWithFaculty[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SectionSubjectsDialog({ section, subjects, open, onOpenChange }: SectionSubjectsDialogProps) {
  const [sectionSubjects, setSectionSubjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSubject, setSelectedSubject] = useState("")
  const [selectedFaculty, setSelectedFaculty] = useState("")

  useEffect(() => {
    if (open) {
      fetchSectionSubjects()
    }
  }, [open])

  const fetchSectionSubjects = async () => {
    setLoading(true)
    const supabase = getSupabaseBrowserClient()
    const { data, error } = await supabase
      .from("section_subjects")
      .select("*, subjects(*, subject_faculty(faculty(*))), faculty(*)")
      .eq("section_id", section.id)

    if (!error && data) {
      setSectionSubjects(data)
    }
    setLoading(false)
  }

  const getAvailableFaculty = () => {
    const subject = subjects.find((s) => s.id === selectedSubject)
    return subject?.subject_faculty?.map((sf) => sf.faculty) || []
  }

  const handleAdd = async () => {
    if (!selectedSubject || !selectedFaculty) {
      alert("Please select both subject and faculty")
      return
    }

    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase.from("section_subjects").insert({
      section_id: section.id,
      subject_id: selectedSubject,
      faculty_id: selectedFaculty,
    })

    if (error) {
      alert("Error adding subject: " + error.message)
      return
    }

    setSelectedSubject("")
    setSelectedFaculty("")
    fetchSectionSubjects()
  }

  const handleDelete = async (id: string) => {
    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase.from("section_subjects").delete().eq("id", id)

    if (error) {
      alert("Error removing subject: " + error.message)
      return
    }

    setSectionSubjects(sectionSubjects.filter((s) => s.id !== id))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px]">
        <DialogHeader>
          <DialogTitle>
            Subjects - {section.name} (Year {section.year_level})
          </DialogTitle>
          <DialogDescription>Assign subjects with faculty to this section</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="border rounded-lg p-4">
            <h4 className="font-semibold mb-3">Add Subject</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Subject</Label>
                <Select
                  value={selectedSubject}
                  onValueChange={(value) => {
                    setSelectedSubject(value)
                    setSelectedFaculty("")
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((subject) => (
                      <SelectItem key={subject.id} value={subject.id}>
                        {subject.name} ({subject.code}) - {subject.subject_type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Faculty</Label>
                <Select value={selectedFaculty} onValueChange={setSelectedFaculty} disabled={!selectedSubject}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select faculty" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableFaculty().map((faculty) => (
                      <SelectItem key={faculty.id} value={faculty.id}>
                        {faculty.name} ({faculty.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              onClick={handleAdd}
              className="mt-3 w-full"
              size="sm"
              disabled={!selectedSubject || !selectedFaculty}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Subject
            </Button>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold">Assigned Subjects</h4>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : sectionSubjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No subjects assigned yet</p>
            ) : (
              <div className="space-y-2">
                {sectionSubjects.map((ss) => (
                  <div key={ss.id} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="font-medium">
                          {ss.subjects?.name} - {ss.faculty?.code}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            {ss.subjects?.code}
                          </Badge>
                          <Badge
                            variant={ss.subjects?.subject_type === "lab" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {ss.subjects?.subject_type}
                          </Badge>
                          <span>{ss.subjects?.periods_per_week} periods/week</span>
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(ss.id)}>
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
