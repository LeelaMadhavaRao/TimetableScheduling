import type { NextRequest } from "next/server"
import type { getSupabaseServerClient } from "@/lib/server"
import type { UserRole } from "@/lib/auth"

// Resolves the caller of an API route from the session cookie. Returns null unless the
// session is valid and belongs to one of `roles`.
export async function getRequestSession(
  request: NextRequest,
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  roles: UserRole[],
): Promise<{ userId: string; role: UserRole } | null> {
  const sessionToken = request.cookies.get('timetable_session_token')?.value
  if (!sessionToken) return null

  const { data: session } = await supabase
    .from('user_sessions')
    .select('user_id, user_type')
    .eq('session_token', sessionToken)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (!session || !roles.includes(session.user_type as UserRole)) return null
  return { userId: session.user_id, role: session.user_type as UserRole }
}

export function generateSessionToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}
