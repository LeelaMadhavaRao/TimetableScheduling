"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Edit, Trash2, Search } from "lucide-react"
import type { Subject, Department, Faculty } from "@/lib/database"
import { SubjectDialog } from "./subject-dialog"
import { getSupabaseBrowserClient } from "@/lib/client"
import { useRouter } from "next/navigation"

interface SubjectWithDetails extends Subject {
  departments?: Department | null
  subject_faculty?: { faculty: Faculty }[]
}

interface SubjectListProps {
  subjects: SubjectWithDetails[]
  departments: Department[]
  faculty: Faculty[]
}

export function SubjectList({ subjects: initialSubjects, departments, faculty }: SubjectListProps) {
  const [subjects, setSubjects] = useState(initialSubjects)
  const [searchQuery, setSearchQuery] = useState("")
  const router = useRouter()

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()

    const channel = supabase
      .channel("subject-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subjects" },
        () => {
          console.log("[Subject] Database change detected")
          router.refresh()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [router])

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this subject?")) return

    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase.from("subjects").delete().eq("id", id)

    if (error) {
      alert("Error deleting subject: " + error.message)
      return
    }

    setSubjects(subjects.filter((s) => s.id !== id))
  }

  // Filter subjects based on search query
  const filteredSubjects = subjects.filter((subject) => {
    const query = searchQuery.toLowerCase()
    const facultyCodes = subject.subject_faculty?.map(sf => sf.faculty.code).join(" ").toLowerCase() || ""
    return (
      subject.name.toLowerCase().includes(query) ||
      subject.code.toLowerCase().includes(query) ||
      subject.subject_type.toLowerCase().includes(query) ||
      facultyCodes.includes(query) ||
      (subject.departments?.name && subject.departments.name.toLowerCase().includes(query))
    )
  })

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          type="text"
          placeholder="Search subjects by name, code, type, faculty, or department..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {filteredSubjects.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>{searchQuery ? "No subjects found matching your search." : "No subjects yet. Add your first subject to get started."}</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Periods/Week</TableHead>
                <TableHead>Faculty</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSubjects.map((subject) => (
                <TableRow key={subject.id}>
                  <TableCell>
                    <Badge variant="outline">{subject.code}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{subject.name}</TableCell>
                  <TableCell>
                    <Badge variant={subject.subject_type === "lab" ? "default" : "secondary"}>
                      {subject.subject_type}
                    </Badge>
                  </TableCell>
                  <TableCell>{subject.periods_per_week}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {subject.subject_faculty?.map((sf) => (
                        <Badge key={sf.faculty.id} variant="outline">
                          {sf.faculty.code}
                        </Badge>
                      )) || "-"}
                    </div>
                  </TableCell>
                  <TableCell>{subject.departments?.name || "-"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <SubjectDialog
                        subject={subject}
                        departments={departments}
                        faculty={faculty}
                        trigger={
                          <Button variant="outline" size="sm">
                            <Edit className="w-4 h-4" />
                          </Button>
                        }
                      />
                      <Button variant="outline" size="sm" onClick={() => handleDelete(subject.id)}>
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
