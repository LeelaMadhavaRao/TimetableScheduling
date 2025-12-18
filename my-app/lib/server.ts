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

// Get current timetable administrator ID from session
export async function getCurrentAdminId(): Promise<string | null> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('timetable_session_token')?.value
  const userRole = cookieStore.get('timetable_user_role')?.value
  
  console.log('[getCurrentAdminId] Session Token:', sessionToken ? 'EXISTS' : 'MISSING')
  console.log('[getCurrentAdminId] User Role:', userRole)
  
  if (!sessionToken || userRole !== 'timetable_admin') {
    console.log('[getCurrentAdminId] Early return - no session or wrong role')
    return null
  }

  const supabase = await getSupabaseServerClient()
  
  // Validate session and get user ID
  const { data: session, error } = await supabase
    .from('user_sessions')
    .select('user_id, user_type, expires_at')
    .eq('session_token', sessionToken)
    .eq('user_type', 'timetable_admin')
    .gt('expires_at', new Date().toISOString())
    .single()
  
  console.log('[getCurrentAdminId] Session query result:', session)
  console.log('[getCurrentAdminId] Session query error:', error)
  
  return session?.user_id || null
}
