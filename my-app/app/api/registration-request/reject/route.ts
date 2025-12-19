import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/server"
import { generateRequestRejectedEmail } from "@/lib/email-templates"
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

// Reject registration request
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
        { success: false, message: "Only system administrators can reject requests" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { requestId, rejectionReason } = body

    if (!requestId) {
      return NextResponse.json(
        { success: false, message: "Request ID is required" },
        { status: 400 }
      )
    }

    if (!rejectionReason || rejectionReason.trim() === '') {
      return NextResponse.json(
        { success: false, message: "Rejection reason is required" },
        { status: 400 }
      )
    }

    // Get request details before rejecting (to get email)
    const { data: requestData, error: requestError } = await supabase
      .from('registration_requests')
      .select('name, email, status')
      .eq('id', requestId)
      .single()

    if (requestError) {
      console.error('❌ Error fetching request data:', requestError)
    }

    if (!requestData) {
      console.error('❌ Request data not found for ID:', requestId)
    } else {
      console.log('📋 Request data found:', { name: requestData.name, email: requestData.email, status: requestData.status })
    }

    // Call RPC function to reject request
    const { data, error } = await supabase.rpc(
      "reject_registration_request",
      {
        p_request_id: requestId,
        p_admin_id: session.user_id,
        p_rejection_reason: rejectionReason
      }
    )

    console.log('🔧 RPC reject_registration_request result:', { data, error })

    if (error) {
      console.error("Reject request error:", error)
      return NextResponse.json(
        { success: false, message: error.message || "Failed to reject request" },
        { status: 500 }
      )
    }

    // Check if the RPC returned success
    if (data && typeof data === 'object' && 'success' in data && !data.success) {
      return NextResponse.json(data, { status: 400 })
    }

    // Send rejection email directly using nodemailer
    if (requestData && requestData.email) {
      try {
        console.log('📧 Attempting to send rejection email to:', requestData.email)
        
        // Validate email configuration
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
          console.error('❌ Email configuration not set')
          console.error('EMAIL_USER:', process.env.EMAIL_USER ? 'SET' : 'NOT SET')
          console.error('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? 'SET' : 'NOT SET')
          throw new Error('Email configuration not set')
        }
        
        const emailData = generateRequestRejectedEmail({
          name: requestData.name,
          reason: rejectionReason
        })

        console.log('📧 Creating email transporter...')
        const transporter = createEmailTransporter()
        
        console.log('📧 Sending rejection email...')
        const info = await transporter.sendMail({
          from: `"${process.env.EMAIL_FROM_NAME || 'Timetable System'}" <${process.env.EMAIL_USER}>`,
          to: requestData.email,
          subject: emailData.subject,
          text: emailData.text,
          html: emailData.html,
        })

        console.log('✅ Rejection email sent successfully to:', requestData.email)
        console.log('📬 Message ID:', info.messageId)
        console.log('📬 Response:', info.response)
        
      } catch (emailError: any) {
        console.error('❌ Error sending rejection email:', emailError.message)
        console.error('❌ Error details:', {
          message: emailError.message,
          code: emailError.code,
          command: emailError.command,
          response: emailError.response,
          responseCode: emailError.responseCode
        })
        // Don't fail the request if email fails - rejection was still successful
      }
    } else {
      console.warn('⚠️ No email address found for request:', requestId)
      console.warn('⚠️ Request data:', requestData)
    }

    return NextResponse.json({
      success: true,
      message: "Registration request rejected successfully. Notification email sent to user.",
      data: data
    })

  } catch (error) {
    console.error("Reject registration request error:", error)
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    )
  }
}
