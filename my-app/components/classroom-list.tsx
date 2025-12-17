"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Edit, Trash2 } from "lucide-react"
import type { Classroom } from "@/lib/database"
import { ClassroomDialog } from "./classroom-dialog"
import { getSupabaseBrowserClient } from "@/lib/client"
import { useRouter } from "next/navigation"

interface ClassroomListProps {
  classrooms: Classroom[]
}

export function ClassroomList({ classrooms: initialClassrooms }: ClassroomListProps) {
  const [classrooms, setClassrooms] = useState(initialClassrooms)
  const router = useRouter()

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()

    const channel = supabase
      .channel("classroom-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "classrooms" },
        () => {
          console.log("[Classroom] Database change detected")
          router.refresh()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [router])

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this classroom?")) return

    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase.from("classrooms").delete().eq("id", id)

    if (error) {
      alert("Error deleting classroom: " + error.message)
      return
    }

    setClassrooms(classrooms.filter((c) => c.id !== id))
  }

  return (
    <div className="space-y-4">
      {classrooms.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No classrooms yet. Add your first classroom to get started.</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Building</TableHead>
                <TableHead>Floor</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classrooms.map((classroom) => (
                <TableRow key={classroom.id}>
                  <TableCell className="font-medium">{classroom.name}</TableCell>
                  <TableCell>
                    <Badge variant={classroom.room_type === "lab" ? "default" : "secondary"}>
                      {classroom.room_type}
                    </Badge>
                  </TableCell>
                  <TableCell>{classroom.capacity} students</TableCell>
                  <TableCell>{classroom.building || "-"}</TableCell>
                  <TableCell>{classroom.floor ? `Floor ${classroom.floor}` : "-"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <ClassroomDialog
                        classroom={classroom}
                        trigger={
                          <Button variant="outline" size="sm">
                            <Edit className="w-4 h-4" />
                          </Button>
                        }
                      />
                      <Button variant="outline" size="sm" onClick={() => handleDelete(classroom.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
