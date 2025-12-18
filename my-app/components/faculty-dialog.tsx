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
import type { Faculty, Department } from "@/lib/database"
import { getSupabaseBrowserClient } from "@/lib/client"

interface FacultyDialogProps {
  faculty?: Faculty
  departments: Department[]
  trigger?: React.ReactNode
}

export function FacultyDialog({ faculty, departments, trigger }: FacultyDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    code: faculty?.code || "",
    name: faculty?.name || "",
    email: faculty?.email || "",
    department_id: faculty?.department_id || "",
    phone: faculty?.phone || "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const supabase = getSupabaseBrowserClient()

    if (faculty) {
      const { error } = await supabase.from("faculty").update(formData).eq("id", faculty.id)

      if (error) {
        alert("Error updating faculty: " + error.message)
        setLoading(false)
        return
      }
    } else {
      const { error } = await supabase.from("faculty").insert(formData)

      if (error) {
        alert("Error creating faculty: " + error.message)
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
            Add Faculty
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{faculty ? "Edit Faculty" : "Add Faculty"}</DialogTitle>
            <DialogDescription>
              {faculty ? "Update faculty member details" : "Add a new faculty member with their information"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="code">Faculty Code *</Label>
              <Input
                id="code"
                placeholder="e.g., KSR-CSE"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                required
              />
              <p className="text-xs text-slate-500">
                💡 Include department code as suffix (e.g., KSR-CSE, JOHN-IT)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Dr. Kumar Sharma"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="e.g., kumar@university.edu"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
                      {dept.name} ({dept.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                placeholder="e.g., +91 9876543210"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : faculty ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
