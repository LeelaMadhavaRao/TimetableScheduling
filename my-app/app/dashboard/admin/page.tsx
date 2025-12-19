"use client";

import { useEffect, useState } from "react";
import { useAuth, useRequireAuth } from "@/contexts/AuthContext";
import { 
  getTimetableAdministrators, 
  createTimetableAdministrator, 
  updateTimetableAdministrator,
  deleteTimetableAdministrator,
  TimetableAdministrator 
} from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Shield, 
  Plus, 
  Edit, 
  Trash2, 
  LogOut, 
  Users, 
  Calendar,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  UserPlus,
  Bell
} from "lucide-react";
import ClickSpark from "@/components/ClickSpark";
import Link from "next/link";

export default function AdminDashboardPage() {
  const { user, logout, isLoading: authLoading } = useAuth();
  const { isLoading: requireAuthLoading } = useRequireAuth(['admin']);
  
  const [administrators, setAdministrators] = useState<TimetableAdministrator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<TimetableAdministrator | null>(null);
  const [deleteAdmin, setDeleteAdmin] = useState<TimetableAdministrator | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    name: "",
    email: "",
    phone: "",
    institution_name: ""
  });

  const loadAdministrators = async () => {
    setIsLoading(true);
    const data = await getTimetableAdministrators();
    setAdministrators(data);
    setIsLoading(false);
  };

  useEffect(() => {
    if (!authLoading && !requireAuthLoading) {
      loadAdministrators();
    }
  }, [authLoading, requireAuthLoading]);

  const handleOpenDialog = (admin?: TimetableAdministrator) => {
    if (admin) {
      setEditingAdmin(admin);
      setFormData({
        username: admin.username,
        password: "", // Don't populate password for security
        name: admin.name,
        email: admin.email || "",
        phone: admin.phone || "",
        institution_name: admin.institution_name || ""
      });
    } else {
      setEditingAdmin(null);
      setFormData({
        username: "",
        password: "",
        name: "",
        email: "",
        phone: "",
        institution_name: ""
      });
    }
    setFormError("");
    setFormSuccess("");
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingAdmin(null);
    setFormError("");
    setFormSuccess("");
    setShowPassword(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");
    setIsSaving(true);

    try {
      if (editingAdmin) {
        // Update existing admin
        const updateData: Parameters<typeof updateTimetableAdministrator>[1] = {
          name: formData.name,
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          institution_name: formData.institution_name || undefined
        };
        
        if (formData.password) {
          updateData.password = formData.password;
        }
        
        const result = await updateTimetableAdministrator(editingAdmin.id, updateData);
        
        if (result.success) {
          setFormSuccess("Administrator updated successfully!");
          await loadAdministrators();
          setTimeout(() => handleCloseDialog(), 1500);
        } else {
          setFormError(result.message);
        }
      } else {
        // Create new admin
        if (!formData.password) {
          setFormError("Password is required for new administrators");
          setIsSaving(false);
          return;
        }
        
        const adminUser = user as { id: string };
        const result = await createTimetableAdministrator(adminUser.id, {
          username: formData.username,
          password: formData.password,
          name: formData.name,
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          institution_name: formData.institution_name || undefined
        });
        
        if (result.success) {
          setFormSuccess("Administrator created successfully!");
          await loadAdministrators();
          setTimeout(() => handleCloseDialog(), 1500);
        } else {
          setFormError(result.message);
        }
      }
    } catch (err) {
      setFormError("An unexpected error occurred");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteAdmin) return;
    
    setIsSaving(true);
    try {
      const result = await deleteTimetableAdministrator(deleteAdmin.id);
      if (result.success) {
        await loadAdministrators();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
      setIsDeleteDialogOpen(false);
      setDeleteAdmin(null);
    }
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login/admin';
  };

  if (authLoading || requireAuthLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  const adminUser = user as { name: string } | null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="border-b border-purple-500/20 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Admin Dashboard</h1>
              <p className="text-sm text-slate-400">Welcome, {adminUser?.name || 'Admin'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard/admin/registration-requests">
              <Button 
                variant="outline" 
                className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Registration Requests
              </Button>
            </Link>
            <ClickSpark sparkColor="#ef4444">
              <Button 
                variant="outline" 
                onClick={handleLogout}
                className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </ClickSpark>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Users className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{administrators.length}</p>
                  <p className="text-sm text-slate-400">Timetable Administrators</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {administrators.filter(a => a.is_active).length}
                  </p>
                  <p className="text-sm text-slate-400">Active Administrators</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {administrators.filter(a => a.last_login).length}
                  </p>
                  <p className="text-sm text-slate-400">Have Logged In</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Administrators List */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-white">Timetable Administrators</CardTitle>
              <CardDescription className="text-slate-400">
                Manage users who can create and manage timetables
              </CardDescription>
            </div>
            <ClickSpark sparkColor="#22c55e">
              <Button 
                onClick={() => handleOpenDialog()}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Administrator
              </Button>
            </ClickSpark>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
              </div>
            ) : administrators.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No timetable administrators yet</p>
                <p className="text-sm">Click &quot;Add Administrator&quot; to create one</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700 hover:bg-slate-800/50">
                    <TableHead className="text-slate-400">Name</TableHead>
                    <TableHead className="text-slate-400">Username</TableHead>
                    <TableHead className="text-slate-400">Institution</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                    <TableHead className="text-slate-400">Last Login</TableHead>
                    <TableHead className="text-slate-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {administrators.map((admin) => (
                    <TableRow key={admin.id} className="border-slate-700 hover:bg-slate-800/50">
                      <TableCell className="text-white font-medium">{admin.name}</TableCell>
                      <TableCell className="text-slate-300">{admin.username}</TableCell>
                      <TableCell className="text-slate-300">{admin.institution_name || '-'}</TableCell>
                      <TableCell>
                        {admin.is_active ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-400">
                            <CheckCircle className="h-3 w-3" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-red-500/20 text-red-400">
                            <XCircle className="h-3 w-3" /> Inactive
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-400">
                        {admin.last_login 
                          ? new Date(admin.last_login).toLocaleDateString()
                          : 'Never'
                        }
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <ClickSpark sparkColor="#3b82f6">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleOpenDialog(admin)}
                              className="border-slate-600 text-slate-300 hover:text-white hover:bg-slate-700"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </ClickSpark>
                          <ClickSpark sparkColor="#ef4444">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setDeleteAdmin(admin);
                                setIsDeleteDialogOpen(true);
                              }}
                              className="border-red-500/50 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </ClickSpark>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>
              {editingAdmin ? 'Edit Administrator' : 'Add New Administrator'}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {editingAdmin 
                ? 'Update administrator details. Leave password blank to keep existing.'
                : 'Create a new timetable administrator account.'
              }
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name" className="text-slate-300">Full Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white"
                  required
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="username" className="text-slate-300">Username</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white"
                  required
                  disabled={!!editingAdmin}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="password" className="text-slate-300">
                  Password {editingAdmin && '(leave blank to keep existing)'}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="bg-slate-800 border-slate-700 text-white pr-10"
                    required={!editingAdmin}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="email" className="text-slate-300">Email (optional)</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="phone" className="text-slate-300">Phone (optional)</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="institution_name" className="text-slate-300">Institution Name (optional)</Label>
                <Input
                  id="institution_name"
                  value={formData.institution_name}
                  onChange={(e) => setFormData({ ...formData, institution_name: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>

              {formError && (
                <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {formError}
                </div>
              )}
              
              {formSuccess && (
                <div className="p-3 rounded-md bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
                  {formSuccess}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleCloseDialog}
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                className="bg-gradient-to-r from-purple-600 to-pink-600"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  editingAdmin ? 'Update' : 'Create'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Delete Administrator</DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to delete <span className="text-white font-medium">{deleteAdmin?.name}</span>? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsDeleteDialogOpen(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isSaving}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
