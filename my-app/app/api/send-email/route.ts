import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

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
    const body = await req.json()
    const { to, subject, html, text } = body

    // Validate required fields
    if (!to || !subject || (!html && !text)) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: to, subject, and (html or text)' },
        { status: 400 }
      )
    }

    // Validate email configuration
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      return NextResponse.json(
        { success: false, error: 'Email configuration not set' },
        { status: 500 }
      )
    }

    const transporter = createTransporter()

    // Send email
    const info = await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || 'Timetable System'}" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    })

    console.log('Email sent successfully:', info.messageId)

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      message: 'Email sent successfully'
    })

  } catch (error: any) {
    console.error('Error sending email:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to send email' },
      { status: 500 }
    )
  }
}
