import nodemailer from "nodemailer"
import type { NextRequest } from "next/server"

// Server-only email helper. API routes call it directly instead of going through
// /api/send-email over HTTP, so no public endpoint can be used to relay mail.

export interface MailMessage {
  to: string
  subject: string
  html?: string
  text?: string
}

export async function sendMail(message: MailMessage): Promise<{ sent: boolean; error?: string }> {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    return { sent: false, error: "Email is not configured (EMAIL_USER / EMAIL_PASSWORD)" }
  }
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || "smtp.gmail.com",
      port: parseInt(process.env.EMAIL_PORT || "587"),
      secure: process.env.EMAIL_SECURE === "true",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
    })
    await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || "Timetable System"}" <${process.env.EMAIL_USER}>`,
      ...message,
    })
    return { sent: true }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    console.error("Email send failed:", reason)
    return { sent: false, error: reason }
  }
}

/** Public base URL of this deployment: configured URL, else the request's own origin */
export function appBaseUrl(request: NextRequest): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, "")
}
