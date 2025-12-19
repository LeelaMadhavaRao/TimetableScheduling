import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/server"
import { generateRequestRejectedEmail } from "@/lib/email-templates"

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
    const { data: requestData } = await supabase
      .from('registration_requests')
      .select('name, email')
      .eq('id', requestId)
      .single()

    // Call RPC function to reject request
    const { data, error } = await supabase.rpc(
      "reject_registration_request",
      {
        p_request_id: requestId,
        p_admin_id: session.user_id,
        p_rejection_reason: rejectionReason
      }
    )

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

    // Send rejection email
    if (requestData && requestData.email) {
      try {
        const emailData = generateRequestRejectedEmail({
          name: requestData.name,
          reason: rejectionReason
        })

        // Call email API
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000'}/api/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: requestData.email,
            subject: emailData.subject,
            html: emailData.html,
            text: emailData.text
          })
        })

        console.log('✅ Rejection email sent to:', requestData.email)
      } catch (emailError) {
        console.error('❌ Error sending rejection email:', emailError)
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json({
      success: true,
      message: "Registration request rejected successfully. Email sent to user.",
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
