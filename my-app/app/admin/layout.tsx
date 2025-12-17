import type React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Home, Users, BookOpen, Building, Layers, Calendar } from "lucide-react"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-foreground">
              Timetable System
            </Link>
            <nav className="flex items-center gap-2">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <Home className="w-4 h-4 mr-2" />
                  Home
                </Button>
              </Link>
              <Link href="/admin/faculty">
                <Button variant="ghost" size="sm">
                  <Users className="w-4 h-4 mr-2" />
                  Faculty
                </Button>
              </Link>
              <Link href="/admin/subjects">
                <Button variant="ghost" size="sm">
                  <BookOpen className="w-4 h-4 mr-2" />
                  Subjects
                </Button>
              </Link>
              <Link href="/admin/classrooms">
                <Button variant="ghost" size="sm">
                  <Building className="w-4 h-4 mr-2" />
                  Classrooms
                </Button>
              </Link>
              <Link href="/admin/sections">
                <Button variant="ghost" size="sm">
                  <Layers className="w-4 h-4 mr-2" />
                  Sections
                </Button>
              </Link>
              <Link href="/admin/generate">
                <Button size="sm" className="bg-success hover:bg-success/90 text-white">
                  <Calendar className="w-4 h-4 mr-2" />
                  Generate
                </Button>
              </Link>
            </nav>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  )
}
