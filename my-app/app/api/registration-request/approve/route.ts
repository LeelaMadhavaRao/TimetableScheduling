import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient, getCurrentAdminId } from "@/lib/server"
import { generateRequestApprovedEmail } from "@/lib/email-templates"

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

    // Send approval email with credentials
    if (data && data.username && data.email && data.name) {
      try {
        console.log('📧 Attempting to send approval email to:', data.email)
        
        const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000'}/login/timetable-admin`
        const emailData = generateRequestApprovedEmail({
          name: data.name,
          username: data.username,
          password: data.temp_password || data.password,
          loginUrl
        })

        // Use absolute URL for fetch in API routes
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
            to: data.email,
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
          console.log('✅ Approval email sent successfully to:', data.email)
          console.log('📬 Message ID:', emailResult.messageId)
        } else {
          console.error('❌ Email API returned error:', emailResult.error || emailResult.message)
        }
      } catch (emailError: any) {
        console.error('❌ Error sending approval email:', emailError.message)
        console.error('❌ Full error:', emailError)
        // Don't fail the request if email fails
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
