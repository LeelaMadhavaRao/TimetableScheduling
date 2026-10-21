"use client"

import type React from "react"
import { LayoutDashboard, BookOpen, Layers, Calendar, Eye } from "lucide-react"
import { PortalLayout } from "@/components/portal-layout"
import { useAuth } from "@/contexts/AuthContext"
import type { DepartmentAdmin } from "@/lib/auth"

const NAV_ITEMS = [
  { href: "/department", label: "Dashboard", icon: LayoutDashboard },
  { href: "/department/subjects", label: "Subjects", icon: BookOpen },
  { href: "/department/sections", label: "Sections", icon: Layers },
  { href: "/department/generate", label: "Generate", icon: Calendar, highlight: true },
  { href: "/timetable", label: "Timetable", icon: Eye },
]

export default function DepartmentLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const admin = user as DepartmentAdmin | null
  const department = admin?.departments
  const college = admin?.timetable_administrators?.institution_name

  return (
    <PortalLayout
      role="department_admin"
      homeHref="/department"
      navItems={NAV_ITEMS}
      subtitle={[department ? `${department.code} - ${department.name}` : null, college].filter(Boolean).join(" · ")}
      displayName={admin?.name}
    >
      {children}
    </PortalLayout>
  )
}
