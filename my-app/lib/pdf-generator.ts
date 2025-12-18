import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

interface TimetableSlot {
  day_of_week: number
  start_period: number
  end_period: number
  sections: { name: string; year_level: number } | null
  subjects: { name: string; code: string; subject_type: string } | null
  faculty: { name: string; code: string } | null
  classrooms: { name: string } | null
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const PERIODS = ["1", "2", "3", "4", "5", "6", "7", "8"]

interface TimetableData {
  [section: string]: {
    [day: number]: {
      [period: number]: TimetableSlot
    }
  }
}

export async function generateTimetablePDF(
  timetableSlots: TimetableSlot[],
  jobId: string,
  isOptimized: boolean,
) {
  // 🔍 DEBUG: Log incoming data to verify periods
  console.log(`[PDF Generator] Starting PDF generation for job ${jobId}`)
  console.log(`[PDF Generator] Total slots received: ${timetableSlots.length}`)
  
  const labSlots = timetableSlots.filter(s => s.subjects?.subject_type === 'lab')
  console.log(`[PDF Generator] Lab slots: ${labSlots.length}`)
  labSlots.forEach((slot, i) => {
    const span = slot.end_period - slot.start_period + 1
    console.log(`  Lab ${i}: ${slot.subjects?.code} (${slot.sections?.name}) - Day ${slot.day_of_week}, P${slot.start_period}-${slot.end_period} (${span} periods)${span !== 4 ? ' ❌ NOT 4 PERIODS!' : ' ✅'}`)
  })
  
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  })

  // Set document properties
  doc.setProperties({
    title: `Timetable - ${isOptimized ? "Optimized" : "Base"}`,
    subject: "Academic Timetable",
    author: "Timetable Scheduling System",
    keywords: "timetable, schedule",
    creator: "Timetable Scheduling System",
  })

  // Group slots by section
  const sectionMap: { [key: string]: TimetableSlot[] } = {}
  timetableSlots.forEach((slot) => {
    const sectionName = slot.sections?.name
    if (!sectionName) return
    
    if (!sectionMap[sectionName]) {
      sectionMap[sectionName] = []
    }
    sectionMap[sectionName].push(slot)
  })

  const sections = Object.keys(sectionMap).sort()
  let isFirstPage = true
  let pageNumber = 1

  sections.forEach((sectionName) => {
    if (!isFirstPage) {
      doc.addPage()
      pageNumber++
    }
    isFirstPage = false

    const slots = sectionMap[sectionName]

    // Add decorative header background with gradient effect
    doc.setFillColor(30, 58, 138) // Deep blue
    doc.rect(0, 0, 297, 50, "F")
    
    // Accent line
    doc.setFillColor(59, 130, 246) // Brighter blue
    doc.rect(0, 46, 297, 4, "F")

    // Main title
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(28)
    doc.setFont("helvetica", "bold")
    doc.text("Academic Timetable", 148.5, 18, { align: "center" })

    // Section name with styling
    doc.setFontSize(20)
    doc.setFont("helvetica", "normal")
    doc.text(sectionName, 148.5, 32, { align: "center" })

    // Metadata in header
    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(200, 220, 255)
    
    const date = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
    
    const time = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
    
    doc.text(`Generated: ${date} | Time: ${time}`, 15, 42)
    
    // Type badge with better styling
    const badgeX = 260
    const badgeY = 38
    const badgeColor = isOptimized ? [16, 185, 129] : [245, 158, 11]
    doc.setFillColor(badgeColor[0], badgeColor[1], badgeColor[2])
    doc.roundedRect(badgeX, badgeY, 30, 7, 1.5, 1.5, "F")
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.text(isOptimized ? "OPTIMIZED" : "BASE", badgeX + 15, badgeY + 5, { align: "center" })
    
    // Job ID info
    doc.setFontSize(7)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(150, 170, 200)
    doc.text(`Job ID: ${jobId.slice(0, 12)}...`, badgeX, badgeY + 10)

    // Create timetable grid
    const timetableData: TimetableData = {}

    slots.forEach((slot) => {
      if (!timetableData[sectionName]) {
        timetableData[sectionName] = {}
      }
      if (!timetableData[sectionName][slot.day_of_week]) {
        timetableData[sectionName][slot.day_of_week] = {}
      }

      // Mark all periods from start to end
      for (let p = slot.start_period; p <= slot.end_period; p++) {
        timetableData[sectionName][slot.day_of_week][p] = slot
      }
    })

    // Prepare table data
    const tableData: any[][] = []

    PERIODS.forEach((period, periodIndex) => {
      const row: any[] = [{ content: `Period ${period}`, styles: { fontStyle: "bold" } }]

      DAYS.forEach((day, dayIndex) => {
        const slot = timetableData[sectionName]?.[dayIndex]?.[periodIndex + 1]

        if (slot) {
          // Check if this is the start period of the slot
          const isStartPeriod = slot.start_period === periodIndex + 1

          if (isStartPeriod) {
            // Only add cell with content and rowSpan for the START period
            const spanPeriods = slot.end_period - slot.start_period + 1
            
            if (slot.subjects && slot.faculty && slot.classrooms) {
              const isLab = slot.subjects.subject_type === "lab"
              const cellContent = `${slot.subjects.code}\n${slot.subjects.name.substring(0, 20)}\n${slot.faculty.code}\n${slot.classrooms.name}`

              row.push({
                content: cellContent,
                rowSpan: spanPeriods,
                styles: {
                  fillColor: isLab ? [254, 243, 199] : [219, 234, 254], // Yellow for lab, light blue for theory
                  textColor: [0, 0, 0],
                  fontSize: 7.5,
                  halign: "center" as const,
                  valign: "middle" as const,
                  fontStyle: "normal",
                  lineColor: [180, 200, 220],
                  lineWidth: 0.2,
                },
              })
            } else {
              row.push("")
            }
          }
          // For middle/end periods: DON'T push anything - cell is covered by rowSpan above
          // jsPDF-autoTable handles this automatically
        } else {
          // No slot at all - add empty cell
          row.push("")
        }
      })

      tableData.push(row)
    })

    // Generate table with enhanced styling
    autoTable(doc, {
      startY: 58,
      head: [
        [
          { content: "Period", styles: { halign: "center" as const, fillColor: [30, 58, 138] as [number, number, number] } },
          ...DAYS.map((day) => ({
            content: day,
            styles: { halign: "center" as const, fillColor: [30, 58, 138] as [number, number, number] },
          })),
        ],
      ],
      body: tableData,
      theme: "grid",
      styles: {
        fontSize: 8.5,
        cellPadding: 4,
        lineColor: [220, 220, 220],
        lineWidth: 0.3,
        textColor: [20, 20, 20],
        halign: "center" as const,
        valign: "middle" as const,
      },
      headStyles: {
        fillColor: [30, 58, 138],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 11,
        lineColor: [20, 40, 100],
        lineWidth: 0.5,
      },
      columnStyles: {
        0: { 
          cellWidth: 22, 
          fontStyle: "bold", 
          fillColor: [240, 245, 255],
          textColor: [30, 58, 138],
          lineColor: [180, 200, 220],
        },
      },
      margin: { left: 10, right: 10 },
      didParseCell: function (data) {
        // Remove empty cells created by rowspan
        if (data.cell.raw === "" && data.cell.section === "body") {
          const slot = timetableData[sectionName]?.[data.column.index - 1]?.[data.row.index + 1]
          if (slot && slot.start_period < data.row.index + 1 && slot.end_period >= data.row.index + 1) {
            data.cell.text = []
          }
        }
      },
    })

    // Add footer with legend and stats
    const pageHeight = doc.internal.pageSize.height
    const footerY = pageHeight - 30
    
    // Separator line
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.3)
    doc.line(10, footerY, 287, footerY)
    
    // Legend
    doc.setFontSize(9)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(30, 58, 138)
    doc.text("Legend:", 15, footerY + 6)
    
    // Theory legend
    doc.setFillColor(219, 234, 254)
    doc.rect(60, footerY + 2, 8, 6, "F")
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(0, 0, 0)
    doc.text("Theory | ", 70, footerY + 6)
    
    // Lab legend
    doc.setFillColor(254, 243, 199)
    doc.rect(100, footerY + 2, 8, 6, "F")
    doc.text("Lab | ", 110, footerY + 6)
    
    // Period info
    doc.setFontSize(7)
    doc.setTextColor(100, 100, 100)
    doc.text("Periods 1-8 | 45 min per period", 130, footerY + 6)
    
    // Statistics
    const uniqueSubjects = new Set(slots.map(s => s.subjects?.code).filter(Boolean)).size
    const uniqueFaculty = new Set(slots.map(s => s.faculty?.code).filter(Boolean)).size
    const totalSlots = slots.length
    
    // Right aligned stats
    doc.setFont("helvetica", "bold")
    doc.setTextColor(50, 50, 50)
    doc.setFontSize(8)
    doc.text(`Total Classes: ${totalSlots}`, 240, footerY + 6, { align: "right" })
    
    // Page footer
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    doc.setFont("helvetica", "normal")
    doc.text("Timetable Scheduling System", 148.5, pageHeight - 5, { align: "center" })
    
    // Page number
    doc.setFontSize(7)
    doc.text(`Page ${pageNumber}`, 285, pageHeight - 5, { align: "right" })
  })

  // Save the PDF
  const fileName = `timetable_${isOptimized ? "optimized" : "base"}_${jobId.slice(0, 8)}_${Date.now()}.pdf`
  doc.save(fileName)

  return fileName
}
