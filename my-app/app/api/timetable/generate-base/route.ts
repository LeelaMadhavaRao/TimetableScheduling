import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/server"
import { ILPTimetableGenerator } from "@/lib/ilp-generator"
import type { CourseAssignment, ClassroomOption, FacultyAvailabilitySlot } from "@/lib/ilp-generator"

export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseServerClient()
    
    // Parse request body to get administrator ID
    let adminId: string | null = null
    try {
      const body = await request.json()
      adminId = body.adminId || null
    } catch {
      // No body provided, continue without admin filtering
    }

    // If adminId is provided, delete previous timetables for this administrator
    if (adminId) {
      console.log(`[GenerateBase] Deleting previous timetables for admin: ${adminId}`)
      
      // Delete from timetable_optimized first (if exists)
      await supabase
        .from("timetable_optimized")
        .delete()
        .eq("created_by", adminId)
      
      // Delete from timetable_base
      const { error: deleteBaseError } = await supabase
        .from("timetable_base")
        .delete()
        .eq("created_by", adminId)
      
      if (deleteBaseError) {
        console.warn(`[GenerateBase] Warning deleting old base timetable: ${deleteBaseError.message}`)
      }
      
      // Delete old jobs
      await supabase
        .from("timetable_jobs")
        .delete()
        .eq("created_by", adminId)
    }

    // Create a new job
    const jobInsert: Record<string, unknown> = {
      status: "generating_base",
      progress: 10,
      message: "Fetching data...",
    }
    
    if (adminId) {
      jobInsert.created_by = adminId
    }
    
    const { data: job, error: jobError } = await supabase
      .from("timetable_jobs")
      .insert(jobInsert)
      .select()
      .single()

    if (jobError) {
      return NextResponse.json({ error: jobError.message }, { status: 500 })
    }

    // Fetch all data needed for generation (filtered by admin if provided)
    let sectionSubjectsQuery = supabase
      .from("section_subjects")
      .select("*, sections(*), subjects(*), faculty(*)")
    
    let classroomsQuery = supabase.from("classrooms").select("*")
    let availabilityQuery = supabase.from("faculty_availability").select("*")
    
    // Filter by admin if provided
    if (adminId) {
      // For section_subjects, we need to filter through sections
      const { data: adminSections } = await supabase
        .from("sections")
        .select("id")
        .eq("created_by", adminId)
      
      const sectionIds = adminSections?.map(s => s.id) || []
      
      if (sectionIds.length > 0) {
        sectionSubjectsQuery = sectionSubjectsQuery.in("section_id", sectionIds)
      }
      
      classroomsQuery = classroomsQuery.eq("created_by", adminId)
      
      // Get faculty IDs for this admin
      const { data: adminFaculty } = await supabase
        .from("faculty")
        .select("id")
        .eq("created_by", adminId)
      
      const facultyIds = adminFaculty?.map(f => f.id) || []
      
      if (facultyIds.length > 0) {
        availabilityQuery = availabilityQuery.in("faculty_id", facultyIds)
      }
    }
    
    const { data: sectionSubjects } = await sectionSubjectsQuery
    const { data: classrooms } = await classroomsQuery
    const { data: availability } = await availabilityQuery

    if (!sectionSubjects || !classrooms) {
      await supabase
        .from("timetable_jobs")
        .update({ status: "failed", message: "Missing required data" })
        .eq("id", job.id)
      return NextResponse.json({ error: "Missing required data" }, { status: 400 })
    }

    // Update progress
    await supabase
      .from("timetable_jobs")
      .update({ progress: 30, message: "Preparing course assignments..." })
      .eq("id", job.id)

    // Transform data for ILP solver
    const courses: CourseAssignment[] = sectionSubjects.map((ss) => ({
      sectionId: ss.section_id,
      sectionName: ss.sections.name,
      subjectId: ss.subject_id,
      subjectName: ss.subjects.name,
      subjectCode: ss.subjects.code,
      subjectType: ss.subjects.subject_type,
      periodsPerWeek: ss.subjects.periods_per_week,
      facultyId: ss.faculty_id,
      facultyCode: ss.faculty.code,
      studentCount: ss.sections.student_count,
      yearLevel: ss.sections.year_level,
    }))

    const classroomOptions: ClassroomOption[] = classrooms.map((c) => ({
      id: c.id,
      name: c.name,
      capacity: c.capacity,
      roomType: c.room_type,
    }))

    const facultyAvailability: FacultyAvailabilitySlot[] =
      availability?.map((a) => ({
        facultyId: a.faculty_id,
        dayOfWeek: a.day_of_week,
        startPeriod: a.start_period,
        endPeriod: a.end_period,
      })) || []

    // Update progress
    await supabase.from("timetable_jobs").update({ progress: 50, message: "Running ILP solver..." }).eq("id", job.id)

    // Run ILP generation
    const startTime = Date.now()
    const generator = new ILPTimetableGenerator(courses, classroomOptions, facultyAvailability)
    const timetableSlots = generator.generate()
    const generationTime = Date.now() - startTime

    // Update progress
    await supabase.from("timetable_jobs").update({ progress: 80, message: "Saving timetable..." }).eq("id", job.id)

    // Save to database
    const slotsToInsert = timetableSlots.map((slot) => {
      const slotData: Record<string, unknown> = {
        job_id: job.id,
        section_id: slot.sectionId,
        subject_id: slot.subjectId,
        faculty_id: slot.facultyId,
        classroom_id: slot.classroomId,
        day_of_week: slot.day,
        start_period: slot.startPeriod,
        end_period: slot.endPeriod,
      }
      
      if (adminId) {
        slotData.created_by = adminId
      }
      
      return slotData
    })

    const { error: insertError } = await supabase.from("timetable_base").insert(slotsToInsert)

    if (insertError) {
      await supabase
        .from("timetable_jobs")
        .update({ status: "failed", message: "Error saving timetable: " + insertError.message })
        .eq("id", job.id)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Update job status
    await supabase
      .from("timetable_jobs")
      .update({
        status: "base_complete",
        progress: 100,
        message: `Base timetable generated successfully (${timetableSlots.length} slots in ${generationTime}ms)`,
        base_generation_time: generationTime,
      })
      .eq("id", job.id)

    return NextResponse.json({
      success: true,
      jobId: job.id,
      slotsGenerated: timetableSlots.length,
      generationTime,
    })
  } catch (error) {
    console.error("[v0] Error generating base timetable:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
