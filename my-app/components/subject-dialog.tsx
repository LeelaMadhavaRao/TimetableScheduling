"use client"

import type React from "react"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus } from "lucide-react"
import type { Subject, Department, Faculty } from "@/lib/database"
import { getSupabaseBrowserClient } from "@/lib/client"
import { useRouter } from "next/navigation"

interface SubjectDialogProps {
  subject?: Subject & { subject_faculty?: { faculty: Faculty }[] }
  departments: Department[]
  faculty: Faculty[]
  trigger?: React.ReactNode
}

export function SubjectDialog({ subject, departments, faculty, trigger }: SubjectDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    code: subject?.code || "",
    name: subject?.name || "",
    subject_type: subject?.subject_type || "theory",
    periods_per_week: subject?.periods_per_week || 3,
    department_id: subject?.department_id || "",
  })
  const [selectedFaculty, setSelectedFaculty] = useState<string[]>([])
  const [facultySearch, setFacultySearch] = useState("")
  const router = useRouter()

  useEffect(() => {
    if (subject && open) {
      const facultyIds = subject.subject_faculty?.map((sf) => sf.faculty.id) || []
      setSelectedFaculty(facultyIds)
    }
  }, [subject, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const supabase = getSupabaseBrowserClient()

    let subjectId = subject?.id

    if (subject) {
      const { error } = await supabase.from("subjects").update(formData).eq("id", subject.id)
      if (error) {
        alert("Error updating subject: " + error.message)
        setLoading(false)
        return
      }
    } else {
      const { data, error } = await supabase.from("subjects").insert(formData).select().single()
      if (error) {
        alert("Error creating subject: " + error.message)
        setLoading(false)
        return
      }
      subjectId = data.id
    }

    // Update faculty assignments
    await supabase.from("subject_faculty").delete().eq("subject_id", subjectId)

    if (selectedFaculty.length > 0) {
      const assignments = selectedFaculty.map((fid) => ({
        subject_id: subjectId,
        faculty_id: fid,
      }))
      await supabase.from("subject_faculty").insert(assignments)
    }

    setOpen(false)
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Subject
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{subject ? "Edit Subject" : "Add Subject"}</DialogTitle>
            <DialogDescription>
              {subject ? "Update subject details" : "Add a new subject with faculty assignments"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="code" className="text-white">Subject Code *</Label>
                <Input
                  id="code"
                  placeholder="e.g., JAVA-IT"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  required
                />
                <p className="text-xs text-slate-400">
                  💡 Include department code as suffix (e.g., JAVA-IT, CS101-CSE)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="type" className="text-white">Type *</Label>
                <Select
                  value={formData.subject_type}
                  onValueChange={(value: "theory" | "lab") => {
                    // Labs are always 4 continuous periods once a week
                    setFormData({ 
                      ...formData, 
                      subject_type: value,
                      periods_per_week: value === "lab" ? 4 : formData.periods_per_week 
                    })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="theory">Theory</SelectItem>
                    <SelectItem value="lab">Lab</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name" className="text-white">Subject Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Data Structures"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            {formData.subject_type === "theory" ? (
              <div className="space-y-2">
                <Label htmlFor="periods" className="text-white">Periods per Week *</Label>
                <Input
                  id="periods"
                  type="number"
                  min="1"
                  max="20"
                  value={formData.periods_per_week}
                  onChange={(e) => setFormData({ ...formData, periods_per_week: Number.parseInt(e.target.value) || 0 })}
                  required
                />
                <p className="text-xs text-slate-400">Number of theory periods per week</p>
              </div>
            ) : (
              <div className="rounded-lg bg-slate-700/50 p-3 space-y-1 border border-slate-600">
                <p className="text-sm font-medium text-white">Lab Schedule</p>
                <p className="text-xs text-slate-300">
                  Lab subjects are automatically scheduled for 4 continuous periods (1 session) per week
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="department" className="text-white">Department</Label>
              <Select
                value={formData.department_id}
                onValueChange={(value) => setFormData({ ...formData, department_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-white">Assigned Faculty (e.g., JAVA - KSR)</Label>
              <Input
                type="text"
                placeholder="Search faculty by name or code..."
                value={facultySearch}
                onChange={(e) => setFacultySearch(e.target.value)}
                className="mb-2"
              />
              <div className="border border-slate-600 rounded-md p-3 space-y-2 max-h-48 overflow-y-auto bg-slate-700/30">
                {faculty
                  .filter((f) => {
                    const query = facultySearch.toLowerCase()
                    return (
                      f.name.toLowerCase().includes(query) ||
                      f.code.toLowerCase().includes(query)
                    )
                  })
                  .map((f) => (
                    <div key={f.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={f.id}
                        checked={selectedFaculty.includes(f.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedFaculty([...selectedFaculty, f.id])
                          } else {
                            setSelectedFaculty(selectedFaculty.filter((id) => id !== f.id))
                          }
                        }}
                      />
                      <label htmlFor={f.id} className="text-sm cursor-pointer text-white">
                        {f.name} ({f.code})
                      </label>
                    </div>
                  ))}
                {faculty.filter((f) => {
                  const query = facultySearch.toLowerCase()
                  return f.name.toLowerCase().includes(query) || f.code.toLowerCase().includes(query)
                }).length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-2">
                    No faculty found matching "{facultySearch}"
                  </p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : subject ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
