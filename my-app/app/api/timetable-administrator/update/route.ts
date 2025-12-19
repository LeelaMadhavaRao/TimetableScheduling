import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/server"
import { generateAdminUpdatedEmail } from "@/lib/email-templates"

// Update timetable administrator (System Admin only)
export async function PUT(request: NextRequest) {
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
        { success: false, message: "Only system administrators can update timetable administrators" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { id, name, email, phone, institution_name, is_active, password } = body

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Administrator ID is required" },
        { status: 400 }
      )
    }

    // Get current admin details before update
    const { data: currentAdmin, error: fetchError } = await supabase
      .from('timetable_administrators')
      .select('username, name, email')
      .eq('id', id)
      .single()

    if (fetchError || !currentAdmin) {
      return NextResponse.json(
        { success: false, message: "Administrator not found" },
        { status: 404 }
      )
    }

    // Build update data
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString()
    }
    
    const updatedFields: string[] = []

    if (name && name !== currentAdmin.name) {
      updateData.name = name
      updatedFields.push('Name')
    }
    
    if (email !== undefined && email !== currentAdmin.email) {
      updateData.email = email || null
      updatedFields.push('Email')
    }
    
    if (phone !== undefined) {
      updateData.phone = phone || null
      updatedFields.push('Phone')
    }
    
    if (institution_name !== undefined) {
      updateData.institution_name = institution_name || null
      updatedFields.push('Institution Name')
    }
    
    if (is_active !== undefined) {
      updateData.is_active = is_active
      updatedFields.push('Account Status')
    }
    
    // Handle password update
    if (password) {
      const { data: hashedPassword, error: hashError } = await supabase
        .rpc('hash_password', { input_password: password })
      
      if (hashError || !hashedPassword) {
        console.error("Password hash error:", hashError)
        return NextResponse.json(
          { success: false, message: "Failed to hash password" },
          { status: 500 }
        )
      }
      
      updateData.password_hash = hashedPassword
      updatedFields.push('Password')
    }

    // If nothing to update
    if (Object.keys(updateData).length === 1) { // Only updated_at
      return NextResponse.json({
        success: true,
        message: "No changes detected"
      })
    }

    // Update timetable administrator
    const { error: updateError } = await supabase
      .from('timetable_administrators')
      .update(updateData)
      .eq('id', id)

    if (updateError) {
      console.error("Update admin error:", updateError)
      return NextResponse.json(
        { success: false, message: updateError.message || "Failed to update administrator" },
        { status: 500 }
      )
    }

    // Send email notification if email is available
    const notificationEmail = email || currentAdmin.email
    
    if (notificationEmail && updatedFields.length > 0) {
      try {
        const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000'}/login`
        const emailData = generateAdminUpdatedEmail({
          adminName: name || currentAdmin.name,
          username: currentAdmin.username,
          updatedFields,
          loginUrl
        })

        console.log('📧 Attempting to send update notification to:', notificationEmail)
        
        const baseUrl = process.env.NODE_ENV === 'production' 
          ? (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://timetable-scheduling.vercel.app')
          : 'http://localhost:3000'
        
        const emailApiUrl = `${baseUrl}/api/send-email`
        
        console.log('📧 Email API URL:', emailApiUrl)
        console.log('📧 Environment:', process.env.NODE_ENV)
        console.log('📧 Updated fields:', updatedFields.join(', '))
        
        const emailResponse = await fetch(emailApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: notificationEmail,
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
        } else {
          const emailResult = await emailResponse.json()
          
          if (emailResult.success) {
            console.log('✅ Admin update email sent successfully to:', notificationEmail)
            console.log('📬 Message ID:', emailResult.messageId)
          } else {
            console.error('❌ Email API returned error:', emailResult.error || emailResult.message)
          }
        }
      } catch (emailError: any) {
        console.error('❌ Error sending admin update email:', emailError.message)
        console.error('❌ Full error:', emailError)
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json({
      success: true,
      message: notificationEmail && updatedFields.length > 0
        ? "Administrator updated successfully. Notification email sent."
        : "Administrator updated successfully.",
      updatedFields
    })

  } catch (error) {
    console.error("Update timetable administrator error:", error)
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    )
  }
}
