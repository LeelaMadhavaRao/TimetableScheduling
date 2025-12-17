"use client"

import type React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Home, Users, BookOpen, Building, Layers, Calendar, Menu, X, ChevronRight, LayoutDashboard } from "lucide-react"
import { useState } from "react"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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
    const breadcrumbs = [{ label: "Home", href: "/" }]
    
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 shadow-sm transition-all duration-300">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link 
              href="/admin" 
              className="flex items-center gap-2 text-xl font-bold text-foreground hover:text-primary transition-colors group"
            >
              <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-all duration-300">
                <Calendar className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
              </div>
              <span className="hidden sm:inline">Timetable System</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              <Link href="/">
                <Button variant="ghost" size="sm" className="hover:bg-primary/10 transition-all duration-200">
                  <Home className="w-4 h-4 mr-2" />
                  Home
                </Button>
              </Link>
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
                          ? "bg-success/10 hover:bg-success/20 text-success hover:text-success transition-all duration-200"
                          : active
                          ? "shadow-sm"
                          : "hover:bg-primary/10 transition-all duration-200"
                      }
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {item.label}
                    </Button>
                  </Link>
                )
              })}
            </nav>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t bg-card animate-in slide-in-from-top-4 duration-300">
            <div className="container mx-auto px-4 py-4 space-y-2">
              <Link href="/" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" size="sm" className="w-full justify-start">
                  <Home className="w-4 h-4 mr-2" />
                  Home
                </Button>
              </Link>
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
                          ? "w-full justify-start bg-success/10 text-success"
                          : "w-full justify-start"
                      }
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {item.label}
                    </Button>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </header>

      {/* Breadcrumbs */}
      {pathname !== "/admin" && (
        <div className="border-b bg-muted/30 backdrop-blur">
          <div className="container mx-auto px-4 py-3">
            <nav className="flex items-center gap-2 text-sm text-muted-foreground">
              {getBreadcrumbs().map((crumb, index) => (
                <div key={crumb.href} className="flex items-center gap-2">
                  {index > 0 && <ChevronRight className="w-4 h-4" />}
                  <Link
                    href={crumb.href}
                    className={
                      index === getBreadcrumbs().length - 1
                        ? "text-foreground font-medium"
                        : "hover:text-foreground transition-colors"
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
      <footer className="border-t bg-card/50 backdrop-blur mt-auto">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>Timetable Scheduling System - ILP & GA Optimization</p>
        </div>
      </footer>
    </div>
  )
}
