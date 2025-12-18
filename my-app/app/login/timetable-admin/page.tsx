"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { loginTimetableAdmin } from "@/lib/auth";
import { Calendar, Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";

export default function TimetableAdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const router = useRouter();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await loginTimetableAdmin(username, password);
      
      if (result.success && result.session) {
        await login(result.session.session_token, 'timetable_admin');
        router.push('/admin');
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="border-blue-500/20 bg-slate-900/90 backdrop-blur-xl shadow-2xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Calendar className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-white">Timetable Admin Login</CardTitle>
            <CardDescription className="text-slate-400">
              Manage schedules and generate timetables
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-slate-300">Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500"
                  required
                  disabled={isLoading}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500 pr-10"
                    required
                    disabled={isLoading}
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

              {error && (
                <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center space-y-2">
              <p className="text-slate-500 text-sm">Other login options:</p>
              <div className="flex gap-2 justify-center">
                <Link href="/login/admin">
                  <Button variant="outline" size="sm" className="border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800">
                    System Admin
                  </Button>
                </Link>
                <Link href="/login/faculty">
                  <Button variant="outline" size="sm" className="border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800">
                    Faculty
                  </Button>
                </Link>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-md bg-slate-800/50 border border-slate-700">
              <p className="text-xs text-slate-500 text-center">
                Contact your system administrator if you don&apos;t have credentials
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
