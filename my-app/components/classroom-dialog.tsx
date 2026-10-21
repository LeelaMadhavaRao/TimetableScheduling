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
import type { Classroom } from "@/lib/database"
import { getSupabaseBrowserClient } from "@/lib/client"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { getUserScope } from "@/lib/auth"

interface ClassroomDialogProps {
  classroom?: Classroom
  trigger?: React.ReactNode
}

export function ClassroomDialog({ classroom, trigger }: ClassroomDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: classroom?.name || "",
    capacity: classroom?.capacity || 60,
    room_type: classroom?.room_type || "theory",
    building: classroom?.building || "",
    floor: classroom?.floor ?? 1,
  })
  const [capacityError, setCapacityError] = useState("")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const router = useRouter()
  const { user, role } = useAuth()
  const { collegeId } = getUserScope(user, role)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    if (!classroom && !collegeId) {
      setErrorMsg("Your session is still loading. Please try again in a moment.")
      setLoading(false)
      return
    }
    const supabase = getSupabaseBrowserClient()

    if (formData.capacity < 1) {
      setCapacityError("Capacity must be at least 1")
      setLoading(false)
      return
    }

    if (classroom) {
      const { error } = await supabase.from("classrooms").update(formData).eq("id", classroom.id)

      if (error) {
        setErrorMsg("Error updating classroom: " + error.message)
        setLoading(false)
        return
      }
    } else {
      const insertData = { ...formData, college_id: collegeId, created_by: user?.id ?? null }
      const { error } = await supabase.from("classrooms").insert(insertData)

      if (error) {
        setErrorMsg("Error creating classroom: " + error.message)
        setLoading(false)
        return
      }
    }

    setErrorMsg(null)
    setOpen(false)
    setLoading(false)
    if (!classroom) setFormData((current) => ({ ...current, name: "" }))
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={(openState) => { if (!openState) setErrorMsg(null); setOpen(openState) }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Classroom
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{classroom ? "Edit Classroom" : "Add Classroom"}</DialogTitle>
            <DialogDescription>
              {classroom ? "Update classroom details" : "Add a new classroom with capacity and type"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-white">Classroom Name *</Label>
              <Input
                id="name"
                placeholder="e.g., CSE-LAB1 or IT-101"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <p className="text-xs text-slate-400">
                💡 Include department code as prefix (e.g., CSE-LAB1, IT-101, ENG-LAB2)
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="capacity" className="text-white">Capacity *</Label>
                <Input
                  id="capacity"
                  type="number"
                  min="1"
                  placeholder="e.g., 60"
                  value={formData.capacity}
                  onChange={(e) => {
                    const val = Number.parseInt(e.target.value) || 0
                    setFormData({ ...formData, capacity: val })
                    if (val < 1) {
                      setCapacityError("Capacity must be at least 1")
                    } else {
                      setCapacityError("")
                    }
                  }}
                  className={capacityError ? "border-red-500" : ""}
                  required
                />
                {capacityError && <p className="text-xs text-red-400">{capacityError}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="type" className="text-white">Type *</Label>
                <Select
                  value={formData.room_type}
                  onValueChange={(value: "theory" | "lab") => setFormData({ ...formData, room_type: value })}
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="building" className="text-white">Building</Label>
                <Input
                  id="building"
                  placeholder="e.g., Main Block"
                  value={formData.building}
                  onChange={(e) => setFormData({ ...formData, building: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="floor" className="text-white">Floor</Label>
                <Input
                  id="floor"
                  type="number"
                  min="0"
                  placeholder="e.g., 1"
                  value={formData.floor}
                  onChange={(e) => setFormData({ ...formData, floor: Number.parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            {errorMsg && <p className="text-sm text-red-400 mt-2">{errorMsg}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : classroom ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
