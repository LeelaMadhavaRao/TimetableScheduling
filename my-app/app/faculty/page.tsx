"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth, useRequireAuth } from "@/contexts/AuthContext";
import { getSupabaseBrowserClient } from "@/lib/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  GraduationCap, 
  LogOut, 
  Calendar,
  Loader2,
  Clock,
  BookOpen,
  Building,
  AlertCircle,
  Users
} from "lucide-react";
import ClickSpark from "@/components/ClickSpark";

// Days and periods configuration
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

interface TimetableSlot {
  id: string;
  day_of_week: number; // 0=Monday, 5=Saturday
  start_period: number;
  end_period: number;
  section_id: string;
  subject_id: string;
  faculty_id: string;
  classroom_id: string;
  created_by: string | null;
  sections?: { name: string };
  subjects?: { name: string; code: string };
  classrooms?: { name: string; building?: string };
}

interface FacultyInfo {
  id: string;
  code: string;
  name: string;
}

// Generate a color from subject name
function getSubjectColor(subjectName: string): string {
  const colors = [
    'bg-blue-500/20 border-blue-500/50 text-blue-300',
    'bg-green-500/20 border-green-500/50 text-green-300',
    'bg-purple-500/20 border-purple-500/50 text-purple-300',
    'bg-orange-500/20 border-orange-500/50 text-orange-300',
    'bg-pink-500/20 border-pink-500/50 text-pink-300',
    'bg-cyan-500/20 border-cyan-500/50 text-cyan-300',
    'bg-yellow-500/20 border-yellow-500/50 text-yellow-300',
    'bg-red-500/20 border-red-500/50 text-red-300',
    'bg-indigo-500/20 border-indigo-500/50 text-indigo-300',
    'bg-teal-500/20 border-teal-500/50 text-teal-300',
  ];
  
  let hash = 0;
  for (let i = 0; i < subjectName.length; i++) {
    hash = subjectName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export default function FacultyDashboardPage() {
  const { user, logout, isLoading: authLoading } = useAuth();
  const { isLoading: requireAuthLoading } = useRequireAuth(['faculty']);
  
  const [timetableSlots, setTimetableSlots] = useState<TimetableSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string>('all');
  const [hasTimetable, setHasTimetable] = useState(false);
  const [stats, setStats] = useState({
    totalClasses: 0,
    totalLabs: 0,
    uniqueSubjects: 0,
    uniqueSections: 0
  });

  const facultyUser = user as FacultyInfo | null;

  const loadTimetable = useCallback(async () => {
    if (!facultyUser?.id) return;
    
    setIsLoading(true);
    const supabase = getSupabaseBrowserClient();

    try {
      // Step 1: Check the latest timetable job status
      const { data: latestJob, error: jobError } = await supabase
        .from('timetable_jobs')
        .select('id, status')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (jobError) {
        console.error('Error fetching timetable job:', jobError);
      }

      // Step 2: Determine which table to query based on job status
      // If job status is 'completed', fetch from timetable_optimized
      // Otherwise, fetch from timetable_base
      const isOptimized = latestJob?.status === 'completed';
      const tableName = isOptimized ? 'timetable_optimized' : 'timetable_base';
      
      console.log(`[Faculty Timetable] Fetching from ${tableName} (Job status: ${latestJob?.status || 'none'})`);

      // Step 3: Fetch timetable entries for this faculty from the appropriate table
      const { data: slots, error } = await supabase
        .from(tableName)
        .select(`
          *,
          sections(name),
          subjects(name, code),
          classrooms(name, building)
        `)
        .eq('faculty_id', facultyUser.id)
        .order('day_of_week')
        .order('start_period');

      // No error occurred - check if we have data
      if (!error && (!slots || slots.length === 0)) {
        console.log('No timetable found for faculty:', facultyUser.name);
        console.log('This is normal if no timetable has been generated yet.');
        setTimetableSlots([]);
        setHasTimetable(false);
      } else {
        setTimetableSlots(slots);
        setHasTimetable(true);
        
        // Calculate stats
        const labs = slots.filter((s: TimetableSlot) => s.subjects?.code?.includes('L')); // Lab subjects usually have 'L' suffix
        const subjects = new Set(slots.map((s: TimetableSlot) => s.subject_id));
        const sections = new Set(slots.map((s: TimetableSlot) => s.section_id));
        
        setStats({
          totalClasses: slots.length - labs.length,
          totalLabs: labs.length,
          uniqueSubjects: subjects.size,
          uniqueSections: sections.size
        });
      }
    } catch (err) {
      console.error('Error loading timetable:', err);
      setTimetableSlots([]);
      setHasTimetable(false);
    } finally {
      setIsLoading(false);
    }
  }, [facultyUser?.id]);

  useEffect(() => {
    if (!authLoading && !requireAuthLoading && facultyUser) {
      loadTimetable();
    }
  }, [authLoading, requireAuthLoading, facultyUser, loadTimetable]);

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login/faculty';
  };

  // Get timetable data organized by day and period
  const getTimetableGrid = () => {
    const grid: Record<string, Record<number, TimetableSlot | null>> = {};
    
    DAYS.forEach(day => {
      grid[day] = {};
      PERIODS.forEach(period => {
        grid[day][period] = null;
      });
    });

    // Fill in the slots
    timetableSlots.forEach(slot => {
      const dayName = DAYS[slot.day_of_week]; // Convert day_of_week (0-5) to day name
      if (grid[dayName] && slot.start_period) {
        grid[dayName][slot.start_period] = slot;
      }
    });

    return grid;
  };

  const filteredDays = selectedDay === 'all' ? DAYS : [selectedDay];
  const timetableGrid = getTimetableGrid();

  if (authLoading || requireAuthLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900">
      {/* Header */}
      <header className="border-b border-emerald-500/20 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Faculty Dashboard</h1>
              <p className="text-sm text-slate-400">
                Welcome, {facultyUser?.name || 'Faculty'} ({facultyUser?.code})
              </p>
            </div>
          </div>
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
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.totalClasses}</p>
                  <p className="text-xs text-slate-400">Classes/Week</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Building className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.totalLabs}</p>
                  <p className="text-xs text-slate-400">Lab Sessions</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.uniqueSubjects}</p>
                  <p className="text-xs text-slate-400">Subjects</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                  <Users className="h-5 w-5 text-orange-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.uniqueSections}</p>
                  <p className="text-xs text-slate-400">Sections</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Timetable Card */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <Clock className="h-5 w-5 text-emerald-400" />
                My Teaching Schedule
              </CardTitle>
              <CardDescription className="text-slate-400">
                Combined timetable from all departments
              </CardDescription>
            </div>
            <Select value={selectedDay} onValueChange={setSelectedDay}>
              <SelectTrigger className="w-[150px] bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Filter by day" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all" className="text-white hover:bg-slate-700">All Days</SelectItem>
                {DAYS.map(day => (
                  <SelectItem key={day} value={day} className="text-white hover:bg-slate-700">
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
              </div>
            ) : !hasTimetable ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <AlertCircle className="h-16 w-16 mb-4 text-yellow-500/50" />
                <h3 className="text-xl font-semibold text-white mb-2">Timetable Not Generated Yet</h3>
                <p className="text-center max-w-md">
                  Your timetable has not been generated by any administrator yet. 
                  Please check back later or contact your department administrator.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="border border-slate-700 bg-slate-800 px-4 py-3 text-left text-sm font-medium text-slate-300">
                        Day
                      </th>
                      {PERIODS.map(period => (
                        <th 
                          key={period} 
                          className="border border-slate-700 bg-slate-800 px-4 py-3 text-center text-sm font-medium text-slate-300"
                        >
                          Period {period}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDays.map(day => {
                      const daySlots = timetableGrid[day];
                      const skipPeriods = new Set<number>();
                      
                      return (
                        <tr key={day}>
                          <td className="border border-slate-700 bg-slate-800/50 px-4 py-3 font-medium text-white">
                            {day}
                          </td>
                          {PERIODS.map(period => {
                            if (skipPeriods.has(period)) {
                              return null;
                            }
                            
                            const slot = daySlots[period];
                            
                            if (!slot) {
                              return (
                                <td 
                                  key={period}
                                  className="border border-slate-700 px-2 py-2 text-center text-slate-500"
                                >
                                  -
                                </td>
                              );
                            }
                            
                            // Calculate period span and check if it's a lab
                            const periodSpan = slot.end_period - slot.start_period + 1;
                            const isLab = slot.subjects?.code?.includes('L'); // Lab subjects usually have 'L' suffix
                            
                            // Mark subsequent periods to skip if multi-period
                            if (periodSpan > 1) {
                              for (let i = 1; i < periodSpan; i++) {
                                skipPeriods.add(period + i);
                              }
                            }
                            
                            const colorClass = getSubjectColor(slot.subjects?.name || '');
                            
                            return (
                              <td 
                                key={period}
                                colSpan={periodSpan}
                                className={`border border-slate-700 px-2 py-2`}
                              >
                                <div className={`rounded-lg border p-2 ${colorClass}`}>
                                  <p className="font-semibold text-sm truncate">
                                    {slot.subjects?.name || 'Unknown'}
                                  </p>
                                  <p className="text-xs opacity-80 truncate">
                                    {slot.sections?.name} • {slot.classrooms?.name}
                                  </p>
                                  {isLab && (
                                    <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full bg-white/10">
                                      LAB
                                    </span>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Today's Schedule Card */}
        {hasTimetable && (
          <Card className="mt-8 bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Calendar className="h-5 w-5 text-emerald-400" />
                Today&apos;s Schedule
              </CardTitle>
              <CardDescription className="text-slate-400">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const todayDayOfWeek = new Date().getDay() - 1; // getDay() returns 0 for Sunday, we want 0=Monday
                const todaySlots = timetableSlots.filter(s => s.day_of_week === todayDayOfWeek);
                
                if (todayDayOfWeek < 0 || todayDayOfWeek > 5 || todaySlots.length === 0) {
                  return (
                    <div className="text-center py-8 text-slate-400">
                      <GraduationCap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No classes scheduled for today</p>
                    </div>
                  );
                }
                
                return (
                  <div className="space-y-3">
                    {todaySlots.map(slot => {
                      const colorClass = getSubjectColor(slot.subjects?.name || '');
                      const isLab = slot.subjects?.code?.includes('L');
                      return (
                        <div 
                          key={slot.id}
                          className={`rounded-lg border p-4 ${colorClass}`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold">{slot.subjects?.name}</p>
                              <p className="text-sm opacity-80">
                                {slot.sections?.name} • Room: {slot.classrooms?.name}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">
                                Period {slot.start_period}{slot.end_period > slot.start_period ? ` - ${slot.end_period}` : ''}
                              </p>
                              {isLab && (
                                <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-white/10">
                                  LAB
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
