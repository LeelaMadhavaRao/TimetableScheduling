import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient, getCurrentAdminId } from "@/lib/server"

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

    return NextResponse.json({
      success: true,
      message: "Registration request approved successfully",
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
