import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/server"
import { generateAdminCreatedEmail } from "@/lib/email-templates"
import { appBaseUrl, sendMail } from "@/lib/mailer"

// Create timetable administrator (System Admin only)
export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient()

    // Get admin credentials from cookies
    const cookies = request.cookies
    const sessionToken = cookies.get('timetable_session_token')?.value

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      )
    }

    // Validate session and get user role
    const { data: session } = await supabase
      .from('user_sessions')
      .select('user_id, user_type')
      .eq('session_token', sessionToken)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (!session || session.user_type !== 'admin') {
      return NextResponse.json(
        { success: false, message: "Only system administrators can create college administrators" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { username, password, name, email, phone, institution_name } = body

    if (!username || !password || !name) {
      return NextResponse.json(
        { success: false, message: "Username, password, and name are required" },
        { status: 400 }
      )
    }

    // Hash password
    const { data: hashedPassword, error: hashError } = await supabase
      .rpc('hash_password', { input_password: password })

    if (hashError || !hashedPassword) {
      console.error("Password hash error:", hashError)
      return NextResponse.json(
        { success: false, message: "Failed to hash password" },
        { status: 500 }
      )
    }

    // Create timetable administrator
    const { data: newAdmin, error: insertError } = await supabase
      .from('timetable_administrators')
      .insert({
        username,
        password_hash: hashedPassword,
        name,
        email: email || null,
        phone: phone || null,
        institution_name: institution_name || null,
        created_by: session.user_id
      })
      .select('id, username, name, email, phone, institution_name, is_active, created_by, created_at')
      .single()

    if (insertError) {
      console.error("Insert admin error:", insertError)

      if (insertError.code === '23505') {
        return NextResponse.json(
          { success: false, message: "Username already exists" },
          { status: 409 }
        )
      }

      return NextResponse.json(
        { success: false, message: insertError.message || "Failed to create administrator" },
        { status: 500 }
      )
    }

    // Send welcome email with credentials
    let emailResult: { sent: boolean; error?: string } | null = null
    if (email) {
      const emailData = generateAdminCreatedEmail({
        adminName: name,
        username,
        password,
        loginUrl: `${appBaseUrl(request)}/login/college-admin`,
      })
      emailResult = await sendMail({ to: email, subject: emailData.subject, html: emailData.html, text: emailData.text })
    }

    return NextResponse.json({
      success: true,
      message: !emailResult
        ? "Administrator created successfully."
        : emailResult.sent
          ? "Administrator created successfully. Welcome email sent."
          : `Administrator created, but the welcome email could not be sent (${emailResult.error}). Share the credentials manually.`,
      data: newAdmin
    })

  } catch (error) {
    console.error("Create timetable administrator error:", error)
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    )
  }
}
