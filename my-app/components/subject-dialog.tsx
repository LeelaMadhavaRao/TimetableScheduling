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
                <Label htmlFor="code">Subject Code *</Label>
                <Input
                  id="code"
                  placeholder="e.g., CS101"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type *</Label>
                <Select
                  value={formData.subject_type}
                  onValueChange={(value: "theory" | "lab") => setFormData({ ...formData, subject_type: value })}
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
              <Label htmlFor="name">Subject Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Data Structures"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="periods">Periods per Week *</Label>
              <Input
                id="periods"
                type="number"
                min="1"
                max="20"
                value={formData.periods_per_week}
                onChange={(e) => setFormData({ ...formData, periods_per_week: Number.parseInt(e.target.value) || 0 })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
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
              <Label>Assigned Faculty (e.g., JAVA - KSR)</Label>
              <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                {faculty.map((f) => (
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
                    <label htmlFor={f.id} className="text-sm cursor-pointer">
                      {f.name} ({f.code})
                    </label>
                  </div>
                ))}
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
