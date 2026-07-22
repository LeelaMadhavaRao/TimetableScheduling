import { z } from "zod"

export const classroomSchema = z.object({
  name: z.string().min(1, "Name is required"),
  capacity: z.number().int().min(1, "Capacity must be at least 1"),
  room_type: z.enum(["theory", "lab"]),
  building: z.string().optional().default(""),
  floor: z.number().int().min(0).optional().default(1),
})

export const facultySchema = z.object({
  code: z.string().min(1, "Code is required").max(20),
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  department_id: z.string().uuid("Invalid department").optional().or(z.literal("")),
  phone: z
    .string()
    .regex(/^[\d+\-\s]{10,}$/, "Phone must have at least 10 digits")
    .optional()
    .or(z.literal("")),
})

export const sectionSchema = z.object({
  name: z.string().min(1, "Name is required"),
  year_level: z.number().int().min(1).max(4),
  student_count: z.number().int().min(1, "Student count must be at least 1"),
  department_id: z.string().uuid("Invalid department").optional().or(z.literal("")),
})

export const subjectSchema = z.object({
  code: z.string().min(1, "Code is required"),
  name: z.string().min(1, "Name is required"),
  subject_type: z.enum(["theory", "lab"]),
  periods_per_week: z.number().int().min(1).max(20),
  department_id: z.string().uuid("Invalid department").optional().or(z.literal("")),
})

export const availabilitySchema = z.object({
  faculty_id: z.string().uuid(),
  day_of_week: z.number().int().min(0).max(5),
  start_period: z.number().int().min(1).max(8),
  end_period: z.number().int().min(1).max(8),
}).refine((d) => d.end_period >= d.start_period, {
  message: "End period must be >= start period",
})

export const registrationRequestSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().optional(),
  institutionName: z.string().optional(),
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/, "Username must be alphanumeric"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  message: z.string().optional(),
})

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export const adminCreateSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(6),
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  institution_name: z.string().optional(),
})

export type ClassroomInput = z.infer<typeof classroomSchema>
export type FacultyInput = z.infer<typeof facultySchema>
export type SectionInput = z.infer<typeof sectionSchema>
export type SubjectInput = z.infer<typeof subjectSchema>
