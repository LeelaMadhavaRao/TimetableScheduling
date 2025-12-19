// Supabase Edge Function: notify-faculty-timetable
// Sends WhatsApp notifications to faculty when timetable is generated
// Uses WATI (WhatsApp Team Inbox) API

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// CORS headers for the function
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Types
interface TimetableEntry {
  id: string
  day_of_week: number
  start_period: number
  end_period: number
  subject_id: string
  faculty_id: string
  classroom_id: string
  subjects: {
    code: string
    name: string
    subject_type: string
  }
  classrooms: {
    name: string
  }
  sections: {
    name: string
    year_level: number
    departments: {
      name: string
      code: string
    }
  }
}

interface Faculty {
  id: string
  code: string
  name: string
  phone: string
  email: string
}

interface NotificationRequest {
  jobId: string
  timetableType: 'base' | 'optimized'
  adminId: string
}

// Day names for display
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Period timings
const PERIOD_TIMINGS: Record<number, string> = {
  1: '09:00 - 09:55',
  2: '09:55 - 10:50',
  3: '11:10 - 12:05',
  4: '12:05 - 01:00',
  5: '02:00 - 02:55',
  6: '02:55 - 03:50',
  7: '04:00 - 04:55',
  8: '04:55 - 05:50',
}

// Format phone number to international format for WATI
function formatPhoneNumber(phone: string): string {
  // Remove all non-digits
  let cleaned = phone.replace(/\D/g, '')
  
  // If starts with 0, assume it's a local number and add country code
  if (cleaned.startsWith('0')) {
    cleaned = '91' + cleaned.substring(1) // India country code
  }
  
  // If doesn't start with country code, add it
  if (!cleaned.startsWith('91') && cleaned.length === 10) {
    cleaned = '91' + cleaned
  }
  
  // WATI API expects format: 91XXXXXXXXXX (without + sign for URL)
  return cleaned
}

// Generate faculty timetable PDF content as base64
async function generateFacultyTimetablePDF(
  faculty: Faculty,
  timetableEntries: TimetableEntry[],
  timetableType: string
): Promise<string> {
  // Create HTML content for the timetable
  const htmlContent = generateTimetableHTML(faculty, timetableEntries, timetableType)
  
  // For edge functions, we'll return HTML content that can be converted to PDF
  // The actual PDF generation would need a service like Puppeteer or a PDF API
  // For now, we'll send a text summary via WhatsApp
  return htmlContent
}

