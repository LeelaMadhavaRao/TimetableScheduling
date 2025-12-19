import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient, getCurrentAdminId } from "@/lib/server"
import { generateRequestApprovedEmail } from "@/lib/email-templates"
import nodemailer from "nodemailer"

// Create email transporter
function createEmailTransporter() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  })
}

// Approve registration request
export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient()
    
    // Get admin ID from session (must be system admin)
    const adminId = await getCurrentAdminId()
    
    // For this endpoint, we need to check if user is a SYSTEM admin, not timetable admin
    // Let's get it from cookies directly
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
        { success: false, message: "Only system administrators can approve requests" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { requestId } = body

    if (!requestId) {
      return NextResponse.json(
        { success: false, message: "Request ID is required" },
        { status: 400 }
      )
    }

    // Call RPC function to approve request
    const { data, error } = await supabase.rpc(
      "approve_registration_request",
      {
        p_request_id: requestId,
        p_admin_id: session.user_id
      }
    )

    if (error) {
      console.error("Approve request error:", error)
      return NextResponse.json(
        { success: false, message: error.message || "Failed to approve request" },
        { status: 500 }
      )
    }

    // Check if the RPC returned success
    if (data && typeof data === 'object' && 'success' in data && !data.success) {
      return NextResponse.json(data, { status: 400 })
    }

    // Send approval email with credentials directly using nodemailer
    if (data && data.username && data.email && data.name) {
      try {
        console.log('📧 Attempting to send approval email to:', data.email)
        
        // Validate email configuration
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
          console.error('❌ Email configuration not set')
          console.error('EMAIL_USER:', process.env.EMAIL_USER ? 'SET' : 'NOT SET')
          console.error('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? 'SET' : 'NOT SET')
          throw new Error('Email configuration not set')
        }
        
        const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000'}/login/timetable-admin`
        const emailData = generateRequestApprovedEmail({
          name: data.name,
          username: data.username,
          password: data.temp_password || data.password,
          loginUrl
        })

        console.log('📧 Creating email transporter...')
        const transporter = createEmailTransporter()
        
        console.log('📧 Sending approval email...')
        const info = await transporter.sendMail({
          from: `"${process.env.EMAIL_FROM_NAME || 'Timetable System'}" <${process.env.EMAIL_USER}>`,
          to: data.email,
          subject: emailData.subject,
          text: emailData.text,
          html: emailData.html,
        })

        console.log('✅ Approval email sent successfully to:', data.email)
        console.log('📬 Message ID:', info.messageId)
        console.log('📬 Response:', info.response)
        
      } catch (emailError: any) {
        console.error('❌ Error sending approval email:', emailError.message)
        console.error('❌ Error details:', {
          message: emailError.message,
          code: emailError.code,
          command: emailError.command,
          response: emailError.response,
          responseCode: emailError.responseCode
        })
        // Don't fail the request if email fails - approval was still successful
      }
    } else {
      console.warn('⚠️ Missing required data for sending approval email:', {
        hasUsername: !!data?.username,
        hasEmail: !!data?.email,
        hasName: !!data?.name
      })
    }

    return NextResponse.json({
      success: true,
      message: "Registration request approved successfully. Email sent to user.",
      data: data
    })

  } catch (error) {
    console.error("Approve registration request error:", error)
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    )
  }
}
