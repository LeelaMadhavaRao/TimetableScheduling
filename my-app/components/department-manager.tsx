"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash2, UserPlus, KeyRound, Loader2, CheckCircle, XCircle, Pencil } from "lucide-react"
import { getSupabaseBrowserClient } from "@/lib/client"
import { saveDepartmentAdmin, deleteDepartmentAdmin } from "@/lib/auth"

export interface DepartmentRow {
  id: string
  name: string
  code: string
  facultyCount: number
  sectionCount: number
  admin: {
    id: string
    username: string
    name: string
    email: string | null
    phone: string | null
    is_active: boolean
    last_login: string | null
  } | null
}

interface DepartmentManagerProps {
  collegeId: string
  departments: DepartmentRow[]
}

type AccountForm = { id?: string; departmentId: string; username: string; password: string; name: string; email: string; phone: string }

export function DepartmentManager({ collegeId, departments }: DepartmentManagerProps) {
  const router = useRouter()
  const [deptOpen, setDeptOpen] = useState(false)
  const [deptForm, setDeptForm] = useState({ name: "", code: "" })
  const [account, setAccount] = useState<AccountForm | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<DepartmentRow | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const flash = (message: string) => {
    setNotice(message)
    setTimeout(() => setNotice(null), 3500)
  }

  const createDepartment = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase.from("departments").insert({
      name: deptForm.name.trim(),
      code: deptForm.code.trim().toUpperCase(),
      college_id: collegeId,
      created_by: collegeId,
    })
    setBusy(false)
    if (error) {
      setError(error.code === "23505" ? "A department with this name or code already exists" : error.message)
      return
    }
    setDeptOpen(false)
    setDeptForm({ name: "", code: "" })
    flash("Department created")
    router.refresh()
  }

  const removeDepartment = async () => {
    if (!confirmDelete) return
    setBusy(true)
    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase.from("departments").delete().eq("id", confirmDelete.id).eq("college_id", collegeId)
    setBusy(false)
    setConfirmDelete(null)
    if (error) {
      setError(error.message)
      return
    }
    flash("Department removed")
    router.refresh()
  }

  const submitAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!account) return
    setBusy(true)
    setError(null)
    const result = await saveDepartmentAdmin({
      id: account.id,
      username: account.id ? undefined : account.username.trim(),
      password: account.password || undefined,
      name: account.name.trim(),
      email: account.email,
      phone: account.phone,
      department_id: account.departmentId,
    })
    setBusy(false)
    if (!result.success) {
      setError(result.message)
      return
    }
    setAccount(null)
    flash(result.message)
    router.refresh()
  }

  const toggleActive = async (row: DepartmentRow) => {
    if (!row.admin) return
    const result = await saveDepartmentAdmin({ id: row.admin.id, name: row.admin.name, is_active: !row.admin.is_active })
    if (!result.success) setError(result.message)
    else router.refresh()
  }

  const removeAccount = async (row: DepartmentRow) => {
    if (!row.admin) return
    const result = await deleteDepartmentAdmin(row.admin.id)
    if (!result.success) setError(result.message)
    else {
      flash(result.message)
      router.refresh()
    }
  }

  return (
    <div className="space-y-4">
      {notice && <div className="p-3 rounded-md bg-green-500/10 border border-green-500/20 text-green-400 text-sm">{notice}</div>}
      {error && !account && !deptOpen && (
        <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
      )}

      <div className="flex justify-end">
        <Button onClick={() => { setError(null); setDeptOpen(true) }} className="bg-gradient-to-r from-blue-600 to-cyan-600">
          <Plus className="w-4 h-4 mr-2" />
          Add Department
        </Button>
      </div>

      {departments.length === 0 ? (
        <div className="text-center py-12 text-slate-400">No departments yet. Add your first department to create its administrator account.</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-slate-700">
              <TableHead className="text-slate-400">Department</TableHead>
              <TableHead className="text-slate-400">Faculty / Sections</TableHead>
              <TableHead className="text-slate-400">Administrator account</TableHead>
              <TableHead className="text-slate-400 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {departments.map((row) => (
              <TableRow key={row.id} className="border-slate-700">
                <TableCell>
                  <div className="font-medium text-white">{row.code}</div>
                  <div className="text-xs text-slate-400">{row.name}</div>
                </TableCell>
                <TableCell className="text-slate-300">
                  {row.facultyCount} faculty • {row.sectionCount} sections
                </TableCell>
                <TableCell>
                  {row.admin ? (
                    <div className="space-y-1">
                      <div className="text-white text-sm">{row.admin.name} <span className="text-slate-400">({row.admin.username})</span></div>
                      <div className="flex items-center gap-2">
                        {row.admin.is_active ? (
                          <Badge className="bg-green-500/20 text-green-400 border-0"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>
                        ) : (
                          <Badge className="bg-red-500/20 text-red-400 border-0"><XCircle className="w-3 h-3 mr-1" />Inactive</Badge>
                        )}
                        <span className="text-xs text-slate-500">
                          {row.admin.last_login ? `last login ${new Date(row.admin.last_login).toLocaleDateString()}` : "never logged in"}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-amber-400 text-sm">No account yet</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2 flex-wrap">
                    {row.admin ? (
                      <>
                        <Button size="sm" variant="outline" className="border-slate-600 text-slate-200" title="Edit account / reset password"
                          onClick={() => { setError(null); setAccount({ id: row.admin!.id, departmentId: row.id, username: row.admin!.username, password: "", name: row.admin!.name, email: row.admin!.email || "", phone: row.admin!.phone || "" }) }}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" className="border-slate-600 text-slate-200" onClick={() => toggleActive(row)}>
                          {row.admin.is_active ? "Deactivate" : "Activate"}
                        </Button>
                        <Button size="sm" variant="outline" className="border-red-500/50 text-red-400" title="Remove account" onClick={() => removeAccount(row)}>
                          <KeyRound className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => { setError(null); setAccount({ departmentId: row.id, username: `${row.code.toLowerCase()}_admin`, password: "", name: "", email: "", phone: "" }) }}>
                        <UserPlus className="w-4 h-4 mr-1" />
                        Create Account
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="border-red-500/50 text-red-400" title="Delete department" onClick={() => setConfirmDelete(row)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={deptOpen} onOpenChange={setDeptOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Add Department</DialogTitle>
            <DialogDescription className="text-slate-400">Departments own subjects and sections; you create one administrator account per department.</DialogDescription>
          </DialogHeader>
          <form onSubmit={createDepartment} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="dept-name" className="text-slate-300">Name</Label>
              <Input id="dept-name" required value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} placeholder="Computer Science & Engineering" className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dept-code" className="text-slate-300">Code</Label>
              <Input id="dept-code" required value={deptForm.code} onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })} placeholder="CSE" className="bg-slate-800 border-slate-700 text-white" />
            </div>
            {error && <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
            <DialogFooter>
              <Button type="button" variant="outline" className="border-slate-700" onClick={() => setDeptOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!account} onOpenChange={(open) => !open && setAccount(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>{account?.id ? "Edit Department Administrator" : "Create Department Administrator"}</DialogTitle>
            <DialogDescription className="text-slate-400">
              {account?.id ? "Leave the password blank to keep it. Changing it signs the administrator out." : "This person will generate timetables for the department's sections."}
            </DialogDescription>
          </DialogHeader>
          {account && (
            <form onSubmit={submitAccount} className="space-y-4">
              <div className="grid gap-2">
                <Label className="text-slate-300">Full name</Label>
                <Input required value={account.name} onChange={(e) => setAccount({ ...account, name: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
              </div>
              <div className="grid gap-2">
                <Label className="text-slate-300">Username</Label>
                <Input required disabled={!!account.id} value={account.username} onChange={(e) => setAccount({ ...account, username: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
              </div>
              <div className="grid gap-2">
                <Label className="text-slate-300">Password {account.id && "(optional)"}</Label>
                <Input type="password" required={!account.id} minLength={6} value={account.password} onChange={(e) => setAccount({ ...account, password: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label className="text-slate-300">Email</Label>
                  <Input type="email" value={account.email} onChange={(e) => setAccount({ ...account, email: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
                </div>
                <div className="grid gap-2">
                  <Label className="text-slate-300">Phone</Label>
                  <Input value={account.phone} onChange={(e) => setAccount({ ...account, phone: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
                </div>
              </div>
              {error && <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
              <DialogFooter>
                <Button type="button" variant="outline" className="border-slate-700" onClick={() => setAccount(null)}>Cancel</Button>
                <Button type="submit" disabled={busy}>{busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{account.id ? "Save" : "Create Account"}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Delete {confirmDelete?.code}?</DialogTitle>
            <DialogDescription className="text-slate-400">
              This removes the department, its administrator account and all of its timetable runs. Its sections and subjects stay but lose their department. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="border-slate-700" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="destructive" disabled={busy} onClick={removeDepartment}>{busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
