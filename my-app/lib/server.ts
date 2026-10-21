import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function getSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Ignore errors in Server Components
        }
      },
    },
  })
}

// Validated session of the current request (role taken from the session row, not the cookie)
async function getCurrentSession(expectedRole: string): Promise<{ userId: string } | null> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('timetable_session_token')?.value
  if (!sessionToken) return null

  const supabase = await getSupabaseServerClient()
  const { data: session } = await supabase
    .from('user_sessions')
    .select('user_id, user_type, expires_at')
    .eq('session_token', sessionToken)
    .eq('user_type', expectedRole)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  return session ? { userId: session.user_id } : null
}

// Current college administrator; their id is the college id
export async function getCurrentCollegeAdminId(): Promise<string | null> {
  const session = await getCurrentSession('college_admin')
  return session?.userId || null
}

export interface CurrentDepartmentAdmin {
  id: string
  departmentId: string
  collegeId: string
  departmentName: string
  departmentCode: string
}

// Current department administrator with the department and college they act for
export async function getCurrentDepartmentAdmin(): Promise<CurrentDepartmentAdmin | null> {
  const session = await getCurrentSession('department_admin')
  if (!session) return null

  const supabase = await getSupabaseServerClient()
  const { data } = await supabase
    .from('department_admins')
    .select('id, department_id, college_id, departments(name, code)')
    .eq('id', session.userId)
    .eq('is_active', true)
    .maybeSingle()
  if (!data) return null

  const department = data.departments as unknown as { name: string; code: string } | null
  return {
    id: data.id,
    departmentId: data.department_id,
    collegeId: data.college_id,
    departmentName: department?.name || '',
    departmentCode: department?.code || '',
  }
}
