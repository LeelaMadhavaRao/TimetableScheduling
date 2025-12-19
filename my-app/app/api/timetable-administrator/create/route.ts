import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/server"
import { generateAdminCreatedEmail } from "@/lib/email-templates"

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
        { success: false, message: "Only system administrators can create timetable administrators" },
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
    if (email) {
      try {
        const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000'}/login/timetable-admin`
        const emailData = generateAdminCreatedEmail({
          adminName: name,
          username,
          password,
          loginUrl
        })

        console.log('📧 Attempting to send email to:', email)
        
        // Use absolute URL for fetch in API routes
        // In development, use localhost; in production, use the actual domain
        const baseUrl = process.env.NODE_ENV === 'production' 
          ? (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://timetable-scheduling.vercel.app')
          : 'http://localhost:3000'
        
        const emailApiUrl = `${baseUrl}/api/send-email`
        
        console.log('📧 Email API URL:', emailApiUrl)
        console.log('📧 Environment:', process.env.NODE_ENV)
        
        const emailResponse = await fetch(emailApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: email,
            subject: emailData.subject,
            html: emailData.html,
            text: emailData.text
          })
        })

        console.log('📧 Email API response status:', emailResponse.status)
        
        if (!emailResponse.ok) {
          const errorText = await emailResponse.text()
          console.error('❌ Email API returned error status:', emailResponse.status)
          console.error('❌ Error response:', errorText)
          throw new Error(`Email API returned status ${emailResponse.status}`)
        }
        
        const emailResult = await emailResponse.json()
        
        if (emailResult.success) {
          console.log('✅ Admin creation email sent successfully to:', email)
          console.log('📬 Message ID:', emailResult.messageId)
        } else {
          console.error('❌ Email API returned error:', emailResult.error || emailResult.message)
        }
      } catch (emailError: any) {
        console.error('❌ Error sending admin creation email:', emailError.message)
        console.error('❌ Full error:', emailError)
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json({
      success: true,
      message: email 
        ? "Administrator created successfully. Welcome email sent."
        : "Administrator created successfully.",
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
