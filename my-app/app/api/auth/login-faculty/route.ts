import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient()
    const body = await request.json()
    const { code, phone } = body

    if (!code || !phone) {
      return NextResponse.json(
        { success: false, message: "Faculty code and phone are required" },
        { status: 400 }
      )
    }

    const { data: faculty, error: facultyError } = await supabase
      .from('faculty')
      .select('id, code, name, phone, email, is_active')
      .eq('code', code.toUpperCase())
      .eq('phone', phone)
      .eq('is_active', true)
      .single()

    if (facultyError || !faculty) {
      return NextResponse.json(
        { success: false, message: "Invalid faculty code or phone number" },
        { status: 401 }
      )
    }

    const sessionToken = generateSessionToken()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    const { data: session, error: sessionError } = await supabase
      .from('user_sessions')
      .insert({
        user_id: faculty.id,
        user_type: 'faculty',
        session_token: sessionToken,
        expires_at: expiresAt
      })
      .select()
      .single()

    if (sessionError) {
      console.error('Session creation error:', sessionError)
      return NextResponse.json(
        { success: false, message: "Failed to create session" },
        { status: 500 }
      )
    }

    await supabase
      .from('faculty')
      .update({ last_login: new Date().toISOString() })
      .eq('id', faculty.id)

    return NextResponse.json({
      success: true,
      message: "Login successful",
      user: { id: faculty.id, code: faculty.code, name: faculty.name },
      session,
      role: 'faculty'
    })

  } catch (error) {
    console.error('Faculty login error:', error)
    return NextResponse.json(
      { success: false, message: "An error occurred during login" },
      { status: 500 }
    )
  }
}

function generateSessionToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}
