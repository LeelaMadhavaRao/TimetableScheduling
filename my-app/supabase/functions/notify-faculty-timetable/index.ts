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

// Generate faculty timetable PDF using jsPDF and upload to Supabase Storage
async function generateAndUploadFacultyPDF(
  supabase: any,
  faculty: Faculty,
  timetableEntries: TimetableEntry[],
  timetableType: string,
  jobId: string
): Promise<string | null> {
  try {
    console.log(`  → Generating PDF for faculty: ${faculty.name}`)
    
    // Import jsPDF dynamically
    const { jsPDF } = await import('https://esm.sh/jspdf@2.5.1')
    
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    })
    
    // Set document properties
    doc.setProperties({
      title: `${faculty.name} - ${timetableType} Timetable`,
      subject: 'Faculty Timetable',
      author: 'Timetable Scheduling System'
    })
    
    // Header with gradient background
    doc.setFillColor(30, 58, 138)
    doc.rect(0, 0, 297, 45, 'F')
    
    // Title
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(24)
    doc.setFont('helvetica', 'bold')
    doc.text('Faculty Timetable', 148.5, 15, { align: 'center' })
    
    // Faculty info
    doc.setFontSize(16)
    doc.text(`${faculty.name} (${faculty.code})`, 148.5, 27, { align: 'center' })
    
    // Timetable type
    doc.setFontSize(12)
    doc.text(`${timetableType.toUpperCase()} Schedule`, 148.5, 36, { align: 'center' })
    
    // Date
    doc.setFontSize(9)
    const dateStr = new Date().toLocaleDateString('en-IN', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
    doc.text(`Generated: ${dateStr}`, 15, 40)
    
    // Create timetable grid
    const timetableGrid: { [key: string]: any } = {}
    
    // Initialize grid
    for (let day = 0; day <= 5; day++) {
      for (let period = 1; period <= 8; period++) {
        const key = `${day}-${period}`
        timetableGrid[key] = null
      }
    }
    
    // Fill grid with entries
    timetableEntries.forEach(entry => {
      for (let p = entry.start_period; p <= entry.end_period; p++) {
        const key = `${entry.day_of_week}-${p}`
        timetableGrid[key] = entry
      }
    })
    
    // Build table data
    const tableData: any[] = []
    const PERIOD_TIMES: Record<number, string> = {
      1: '09:00-09:55',
      2: '09:55-10:50',
      3: '11:10-12:05',
      4: '12:05-01:00',
      5: '02:00-02:55',
      6: '02:55-03:50',
      7: '04:00-04:55',
      8: '04:55-05:50'
    }
    
    for (let period = 1; period <= 8; period++) {
      const row: any[] = [
        `P${period}`,
        PERIOD_TIMES[period]
      ]
      
      for (let day = 0; day <= 5; day++) {
        const key = `${day}-${period}`
        const entry = timetableGrid[key]
        
        if (entry) {
          const cellText = `${entry.subjects.code}\n${entry.sections.departments.code}-${entry.sections.name}\n${entry.classrooms.name}`
          row.push(cellText)
        } else {
          row.push('-')
        }
      }
      
      tableData.push(row)
    }
    
    // Add table using autoTable
    const { default: autoTable } = await import('https://esm.sh/jspdf-autotable@3.8.2')
    
    autoTable(doc, {
      startY: 52,
      head: [['Period', 'Time', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']],
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 3,
        halign: 'center',
        valign: 'middle'
      },
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251]
      },
      columnStyles: {
        0: { cellWidth: 15, fontStyle: 'bold' },
        1: { cellWidth: 25 }
      },
      didParseCell: function(data: any) {
        // Highlight lab classes
        if (data.row.index >= 0 && data.column.index >= 2) {
          const cellValue = data.cell.raw
          if (cellValue && cellValue.toString().includes('L')) {
            data.cell.styles.fillColor = [254, 243, 199]
          }
        }
      }
    })
    
    // Add footer
    const pageCount = doc.getNumberOfPages()
    doc.setFontSize(8)
    doc.setTextColor(100)
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.text(
        `Page ${i} of ${pageCount} | Generated by Timetable Scheduling System`,
        148.5,
        200,
        { align: 'center' }
      )
    }
    
    // Convert to blob
    const pdfBlob = doc.output('blob')
    
    // Upload to Supabase Storage
    const bucketName = 'faculty-timetables'
    const fileName = `${jobId}/${faculty.code}_${timetableType}_${Date.now()}.pdf`
    
    console.log(`  → Uploading PDF to bucket: ${bucketName}/${fileName}`)
    
    // Delete old files for this faculty in this job
    const { data: existingFiles } = await supabase.storage
      .from(bucketName)
      .list(jobId)
    
    if (existingFiles && existingFiles.length > 0) {
      const facultyFiles = existingFiles
        .filter((f: any) => f.name.startsWith(faculty.code))
        .map((f: any) => `${jobId}/${f.name}`)
      
      if (facultyFiles.length > 0) {
        console.log(`  → Deleting ${facultyFiles.length} old PDF(s)`)
        await supabase.storage
          .from(bucketName)
          .remove(facultyFiles)
      }
    }
    
    // Upload new PDF
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, pdfBlob, {
        contentType: 'application/pdf',
        upsert: true
      })
    
    if (error) {
      console.error('  ✗ Failed to upload PDF:', error)
      return null
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName)
    
    console.log(`  ✓ PDF uploaded successfully: ${urlData.publicUrl}`)
    return urlData.publicUrl
    
  } catch (error) {
    console.error('  ✗ Error generating/uploading PDF:', error)
    return null
  }
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

