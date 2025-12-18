"use client"

import type React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Home, Users, BookOpen, Building, Layers, Calendar, Menu, X, ChevronRight, LayoutDashboard, LogOut, Loader2 } from "lucide-react"
import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import ClickSpark from "@/components/ClickSpark"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { user, role, isLoading, isAuthenticated, logout } = useAuth()
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated || role !== 'timetable_admin') {
        router.push('/login/timetable-admin')
      } else {
        setIsCheckingAuth(false)
      }
    }
  }, [isLoading, isAuthenticated, role, router])

  const handleLogout = async () => {
    await logout()
    router.push('/login/timetable-admin')
  }

  const timetableAdmin = user as { name?: string; institution_name?: string } | null

  const navItems = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/faculty", label: "Faculty", icon: Users },
    { href: "/admin/subjects", label: "Subjects", icon: BookOpen },
    { href: "/admin/classrooms", label: "Classrooms", icon: Building },
    { href: "/admin/sections", label: "Sections", icon: Layers },
    { href: "/admin/generate", label: "Generate", icon: Calendar, highlight: true },
  ]

  const getBreadcrumbs = () => {
    const paths = pathname.split("/").filter(Boolean)
    const breadcrumbs: { label: string; href: string }[] = []
    
    let currentPath = ""
    paths.forEach((path) => {
      currentPath += `/${path}`
      const navItem = navItems.find(item => item.href === currentPath)
      breadcrumbs.push({
        label: navItem?.label || path.charAt(0).toUpperCase() + path.slice(1),
        href: currentPath
      })
    })
    
    return breadcrumbs
  }

  const isActive = (href: string) => pathname === href

  if (isLoading || isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-blue-500/20 bg-slate-900/90 backdrop-blur-xl shadow-2xl transition-all duration-300">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link 
              href="/admin" 
              className="flex items-center gap-2 text-xl font-bold text-white hover:text-blue-400 transition-colors group"
            >
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 group-hover:shadow-lg group-hover:shadow-blue-500/50 transition-all duration-300">
                <Calendar className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
              </div>
              <div className="hidden sm:block">
                <span className="block">Timetable System</span>
                {timetableAdmin?.institution_name && (
                  <span className="block text-xs font-normal text-slate-400">
                    {timetableAdmin.institution_name}
                  </span>
                )}
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)
                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={active ? "default" : "ghost"}
                      size="sm"
                      className={
                        item.highlight && !active
                          ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 border border-emerald-500/20 transition-all duration-200"
                          : active
                          ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30"
                          : "text-slate-300 hover:text-white hover:bg-blue-500/10 transition-all duration-200"
                      }
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {item.label}
                    </Button>
                  </Link>
                )
              })}
              <div className="ml-4 pl-4 border-l border-blue-500/20 flex items-center gap-2">
                <span className="text-sm text-slate-400 hidden lg:inline">
                  {timetableAdmin?.name}
                </span>
                <ClickSpark sparkColor="#ef4444">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleLogout}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </Button>
                </ClickSpark>
              </div>
            </nav>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden text-white hover:text-blue-400 hover:bg-blue-500/10"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-blue-500/20 bg-slate-900/95 backdrop-blur-xl animate-in slide-in-from-top-4 duration-300">
            <div className="container mx-auto px-4 py-4 space-y-2">
              <div className="pb-2 mb-2 border-b border-blue-500/20">
                <p className="text-sm font-medium text-white">{timetableAdmin?.name}</p>
                {timetableAdmin?.institution_name && (
                  <p className="text-xs text-slate-400">{timetableAdmin.institution_name}</p>
                )}
              </div>
              {navItems.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)
                return (
                  <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)}>
                    <Button
                      variant={active ? "default" : "ghost"}
                      size="sm"
                      className={
                        item.highlight && !active
                          ? "w-full justify-start bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : active
                          ? "w-full justify-start bg-blue-500 text-white"
                          : "w-full justify-start text-slate-300 hover:text-white hover:bg-blue-500/10"
                      }
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {item.label}
                    </Button>
                  </Link>
                )
              })}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* Breadcrumbs */}
      {pathname !== "/admin" && (
        <div className="border-b border-blue-500/20 bg-slate-900/50 backdrop-blur">
          <div className="container mx-auto px-4 py-3">
            <nav className="flex items-center gap-2 text-sm text-slate-400">
              {getBreadcrumbs().map((crumb, index) => (
                <div key={crumb.href} className="flex items-center gap-2">
                  {index > 0 && <ChevronRight className="w-4 h-4" />}
                  <Link
                    href={crumb.href}
                    className={
                      index === getBreadcrumbs().length - 1
                        ? "text-white font-medium"
                        : "hover:text-white transition-colors"
                    }
                  >
                    {crumb.label}
                  </Link>
                </div>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 animate-in fade-in duration-500">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-blue-500/20 bg-slate-900/50 backdrop-blur mt-auto">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-slate-400">
          <p>Timetable Scheduling System - ILP & GA Optimization</p>
        </div>
      </footer>
    </div>
  )
}
