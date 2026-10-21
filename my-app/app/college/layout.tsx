"use client"

import type React from "react"
import { LayoutDashboard, Network, Users, Building, CalendarCheck } from "lucide-react"
import { PortalLayout } from "@/components/portal-layout"
import { useAuth } from "@/contexts/AuthContext"
import type { CollegeAdmin } from "@/lib/auth"

const NAV_ITEMS = [
  { href: "/college", label: "Dashboard", icon: LayoutDashboard },
  { href: "/college/departments", label: "Departments", icon: Network },
  { href: "/college/faculty", label: "Faculty", icon: Users },
  { href: "/college/classrooms", label: "Classrooms", icon: Building },
  { href: "/college/timetables", label: "Timetables", icon: CalendarCheck, highlight: true },
]

export default function CollegeLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const college = user as CollegeAdmin | null

  return (
    <PortalLayout
      role="college_admin"
      homeHref="/college"
      navItems={NAV_ITEMS}
      subtitle={college?.institution_name}
      displayName={college?.name}
    >
      {children}
    </PortalLayout>
  )
}
