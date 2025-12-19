import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient()
    const body = await request.json()
    const { username, password } = body

    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: "Username and password are required" },
        { status: 400 }
      )
    }

    // Query timetable administrator
    const { data: adminData, error: adminError } = await supabase
      .from('timetable_administrators')
      .select('id, username, name, email, phone, institution_name, is_active, password_hash')
      .eq('username', username)
      .eq('is_active', true)
      .single()

    if (adminError || !adminData) {
      return NextResponse.json(
        { success: false, message: "Invalid username or password" },
        { status: 401 }
      )
    }

    // Verify password using RPC
    const { data: isValid, error: verifyError } = await supabase
      .rpc('verify_password', { 
        stored_hash: adminData.password_hash, 
        input_password: password 
      })

    if (verifyError) {
      console.error('Password verification error:', verifyError)
      return NextResponse.json(
        { success: false, message: "Authentication error. Please ensure database functions are set up." },
        { status: 500 }
      )
    }

    if (!isValid) {
      return NextResponse.json(
        { success: false, message: "Invalid username or password" },
        { status: 401 }
      )
    }

    // Generate session token
    const sessionToken = generateSessionToken()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    // Create session
    const { data: session, error: sessionError } = await supabase
      .from('user_sessions')
      .insert({
        user_id: adminData.id,
        user_type: 'timetable_admin',
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

    // Update last login
    await supabase
      .from('timetable_administrators')
      .update({ last_login: new Date().toISOString() })
      .eq('id', adminData.id)

    const { password_hash, ...safeAdmin } = adminData

    return NextResponse.json({
      success: true,
      message: "Login successful",
      user: safeAdmin,
      session,
      role: 'timetable_admin'
    })

  } catch (error) {
    console.error('Timetable admin login error:', error)
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
