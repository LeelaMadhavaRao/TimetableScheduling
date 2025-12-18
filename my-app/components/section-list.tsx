"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Edit, Trash2, BookOpen, Search } from "lucide-react"
import type { Section, Department, Subject, Faculty } from "@/lib/database"
import { SectionDialog } from "./section-dialog"
import { SectionSubjectsDialog } from "./section-subjects-dialog"
import { getSupabaseBrowserClient } from "@/lib/client"
import { useRouter } from "next/navigation"
import ClickSpark from "@/components/ClickSpark"

interface SectionWithDetails extends Section {
  departments?: Department | null
  section_subjects?: any[]
}

interface SubjectWithFaculty extends Subject {
  subject_faculty?: { faculty: Faculty }[]
}

interface SectionListProps {
  sections: SectionWithDetails[]
  departments: Department[]
  subjects: SubjectWithFaculty[]
}

export function SectionList({ sections: initialSections, departments, subjects }: SectionListProps) {
  const [sections, setSections] = useState(initialSections)
  const [selectedSection, setSelectedSection] = useState<SectionWithDetails | null>(null)
  const [showSubjects, setShowSubjects] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const router = useRouter()

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()

    const channel = supabase
      .channel("section-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sections" },
        () => {
          console.log("[Section] Database change detected")
          router.refresh()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [router])

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this section?")) return

    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase.from("sections").delete().eq("id", id)

    if (error) {
      alert("Error deleting section: " + error.message)
      return
    }

    setSections(sections.filter((s) => s.id !== id))
  }

  // Filter sections based on search query
  const filteredSections = sections.filter((section) => {
    const query = searchQuery.toLowerCase()
    return (
      section.name.toLowerCase().includes(query) ||
      section.year_level.toString().includes(query) ||
      (section.departments?.name && section.departments.name.toLowerCase().includes(query))
    )
  })

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
        <Input
          type="text"
          placeholder="Search sections by name, year, or department..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {filteredSections.length === 0 ? (
        <div className="text-center py-12 text-slate-300">
          <p>{searchQuery ? "No sections found matching your search." : "No sections yet. Add your first section to get started."}</p>
        </div>
      ) : (
        <div className="rounded-md border border-slate-700 bg-slate-800/30">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Students</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Subjects</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSections.map((section) => (
                <TableRow key={section.id}>
                  <TableCell className="font-medium text-white">{section.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">Year {section.year_level}</Badge>
                  </TableCell>
                  <TableCell>{section.student_count}</TableCell>
                  <TableCell>{section.departments?.name || "-"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{section.section_subjects?.length || 0} subjects</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <ClickSpark sparkColor="#8b5cf6" sparkSize={8} sparkRadius={12} sparkCount={6} duration={350}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedSection(section)
                            setShowSubjects(true)
                          }}
                        >
                          <BookOpen className="w-4 h-4 text-black" />
                        </Button>
                      </ClickSpark>
                      <SectionDialog
                        section={section}
                        departments={departments}
                        subjects={subjects}
                        trigger={<ClickSpark sparkColor="#10b981" sparkSize={8} sparkRadius={12} sparkCount={6} duration={350}>
                          <Button variant="outline" size="sm">
                            <Edit className="w-4 h-4 text-black" />
                          </Button>
                        </ClickSpark>}
                      />
                      <ClickSpark sparkColor="#ef4444" sparkSize={8} sparkRadius={12} sparkCount={6} duration={350}>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(section.id)}>
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

      {selectedSection && showSubjects && (
        <SectionSubjectsDialog
          section={selectedSection}
          subjects={subjects}
          open={showSubjects}
          onOpenChange={setShowSubjects}
        />
      )}
    </div>
  )
}
