"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
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
import { useAuth } from "@/contexts/AuthContext"
import { getUserScope } from "@/lib/auth"

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
  const [phoneError, setPhoneError] = useState("")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const router = useRouter()
  const { user, role } = useAuth()
  const { collegeId } = getUserScope(user, role)

  const validatePhone = (phone: string) => {
    const digitCount = phone.replace(/\D/g, "").length
    if (phone && digitCount < 10) {
      setPhoneError("Phone number must contain at least 10 digits")
      return false
    }
    setPhoneError("")
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validatePhone(formData.phone)) {
      return
    }

    setLoading(true)
    if (!faculty && !collegeId) {
      setErrorMsg("Your session is still loading. Please try again in a moment.")
      setLoading(false)
      return
    }

    const supabase = getSupabaseBrowserClient()
    // An unselected department is NULL, not "" (department_id is a UUID column)
    const payload = { ...formData, department_id: formData.department_id || null }

    if (faculty) {
      const { error } = await supabase.from("faculty").update(payload).eq("id", faculty.id)

      if (error) {
        setErrorMsg("Error updating faculty: " + error.message)
        setLoading(false)
        return
      }
    } else {
      const insertData = { ...payload, college_id: collegeId, created_by: user?.id ?? null }
      const { error } = await supabase.from("faculty").insert(insertData)

      if (error) {
        setErrorMsg("Error creating faculty: " + error.message)
        setLoading(false)
        return
      }
    }

    setErrorMsg(null)
    setOpen(false)
    setLoading(false)
    if (!faculty) setFormData({ code: "", name: "", email: "", department_id: "", phone: "" })
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={(openState) => { if (!openState) setErrorMsg(null); setOpen(openState) }}>
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
          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="code" className="text-white">Faculty Code *</Label>
              <Input
                id="code"
                placeholder="e.g., KSR-CSE"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                required
              />
              <p className="text-xs text-slate-400">
                💡 Include department code as suffix (e.g., KSR-CSE, JOHN-IT)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name" className="text-white">Full Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Dr. Kumar Sharma"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="e.g., kumar@university.edu"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
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
                      {dept.name} ({dept.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-white">Phone</Label>
              <Input
                id="phone"
                placeholder="e.g., +91 9876543210"
                value={formData.phone}
                onChange={(e) => {
                  const filtered = e.target.value.replace(/[^\d+\-\s]/g, "")
                  setFormData({ ...formData, phone: filtered })
                  validatePhone(filtered)
                }}
                className={phoneError ? "border-red-500" : ""}
              />
              {phoneError && <p className="text-xs text-red-400">{phoneError}</p>}
            </div>
            {errorMsg && <p className="text-sm text-red-400 mt-2">{errorMsg}</p>}
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
