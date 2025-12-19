"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Edit, Trash2, Clock, Search } from "lucide-react"
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
  const [searchQuery, setSearchQuery] = useState("")
  const router = useRouter()

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()

    // Subscribe to faculty table changes
    const channel = supabase
      .channel("faculty-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "faculty" },
        (payload: any) => {
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

  // Filter faculty based on search query
  const filteredFaculty = faculty.filter((member) => {
    const query = searchQuery.toLowerCase()
    return (
      member.name.toLowerCase().includes(query) ||
      member.code.toLowerCase().includes(query) ||
      (member.email && member.email.toLowerCase().includes(query)) ||
      (member.departments?.name && member.departments.name.toLowerCase().includes(query))
    )
  })

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
        <Input
          type="text"
          placeholder="Search faculty by name, code, email, or department..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {filteredFaculty.length === 0 ? (
        <div className="text-center py-12 text-slate-300">
          <p>{searchQuery ? "No faculty members found matching your search." : "No faculty members yet. Add your first faculty member to get started."}</p>
        </div>
      ) : (
        <div className="rounded-md border border-slate-700 bg-slate-800/30">
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
              {filteredFaculty.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <Badge variant="outline">{member.code}</Badge>
                  </TableCell>
                  <TableCell className="font-medium text-white">{member.name}</TableCell>
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
                        <Clock className="w-4 h-4 text-black" />
                      </Button>
                      <FacultyDialog
                        faculty={member}
                        departments={departments}
                        trigger={
                          <Button variant="outline" size="sm">
                            <Edit className="w-4 h-4 text-black" />
                          </Button>
                        }
                      />
                      <Button variant="outline" size="sm" onClick={() => handleDelete(member.id)}>
                        <Trash2 className="w-4 h-4 text-red-400" />
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
