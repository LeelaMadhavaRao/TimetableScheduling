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
        const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000'}/login`
        const emailData = generateRequestApprovedEmail({
          name: data.name,
          username: data.username,
          password: data.temp_password || data.password,
          loginUrl
        })

        // Call email API
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000'}/api/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: data.email,
            subject: emailData.subject,
            html: emailData.html,
            text: emailData.text
          })
        })

        console.log('✅ Approval email sent to:', data.email)
      } catch (emailError) {
        console.error('❌ Error sending approval email:', emailError)
        // Don't fail the request if email fails
      }
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
