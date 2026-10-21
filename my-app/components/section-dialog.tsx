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
import type { Section, Department } from "@/lib/database"
import { getSupabaseBrowserClient } from "@/lib/client"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { getUserScope } from "@/lib/auth"

interface SectionDialogProps {
  section?: Section
  departments: Department[]
  trigger?: React.ReactNode
}

export function SectionDialog({ section, departments, trigger }: SectionDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: section?.name || "",
    year_level: section?.year_level || 1,
    student_count: section?.student_count || 60,
    department_id: section?.department_id || (departments.length === 1 ? departments[0].id : ""),
  })
  const [studentCountError, setStudentCountError] = useState("")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const router = useRouter()
  const { user, role } = useAuth()
  const { collegeId } = getUserScope(user, role)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const supabase = getSupabaseBrowserClient()

    if (formData.student_count < 1) {
      setStudentCountError("Student count must be at least 1")
      setLoading(false)
      return
    }

    if (!section && !collegeId) {
      setErrorMsg("Your session is still loading. Please try again in a moment.")
      setLoading(false)
      return
    }
    const payload = { ...formData, department_id: formData.department_id || null }

    if (section) {
      const { error } = await supabase.from("sections").update(payload).eq("id", section.id)

      if (error) {
        setErrorMsg("Error updating section: " + error.message)
        setLoading(false)
        return
      }
    } else {
      const insertData = { ...payload, college_id: collegeId, created_by: user?.id ?? null }
      const { error } = await supabase.from("sections").insert(insertData)

      if (error) {
        setErrorMsg("Error creating section: " + error.message)
        setLoading(false)
        return
      }
    }

    setErrorMsg(null)
    setOpen(false)
    setLoading(false)
    if (!section) setFormData((current) => ({ ...current, name: "" }))
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={(openState) => { if (!openState) setErrorMsg(null); setOpen(openState) }}>
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
              <Label htmlFor="name" className="text-white">Section Name *</Label>
              <Input
                id="name"
                placeholder="e.g., CSE-2A or IT-3B"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <p className="text-xs text-slate-400">
                💡 Include department code as prefix (e.g., CSE-2A, IT-3B, PHY-1A)
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="year" className="text-white">Year Level *</Label>
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
                <Label htmlFor="students" className="text-white">Student Count *</Label>
                <Input
                  id="students"
                  type="number"
                  min="1"
                  placeholder="e.g., 60"
                  value={formData.student_count}
                  onChange={(e) => {
                    const val = Number.parseInt(e.target.value) || 0
                    setFormData({ ...formData, student_count: val })
                    if (val < 1) {
                      setStudentCountError("Student count must be at least 1")
                    } else {
                      setStudentCountError("")
                    }
                  }}
                  className={studentCountError ? "border-red-500" : ""}
                  required
                />
                {studentCountError && <p className="text-xs text-red-400">{studentCountError}</p>}
              </div>
            </div>
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
            {errorMsg && <p className="text-sm text-red-400 mt-2">{errorMsg}</p>}
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