// Generate text summary for WhatsApp message with enhanced template
function generateTimetableSummary(
  faculty: Faculty,
  entries: TimetableEntry[],
  timetableType: string,
  pdfUrl?: string
): string {
  const totalClasses = entries.length
  const labClasses = entries.filter(e => e.subjects.subject_type === 'lab').length
  const theoryClasses = totalClasses - labClasses
  
  // Count distinct subjects
  const uniqueSubjects = new Set(entries.map(e => e.subjects.code))
  const subjectCount = uniqueSubjects.size
  
  // Get days with classes
  const activeDays = [...new Set(entries.map(e => e.day_of_week))]
    .sort()
    .map(d => DAYS[d])
  
  // Enhanced message template with emojis and better formatting
  let message = `⚠️ *Important Notification*\n\n`
  message += `📅 *TIMETABLE NOTIFICATION*\n\n`
  message += `Dear *${faculty.name}*,\n\n`
  message += `Your *${timetableType.toUpperCase()}* timetable has been successfully generated! 🎉\n\n`
  
  
  
  // Login portal link with emoji
  message += `🌐 *View Full Timetable:*\n`
  message += `Login to our portal to view your complete schedule and download PDF:\n`
  message += `👉 https://timetable-scheduling.vercel.app/login/faculty\n\n`
  
  // PDF attachment info
  if (pdfUrl) {
    message += `📄 *Your Timetable PDF:*\n`
    message += `${pdfUrl}\n\n`
  }
  
  message += `⏰ *Generated:* ${new Date().toLocaleString('en-IN', { 
    dateStyle: 'medium', 
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata'
  })}\n\n`
  
  message += `📞 For any queries, please contact the admin(mail: leelamadhav.nulakani@gmail.com).\n`
  message += `_This is an automated notification from Timetable Scheduling System_`
  
  return message
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
    console.log('Faculty IDs:', JSON.stringify(facultyIds, null, 2))
    
    // Log faculty distribution
    const facultyDistribution: Record<string, number> = {}
    timetableEntries.forEach(e => {
      facultyDistribution[e.faculty_id] = (facultyDistribution[e.faculty_id] || 0) + 1
    })
    console.log('Faculty class distribution:', JSON.stringify(facultyDistribution, null, 2))
    
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
    // Fetch faculty details (including inactive faculty)
    const { data: facultyList, error: facultyError } = await supabase
      .from('faculty')
      .select('id, code, name, phone, email, is_active')
      .in('id', facultyIds)
    
    console.log('Query results - All faculty:')
    console.log(`  - Total faculty IDs in timetable: ${facultyIds.length}`)
    console.log(`  - Faculty records returned: ${facultyList?.length || 0}`)
    
    // Check which faculty were found and which were not
    const foundFacultyIds = new Set(facultyList?.map(f => f.id) || [])
    const missingFacultyIds = facultyIds.filter(id => !foundFacultyIds.has(id))
    if (missingFacultyIds.length > 0) {
      console.log(`  ⚠️ WARNING: ${missingFacultyIds.length} faculty IDs in timetable but NOT found in faculty table:`)
      console.log('  Missing IDs:', JSON.stringify(missingFacultyIds, null, 2))
    }
    
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
    
    console.log('\nFaculty details:')
    facultyList?.forEach((f, idx) => {
      const activeStatus = f.is_active ? '✅ Active' : '⚠️ Inactive'
      console.log(`  ${idx + 1}. ${f.name} (${f.code}) - ${activeStatus}`)
      console.log(`     - Phone: ${f.phone || '❌ NO PHONE'}`)
      console.log(`     - Email: ${f.email || 'NO EMAIL'}`)
      console.log(`     - ID: ${f.id}`)
    })
    
    console.log('--- Step 9: Processing notifications ---')
    
    // Process notifications for ALL faculty (active and inactive)
    const results = {
      total: facultyList.length,
      sent: 0,
      failed: 0,
      skipped: 0,
      details: [] as any[]
    }
    
    for (let i = 0; i < facultyList.length; i++) {
      const faculty = facultyList[i]
      const activeStatus = faculty.is_active ? 'Active' : 'Inactive'
      console.log(`\n--- Processing faculty ${i + 1}/${facultyList.length} ---`)
      console.log('Faculty:', faculty.name, '| Code:', faculty.code, '| Status:', activeStatus, '| ID:', faculty.id)
      
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
      
      // Generate and upload faculty PDF
      console.log('Generating faculty timetable PDF...')
      const pdfUrl = await generateAndUploadFacultyPDF(
        supabase,
        faculty,
        facultyEntries,
        timetableType,
        jobId
      )
      
      if (pdfUrl) {
        console.log('✓ PDF generated and uploaded:', pdfUrl)
      } else {
        console.log('⚠ PDF generation skipped or failed')
      }
      
      // Generate timetable summary message with PDF URL
      console.log('Generating timetable summary...')
      const message = generateTimetableSummary(faculty, facultyEntries, timetableType, pdfUrl || undefined)
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
    console.log('Skipped (no phone):', results.skipped)
    
    const response = {
      success: true,
      message: `Notifications processed: ${results.sent} sent, ${results.failed} failed, ${results.skipped} skipped (no phone)`,
      summary: {
        totalInTimetable: facultyIds.length,
        totalFaculty: results.total,
        sent: results.sent,
        failed: results.failed,
        skippedNoPhone: results.skipped
      },
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
