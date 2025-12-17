"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Edit, Trash2, Clock } from "lucide-react"
import type { Faculty, Department } from "@/lib/database"
import { FacultyDialog } from "./faculty-dialog"
import { AvailabilityDialog } from "./availability-dialog"
import { getSupabaseBrowserClient } from "@/lib/client"
import { useRouter } from "next/navigation"

interface FacultyWithDept extends Faculty {
  departments?: Department | null
}

interface FacultyListProps {
  faculty: FacultyWithDept[]
  departments: Department[]
}

export function FacultyList({ faculty: initialFaculty, departments }: FacultyListProps) {
  const [faculty, setFaculty] = useState(initialFaculty)
  const [selectedFaculty, setSelectedFaculty] = useState<FacultyWithDept | null>(null)
  const [showAvailability, setShowAvailability] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()

    // Subscribe to faculty table changes
    const channel = supabase
      .channel("faculty-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "faculty" },
        (payload) => {
          console.log("[Faculty] Database change detected:", payload)
          router.refresh()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [router])

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this faculty member?")) return

    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase.from("faculty").delete().eq("id", id)

    if (error) {
      alert("Error deleting faculty: " + error.message)
      return
    }

    setFaculty(faculty.filter((f) => f.id !== id))
  }

  return (
    <div className="space-y-4">
      {faculty.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No faculty members yet. Add your first faculty member to get started.</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {faculty.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <Badge variant="outline">{member.code}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{member.name}</TableCell>
                  <TableCell>{member.email || "-"}</TableCell>
                  <TableCell>{member.departments?.name || "-"}</TableCell>
                  <TableCell>{member.phone || "-"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedFaculty(member)
                          setShowAvailability(true)
                        }}
                      >
                        <Clock className="w-4 h-4" />
                      </Button>
                      <FacultyDialog
                        faculty={member}
                        departments={departments}
                        trigger={
                          <Button variant="outline" size="sm">
                            <Edit className="w-4 h-4" />
                          </Button>
                        }
                      />
                      <Button variant="outline" size="sm" onClick={() => handleDelete(member.id)}>
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

      {selectedFaculty && showAvailability && (
        <AvailabilityDialog faculty={selectedFaculty} open={showAvailability} onOpenChange={setShowAvailability} />
      )}
    </div>
  )
}
