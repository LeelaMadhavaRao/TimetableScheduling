"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { loginFaculty } from "@/lib/auth";
import { GraduationCap, Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";

export default function FacultyLoginPage() {
  const [facultyCode, setFacultyCode] = useState("");
  const [phone, setPhone] = useState("");
  const [showPhone, setShowPhone] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const router = useRouter();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await loginFaculty(facultyCode, phone);
      
      if (result.success && result.session) {
        login(result.session.session_token, 'faculty');
        router.push('/faculty');
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="border-emerald-500/20 bg-slate-900/90 backdrop-blur-xl shadow-2xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <GraduationCap className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-white">Faculty Login</CardTitle>
            <CardDescription className="text-slate-400">
              View your teaching schedule
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="facultyCode" className="text-slate-300">Faculty Code</Label>
                <Input
                  id="facultyCode"
                  type="text"
                  value={facultyCode}
                  onChange={(e) => setFacultyCode(e.target.value.toUpperCase())}
                  placeholder="Enter your faculty code (e.g., F001)"
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500 uppercase"
                  required
                  disabled={isLoading}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-slate-300">Phone Number</Label>
                <div className="relative">
                  <Input
                    id="phone"
                    type={showPhone ? "text" : "password"}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Enter your phone number"
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500 pr-10"
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPhone(!showPhone)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPhone ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
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
                <Link href="/login/timetable-admin">
                  <Button variant="outline" size="sm" className="border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800">
                    Timetable Admin
                  </Button>
                </Link>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-md bg-slate-800/50 border border-slate-700">
              <p className="text-xs text-slate-500 text-center">
                Your username is your <span className="text-emerald-400">Faculty Code</span> and password is your <span className="text-emerald-400">Phone Number</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
