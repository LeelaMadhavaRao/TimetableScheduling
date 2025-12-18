"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Edit, Trash2, Search } from "lucide-react"
import type { Classroom } from "@/lib/database"
import { ClassroomDialog } from "./classroom-dialog"
import { getSupabaseBrowserClient } from "@/lib/client"
import { useRouter } from "next/navigation"
import ClickSpark from "@/components/ClickSpark"

interface ClassroomListProps {
  classrooms: Classroom[]
}

export function ClassroomList({ classrooms: initialClassrooms }: ClassroomListProps) {
  const [classrooms, setClassrooms] = useState(initialClassrooms)
  const [searchQuery, setSearchQuery] = useState("")
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

  // Filter classrooms based on search query
  const filteredClassrooms = classrooms.filter((classroom) => {
    const query = searchQuery.toLowerCase()
    return (
      classroom.name.toLowerCase().includes(query) ||
      classroom.room_type.toLowerCase().includes(query) ||
      (classroom.building && classroom.building.toLowerCase().includes(query)) ||
      classroom.capacity.toString().includes(query)
    )
  })

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
        <Input
          type="text"
          placeholder="Search classrooms by name, type, building, or capacity..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {filteredClassrooms.length === 0 ? (
        <div className="text-center py-12 text-slate-300">
          <p>{searchQuery ? "No classrooms found matching your search." : "No classrooms yet. Add your first classroom to get started."}</p>
        </div>
      ) : (
        <div className="rounded-md border border-slate-700 bg-slate-800/30">
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
              {filteredClassrooms.map((classroom) => (
                <TableRow key={classroom.id}>
                  <TableCell className="font-medium text-white">{classroom.name}</TableCell>
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
                        trigger={<ClickSpark sparkColor="#10b981" sparkSize={8} sparkRadius={12} sparkCount={6} duration={350}>
                          <Button variant="outline" size="sm">
                            <Edit className="w-4 h-4 text-black" />
                          </Button>
                        </ClickSpark>}
                      />
                      <ClickSpark sparkColor="#ef4444" sparkSize={8} sparkRadius={12} sparkCount={6} duration={350}>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(classroom.id)}>
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </Button>
                      </ClickSpark>
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
