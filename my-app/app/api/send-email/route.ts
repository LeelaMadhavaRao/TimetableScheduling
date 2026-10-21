import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { getSupabaseServerClient } from '@/lib/server'
import { getRequestSession } from '@/lib/api-session'

// Email transporter configuration
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  })
}

export async function POST(req: NextRequest) {
  try {
    // Not an open relay: only signed-in system or college administrators may send mail
    const supabase = await getSupabaseServerClient()
    const session = await getRequestSession(req, supabase, ['admin', 'college_admin'])
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
    }

    const body = await req.json()
    const { to, subject, html, text } = body

    console.log('📧 Send email request received for:', to)

    // Validate required fields
    if (!to || !subject || (!html && !text)) {
      console.error('❌ Missing required fields')
      return NextResponse.json(
        { success: false, error: 'Missing required fields: to, subject, and (html or text)' },
        { status: 400 }
      )
    }

    // Validate email configuration
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.error('❌ Email configuration not set')
      console.error('EMAIL_USER:', process.env.EMAIL_USER ? 'SET' : 'NOT SET')
      console.error('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? 'SET' : 'NOT SET')
      return NextResponse.json(
        { success: false, error: 'Email configuration not set' },
        { status: 500 }
      )
    }

    console.log('📧 Creating email transporter...')
    console.log('Host:', process.env.EMAIL_HOST || 'smtp.gmail.com')
    console.log('Port:', parseInt(process.env.EMAIL_PORT || '587'))
    console.log('User:', process.env.EMAIL_USER)

    const transporter = createTransporter()

    console.log('📧 Sending email...')

    // Send email
    const info = await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || 'Timetable System'}" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    })

    console.log('✅ Email sent successfully!')
    console.log('📬 Message ID:', info.messageId)
    console.log('📬 Response:', info.response)

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      message: 'Email sent successfully'
    })

  } catch (error: any) {
    console.error('❌ Error sending email:', error)
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode
    })
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to send email' },
      { status: 500 }
    )
  }
}
