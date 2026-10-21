import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/server"
import { generateSessionToken } from "@/lib/api-session"

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

    // Query department administrator
    const { data: adminData, error: adminError } = await supabase
      .from('department_admins')
      .select('id, username, name, email, phone, department_id, college_id, is_active, password_hash')
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

    // A deactivated college disables its department accounts too
    const { data: college } = await supabase
      .from('timetable_administrators')
      .select('is_active')
      .eq('id', adminData.college_id)
      .single()

    if (!college?.is_active) {
      return NextResponse.json(
        { success: false, message: "Your college account is inactive. Contact your college administrator." },
        { status: 403 }
      )
    }

    const sessionToken = generateSessionToken()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    const { data: session, error: sessionError } = await supabase
      .from('user_sessions')
      .insert({
        user_id: adminData.id,
        user_type: 'department_admin',
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
      .from('department_admins')
      .update({ last_login: new Date().toISOString() })
      .eq('id', adminData.id)

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, ...safeAdmin } = adminData

    return NextResponse.json({
      success: true,
      message: "Login successful",
      user: safeAdmin,
      session,
      role: 'department_admin'
    })

  } catch (error) {
    console.error('Department admin login error:', error)
    return NextResponse.json(
      { success: false, message: "An error occurred during login" },
      { status: 500 }
    )
  }
}
