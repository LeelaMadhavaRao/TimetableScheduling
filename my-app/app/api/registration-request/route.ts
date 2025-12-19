import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient()
    
    const body = await request.json()
    const { fullName, email, phone, institutionName, username, password, message } = body

    // Validate required fields
    if (!fullName || !email || !username || !password) {
      return NextResponse.json(
        { success: false, message: "Missing required fields" },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, message: "Invalid email format" },
        { status: 400 }
      )
    }

    // Validate username format (alphanumeric, underscore, 3-50 chars)
    const usernameRegex = /^[a-zA-Z0-9_]{3,50}$/
    if (!usernameRegex.test(username)) {
      return NextResponse.json(
        { success: false, message: "Username must be 3-50 alphanumeric characters or underscore" },
        { status: 400 }
      )
    }

    // Check if email already has a pending request
    const { data: existingEmail } = await supabase
      .from("registration_requests")
      .select("id, status")
      .eq("email", email)
      .eq("status", "pending")
      .maybeSingle()

    if (existingEmail) {
      return NextResponse.json(
        { success: false, message: "A pending request already exists for this email" },
        { status: 400 }
      )
    }

    // Check if username already exists in requests
    const { data: existingUsername } = await supabase
      .from("registration_requests")
      .select("id, status")
      .eq("username", username)
      .eq("status", "pending")
      .maybeSingle()

    if (existingUsername) {
      return NextResponse.json(
        { success: false, message: "A pending request already exists for this username" },
        { status: 400 }
      )
    }

    // Check if username already exists in timetable_administrators
    const { data: existingAdmin } = await supabase
      .from("timetable_administrators")
      .select("id")
      .eq("username", username)
      .maybeSingle()

    if (existingAdmin) {
      return NextResponse.json(
        { success: false, message: "Username already taken" },
        { status: 400 }
      )
    }

    // Hash password using Supabase RPC
    const { data: hashedPassword, error: hashError } = await supabase.rpc(
      "hash_password",
      { input_password: password }
    )

    if (hashError || !hashedPassword) {
      console.error("Password hashing error:", hashError)
      return NextResponse.json(
        { success: false, message: "Failed to process password" },
        { status: 500 }
      )
    }

    // Insert registration request
    const { data, error } = await supabase
      .from("registration_requests")
      .insert({
        full_name: fullName,
        email: email,
        phone: phone || null,
        institution_name: institutionName || null,
        username: username,
        requested_password: hashedPassword,
        message: message || null,
        status: "pending"
      })
      .select()
      .single()

    if (error) {
      console.error("Database insert error:", error)
      return NextResponse.json(
        { success: false, message: "Failed to submit request" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Registration request submitted successfully! You will be notified once approved.",
      requestId: data.id
    })

  } catch (error) {
    console.error("Registration request error:", error)
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    )
  }
}

// Get all registration requests (admin only)
export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient()
    
    // Get query parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") || "pending"

    // Fetch requests with reviewer details
    const query = supabase
      .from("registration_requests")
      .select(`
        *,
        reviewed_by_admin:admin_users!registration_requests_reviewed_by_fkey(username, name)
      `)
      .order("created_at", { ascending: false })

    if (status !== "all") {
      query.eq("status", status)
    }

    const { data, error } = await query

    if (error) {
      console.error("Fetch registration requests error:", error)
      return NextResponse.json(
        { success: false, message: "Failed to fetch requests" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      requests: data || []
    })

  } catch (error) {
    console.error("Get registration requests error:", error)
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    )
  }
}