// Generate HTML timetable
function generateTimetableHTML(
  faculty: Faculty,
  entries: TimetableEntry[],
  timetableType: string
): string {
  const now = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  let html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    h1 { color: #1a365d; }
    h2 { color: #2d3748; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: center; }
    th { background-color: #3182ce; color: white; }
    .lab { background-color: #fef3c7; }
    .empty { background-color: #f7fafc; color: #a0aec0; }
    .header { margin-bottom: 20px; }
    .footer { margin-top: 30px; font-size: 12px; color: #718096; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Faculty Timetable</h1>
    <h2>${faculty.name} (${faculty.code})</h2>
    <p>Type: ${timetableType.toUpperCase()} | Generated: ${now}</p>
  </div>
  <table>
    <thead>
      <tr>
        <th>Period</th>
        <th>Time</th>
        ${DAYS.map(day => `<th>${day}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
`

  // Create timetable grid
  for (let period = 1; period <= 8; period++) {
    html += `<tr><td><strong>P${period}</strong></td><td>${PERIOD_TIMINGS[period]}</td>`
    
    for (let day = 0; day <= 5; day++) {
      // Find entry where this period falls within start_period and end_period range
      const entry = entries.find(e => 
        e.day_of_week === day && 
        period >= e.start_period && 
        period <= e.end_period
      )
      
      if (entry) {
        const className = entry.subjects.subject_type === 'lab' ? 'lab' : ''
        const periodRange = entry.start_period === entry.end_period 
          ? `P${entry.start_period}` 
          : `P${entry.start_period}-${entry.end_period}`
        html += `<td class="${className}">
          <strong>${entry.subjects.code}</strong><br>
          ${entry.sections.departments.code}-${entry.sections.name}<br>
          <small>${entry.classrooms.name}</small>
          ${entry.subjects.subject_type === 'lab' ? '<br><em>(Lab)</em>' : ''}
        </td>`
      } else {
        html += `<td class="empty">-</td>`
      }
    }
    
    html += '</tr>'
  }

  html += `
    </tbody>
  </table>
  <div class="footer">
    <p>This is an auto-generated timetable. Please contact admin for any discrepancies.</p>
  </div>
</body>
</html>
`

  return html
}

// Generate text summary for WhatsApp message
function generateTimetableSummary(
  faculty: Faculty,
  entries: TimetableEntry[],
  timetableType: string
): string {
  const totalClasses = entries.length
  const labClasses = entries.filter(e => e.subjects.subject_type === 'lab').length
  const theoryClasses = totalClasses - labClasses
  
  // Group by day
  const byDay: Record<number, TimetableEntry[]> = {}
  entries.forEach(entry => {
    if (!byDay[entry.day_of_week]) byDay[entry.day_of_week] = []
    byDay[entry.day_of_week].push(entry)
  })
  
  let summary = `📅 *TIMETABLE NOTIFICATION*\n\n`
  summary += `Dear *${faculty.name}*,\n\n`
  summary += `Your ${timetableType.toUpperCase()} timetable has been generated.\n\n`
  summary += `📊 *Summary:*\n`
  summary += `• Total Classes: ${totalClasses}\n`
  summary += `• Theory: ${theoryClasses}\n`
  summary += `• Lab: ${labClasses}\n\n`
  summary += `📆 *Weekly Schedule:*\n`
  
  for (let day = 0; day <= 5; day++) {
    const dayEntries = byDay[day] || []
    if (dayEntries.length > 0) {
      summary += `\n*${DAYS[day]}:*\n`
      dayEntries
        .sort((a, b) => a.start_period - b.start_period)
        .forEach(entry => {
          const periodRange = entry.start_period === entry.end_period 
            ? `P${entry.start_period}` 
            : `P${entry.start_period}-${entry.end_period}`
          summary += `  ${periodRange}: ${entry.subjects.code} (${entry.sections.departments.code}-${entry.sections.name}) @ ${entry.classrooms.name}`
          if (entry.subjects.subject_type === 'lab') summary += ` [Lab]`
          summary += `\n`
        })
    }
  }
  
  summary += `\n🔗 Login to view full timetable and download PDF.\n`
  summary += `\n_Generated on ${new Date().toLocaleString()}_`
  
  return summary
}

// Send WhatsApp message using WATI API
async function sendWhatsAppMessage(
  phoneNumber: string,
  message: string,
  watiApiUrl: string,
  watiApiKey: string,
  tenantId: string,
  templateName: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    console.log('  → sendWhatsAppMessage called for:', phoneNumber)
    console.log('  → Message length:', message.length)
    console.log('  → WATI API URL:', watiApiUrl)
    console.log('  → TENANT_ID:', tenantId)
    console.log('  → Template Name:', templateName)
    
    // WATI API: Correct format with TENANT_ID in URL path
    const url = `${watiApiUrl}/${tenantId}/api/v1/sendTemplateMessage?whatsappNumber=${phoneNumber}`
    
    console.log('  → Full API URL:', url)
    console.log('  → Making POST request to WATI...')
    
    // Sanitize message: remove newlines/tabs, normalize whitespace
    const sanitizedMessage = message.replace(/[\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim()
    
    // WATI expects this exact format
    const requestBody = {
      template_name: templateName,
      broadcast_name: "Timetable Notification",
      parameters: [
        {
          name: "message_body",
          value: sanitizedMessage
        }
      ]
    }
    console.log('  → Request body:', JSON.stringify(requestBody, null, 2))
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${watiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    })
    
    console.log('  → WATI Response status:', response.status, response.statusText)
    
    // Get response text first to see what we're dealing with
    const responseText = await response.text()
    console.log('  → WATI Response body:', responseText)
    
    // Try to parse as JSON if not empty
    let data: any = {}
    if (responseText && responseText.trim().length > 0) {
      try {
        data = JSON.parse(responseText)
        console.log('  → WATI Response parsed:', JSON.stringify(data, null, 2))
      } catch (parseError) {
        console.error('  ✗ Failed to parse WATI response as JSON:', parseError)
        console.log('  → Raw response was:', responseText)
        return {
          success: false,
          error: `Invalid JSON response from WATI: ${responseText.substring(0, 200)}`
        }
      }
    } else {
      console.log('  ⚠ WATI returned empty response')
    }
    
    if (!response.ok) {
      console.error('  ✗ WATI API Error:', data)
      return { 
        success: false, 
        error: data.error || data.message || `HTTP ${response.status}: ${response.statusText}` 
      }
    }
    
    console.log('  ✓ WATI message sent successfully')
    return { 
      success: true, 
      messageId: data.id || data.messageId || 'sent'
    }
  } catch (error) {
    console.error('  ✗ WATI send error:', error)
    return { 
      success: false, 
      error: (error as Error).message || 'Unknown error' 
    }
  }
}

// Log notification to database
async function logNotification(
  supabase: any,
  facultyId: string,
  jobId: string,
  status: 'sent' | 'failed',
  messageId: string | null,
  errorMessage: string | null
): Promise<void> {
  try {
    console.log('  → Logging notification to database:', {
      facultyId,
      jobId,
      status,
      messageId,
      errorMessage
    })
    
    const { error } = await supabase
      .from('notification_logs')
      .insert({
        faculty_id: facultyId,
        job_id: jobId,
        notification_type: 'whatsapp',
        status: status,
        message_id: messageId,
        error_message: errorMessage,
        sent_at: new Date().toISOString()
      })
    
    if (error) {
      console.error('  ✗ Failed to log notification:', error)
    } else {
      console.log('  ✓ Notification logged successfully')
    }
  } catch (error) {
    console.error('Failed to log notification:', error)
  }
}

// Main handler
serve(async (req) => {
  console.log('=== EDGE FUNCTION START ===')
  console.log('Request method:', req.method)
  console.log('Request URL:', req.url)
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request')
    return new Response('ok', { headers: corsHeaders })
  }
  
  try {
    console.log('--- Step 1: Reading environment variables ---')
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const watiApiUrl = Deno.env.get('WATI_API_URL')
    const watiApiKey = Deno.env.get('WATI_API_KEY')
    const tenantId = Deno.env.get('TENANT_ID')
    const watiTemplateName = Deno.env.get('WATI_TEMPLATE_NAME') || 'sih'
    const appUrl = Deno.env.get('APP_URL') || 'http://localhost:3000'
    
    console.log('Environment variables:')
    console.log('- SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing')
    console.log('- SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'Set (length: ' + supabaseServiceKey.length + ')' : 'Missing')
    console.log('- WATI_API_URL:', watiApiUrl || 'Missing')
    console.log('- WATI_API_KEY:', watiApiKey ? 'Set (length: ' + watiApiKey.length + ')' : 'Missing')
    console.log('- TENANT_ID:', tenantId || 'Missing')
    console.log('- WATI_TEMPLATE_NAME:', watiTemplateName)
    console.log('- APP_URL:', appUrl)
    
    // Validate required env vars
    if (!watiApiUrl || !watiApiKey || !tenantId || !watiTemplateName) {
      console.error('ERROR: Missing WATI credentials or configuration')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'WATI API credentials not configured. Please set WATI_API_URL, WATI_API_KEY, TENANT_ID, and WATI_TEMPLATE_NAME' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    console.log('--- Step 2: Parsing request body ---')
    // Parse request body
    const requestBody = await req.json()
    console.log('Request body:', JSON.stringify(requestBody, null, 2))
    
    const { jobId, timetableType, adminId } = requestBody
    
    if (!jobId || !timetableType) {
      console.error('ERROR: Missing required fields')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: jobId, timetableType' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    console.log('Request parameters:')
    console.log('- jobId:', jobId)
    console.log('- timetableType:', timetableType)
    console.log('- adminId:', adminId || 'Not provided')
    console.log('Request parameters:')
    console.log('- jobId:', jobId)
    console.log('- timetableType:', timetableType)
    console.log('- adminId:', adminId || 'Not provided')
    
    console.log('--- Step 3: Initializing Supabase client ---')
    // Initialize Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    console.log('Supabase client created')
    
    console.log('--- Step 4: Fetching timetable job ---')
    // Get timetable job details
    const { data: job, error: jobError } = await supabase
      .from('timetable_jobs')
      .select('id, status')
      .eq('id', jobId)
      .single()
    
    if (jobError) {
      console.error('ERROR fetching job:', jobError)
    }
    if (!job) {
      console.error('ERROR: Job not found')
    } else {
      console.log('Job found:', JSON.stringify(job, null, 2))
    }
    
    if (jobError || !job) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Timetable job not found',
          details: jobError 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    console.log('--- Step 5: Determining timetable table ---')
    // Determine which table to query based on timetable type
    const timetableTable = timetableType === 'optimized' ? 'timetable_optimized' : 'timetable_base'
    console.log('Using table:', timetableTable)
    console.log('Using table:', timetableTable)
    
    console.log('--- Step 6: Fetching timetable entries ---')
    // Get all timetable entries for this job
    const { data: timetableEntries, error: timetableError } = await supabase
      .from(timetableTable)
      .select(`
        id,
        day_of_week,
        start_period,
        end_period,
        subject_id,
        faculty_id,
        classroom_id,
        subjects (code, name, subject_type),
        classrooms (name),
        sections (
          name,
          year_level,
          departments (name, code)
        )
      `)
      .eq('job_id', jobId)
    
    if (timetableError) {
      console.error('ERROR fetching timetable entries:', timetableError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to fetch timetable entries',
          details: timetableError 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    console.log('Timetable entries found:', timetableEntries?.length || 0)
    
    console.log('--- Step 7: Extracting unique faculty IDs ---')
    // Get unique faculty IDs from timetable
    const facultyIds = [...new Set(timetableEntries.map(e => e.faculty_id))]
    console.log('Unique faculty count:', facultyIds.length)
    console.log('Faculty IDs:', facultyIds)
    
    if (facultyIds.length === 0) {
      console.log('No faculty to notify - returning success')
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No faculty to notify',
          notified: 0 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    console.log('--- Step 8: Fetching faculty details ---')
    // Fetch faculty details
    const { data: facultyList, error: facultyError } = await supabase
      .from('faculty')
      .select('id, code, name, phone, email')
      .in('id', facultyIds)
      .eq('is_active', true)
    
    if (facultyError) {
      console.error('ERROR fetching faculty:', facultyError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to fetch faculty details',
          details: facultyError 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    console.log('Faculty records found:', facultyList?.length || 0)
    facultyList?.forEach((f, idx) => {
      console.log(`Faculty ${idx + 1}:`, f.name, '| Phone:', f.phone || 'NO PHONE', '| Code:', f.code)
    })
    
    console.log('--- Step 9: Processing notifications ---')
    
    // Process notifications for each faculty
    const results = {
      total: facultyList.length,
      sent: 0,
      failed: 0,
      skipped: 0,
      details: [] as any[]
    }
    
    for (let i = 0; i < facultyList.length; i++) {
      const faculty = facultyList[i]
      console.log(`\n--- Processing faculty ${i + 1}/${facultyList.length} ---`)
      console.log('Faculty:', faculty.name, '| Code:', faculty.code, '| ID:', faculty.id)
      
      // Skip if no phone number
      if (!faculty.phone) {
        console.log('SKIPPED: No phone number for', faculty.name)
        results.skipped++
        results.details.push({
          facultyId: faculty.id,
          facultyName: faculty.name,
          status: 'skipped',
          reason: 'No phone number'
        })
        continue
      }
      
      console.log('Phone:', faculty.phone)
      
      // Get faculty-specific timetable entries
      const facultyEntries = timetableEntries.filter(e => e.faculty_id === faculty.id)
      console.log('Faculty timetable entries:', facultyEntries.length)
      
      // Generate timetable summary message
      console.log('Generating timetable summary...')
      const message = generateTimetableSummary(faculty, facultyEntries, timetableType)
      console.log('Message length:', message.length, 'chars')
      
      // Format phone number
      const formattedPhone = formatPhoneNumber(faculty.phone)
      console.log('Formatted phone:', formattedPhone)
      
      // Send WhatsApp message via WATI
      console.log('Sending WhatsApp message via WATI...')
      const result = await sendWhatsAppMessage(
        formattedPhone,
        message,
        watiApiUrl,
        watiApiKey,
        tenantId,
        watiTemplateName
      )
      
      console.log('WATI API result:', result.success ? 'SUCCESS' : 'FAILED')
      if (result.messageId) console.log('Message ID:', result.messageId)
      if (result.error) console.error('WATI Error:', result.error)
      
      // Log the notification
      console.log('Logging notification to database...')
      await logNotification(
        supabase,
        faculty.id,
        jobId,
        result.success ? 'sent' : 'failed',
        result.messageId || null,
        result.error || null
      )
      
      if (result.success) {
        results.sent++
      } else {
        results.failed++
      }
      
      results.details.push({
        facultyId: faculty.id,
        facultyName: faculty.name,
        phone: formattedPhone,
        status: result.success ? 'sent' : 'failed',
        messageId: result.messageId,
        error: result.error
      })
      
      // Small delay between messages to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    console.log('\n--- Step 10: Returning final response ---')
    console.log('Total faculty:', results.total)
    console.log('Successfully sent:', results.sent)
    console.log('Failed:', results.failed)
    console.log('Skipped:', results.skipped)
    
    const response = {
      success: true,
      message: `Notifications processed: ${results.sent} sent, ${results.failed} failed, ${results.skipped} skipped`,
      results
    }
    
    console.log('=== FUNCTION COMPLETED SUCCESSFULLY ===')
    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
    
  } catch (error) {
    console.error('=== CRITICAL ERROR IN EDGE FUNCTION ===')
    console.error('Error type:', typeof error)
    console.error('Error:', error)
    console.error('Error message:', (error as Error).message)
    console.error('Error stack:', (error as Error).stack)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: (error as Error).message || 'Internal server error',
        errorType: typeof error,
        errorDetails: error instanceof Error ? {
          message: error.message,
          name: error.name,
          stack: error.stack
        } : String(error)
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
