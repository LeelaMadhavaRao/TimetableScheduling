"use client"

import type React from "react"
import { useState } from "react"
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
import { Plus } from "lucide-react"
import type { Section, Department, Subject, Faculty } from "@/lib/database"
import { getSupabaseBrowserClient } from "@/lib/client"
import { useRouter } from "next/navigation"

interface SubjectWithFaculty extends Subject {
  subject_faculty?: { faculty: Faculty }[]
}

interface SectionDialogProps {
  section?: Section
  departments: Department[]
  subjects: SubjectWithFaculty[]
  trigger?: React.ReactNode
}

export function SectionDialog({ section, departments, subjects, trigger }: SectionDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: section?.name || "",
    year_level: section?.year_level || 1,
    student_count: section?.student_count || 60,
    department_id: section?.department_id || "",
  })
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const supabase = getSupabaseBrowserClient()

    if (section) {
      const { error } = await supabase.from("sections").update(formData).eq("id", section.id)

      if (error) {
        alert("Error updating section: " + error.message)
        setLoading(false)
        return
      }
    } else {
      const { error } = await supabase.from("sections").insert(formData)

      if (error) {
        alert("Error creating section: " + error.message)
        setLoading(false)
        return
      }
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
            Add Section
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{section ? "Edit Section" : "Add Section"}</DialogTitle>
            <DialogDescription>
              {section ? "Update section details" : "Add a new section with student count"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="name">Section Name *</Label>
              <Input
                id="name"
                placeholder="e.g., CSE-2A or IT-3B"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <p className="text-xs text-slate-500">
                💡 Include department code as prefix (e.g., CSE-2A, IT-3B, PHY-1A)
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="year">Year Level *</Label>
                <Select
                  value={formData.year_level.toString()}
                  onValueChange={(value) =>
                    setFormData({ ...formData, year_level: Number.parseInt(value) as 1 | 2 | 3 | 4 })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">First Year</SelectItem>
                    <SelectItem value="2">Second Year</SelectItem>
                    <SelectItem value="3">Third Year</SelectItem>
                    <SelectItem value="4">Fourth Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="students">Student Count *</Label>
                <Input
                  id="students"
                  type="number"
                  min="1"
                  placeholder="e.g., 60"
                  value={formData.student_count}
                  onChange={(e) => setFormData({ ...formData, student_count: Number.parseInt(e.target.value) || 0 })}
                  required
                />
              </div>
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
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : section ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
