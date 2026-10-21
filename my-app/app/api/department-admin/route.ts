import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/server"
import { getRequestSession } from "@/lib/api-session"

// Department administrator accounts - managed by the college administrator.
// Each department has exactly one account (department_admins.department_id is UNIQUE).

async function collegeAdminOr403(request: NextRequest) {
  const supabase = await getSupabaseServerClient()
  const session = await getRequestSession(request, supabase, ['college_admin'])
  return { supabase, collegeId: session?.userId || null }
}

function forbidden() {
  return NextResponse.json(
    { success: false, message: "Only the college administrator can manage department accounts" },
    { status: 403 }
  )
}

async function hash(supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>, password: string) {
  const { data, error } = await supabase.rpc('hash_password', { input_password: password })
  if (error || !data) {
    console.error("Password hash error:", error)
    return null
  }
  return data as string
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, collegeId } = await collegeAdminOr403(request)
    if (!collegeId) return forbidden()

    const { username, password, name, email, phone, department_id } = await request.json()
    if (!username || !password || !name || !department_id) {
      return NextResponse.json(
        { success: false, message: "Department, username, password and name are required" },
        { status: 400 }
      )
    }
    if (String(password).length < 6) {
      return NextResponse.json({ success: false, message: "Password must be at least 6 characters" }, { status: 400 })
    }

    const { data: department } = await supabase
      .from('departments')
      .select('id, code')
      .eq('id', department_id)
      .eq('college_id', collegeId)
      .maybeSingle()
    if (!department) {
      return NextResponse.json({ success: false, message: "Department not found in your college" }, { status: 404 })
    }

    const passwordHash = await hash(supabase, password)
    if (!passwordHash) {
      return NextResponse.json({ success: false, message: "Failed to hash password" }, { status: 500 })
    }

    const { error } = await supabase.from('department_admins').insert({
      username: String(username).trim(),
      password_hash: passwordHash,
      name,
      email: email || null,
      phone: phone || null,
      department_id,
      college_id: collegeId,
    })

    if (error) {
      if (error.code === '23505') {
        const message = error.message.includes('department_id')
          ? `Department ${department.code} already has an administrator account`
          : "Username already exists"
        return NextResponse.json({ success: false, message }, { status: 409 })
      }
      return NextResponse.json({ success: false, message: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: `Administrator account created for ${department.code}` })
  } catch (error) {
    console.error("Create department admin error:", error)
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { supabase, collegeId } = await collegeAdminOr403(request)
    if (!collegeId) return forbidden()

    const { id, name, email, phone, is_active, password } = await request.json()
    if (!id) {
      return NextResponse.json({ success: false, message: "Administrator ID is required" }, { status: 400 })
    }

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (name) update.name = name
    if (email !== undefined) update.email = email || null
    if (phone !== undefined) update.phone = phone || null
    if (is_active !== undefined) update.is_active = Boolean(is_active)
    if (password) {
      if (String(password).length < 6) {
        return NextResponse.json({ success: false, message: "Password must be at least 6 characters" }, { status: 400 })
      }
      const passwordHash = await hash(supabase, password)
      if (!passwordHash) {
        return NextResponse.json({ success: false, message: "Failed to hash password" }, { status: 500 })
      }
      update.password_hash = passwordHash
    }

    const { data, error } = await supabase
      .from('department_admins')
      .update(update)
      .eq('id', id)
      .eq('college_id', collegeId)
      .select('id')

    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 })
    if (!data || data.length === 0) {
      return NextResponse.json({ success: false, message: "Administrator not found in your college" }, { status: 404 })
    }

    // Deactivation or a password change ends existing sessions
    if (is_active === false || password) {
      await supabase.from('user_sessions').delete().eq('user_id', id).eq('user_type', 'department_admin')
    }

    return NextResponse.json({ success: true, message: "Department administrator updated" })
  } catch (error) {
    console.error("Update department admin error:", error)
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { supabase, collegeId } = await collegeAdminOr403(request)
    if (!collegeId) return forbidden()

    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ success: false, message: "Administrator ID is required" }, { status: 400 })

    const { error } = await supabase.from('department_admins').delete().eq('id', id).eq('college_id', collegeId)
    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 })

    await supabase.from('user_sessions').delete().eq('user_id', id).eq('user_type', 'department_admin')
    return NextResponse.json({ success: true, message: "Department administrator removed" })
  } catch (error) {
    console.error("Delete department admin error:", error)
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 })
  }
}
