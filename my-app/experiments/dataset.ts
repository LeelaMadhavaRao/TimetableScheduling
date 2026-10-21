// Sample college used both for the offline baseline-vs-enhanced experiment and for the
// SQL seed script (scripts/022_sample_college_hierarchy.sql is generated from this file).
//
// Structure: one college, four departments. BSH (Basic Sciences & Humanities) faculty
// teach Mathematics and English to CSE, IT and ECE sections, so departments compete for
// the same faculty and the same shared classrooms - the situation the college-wide
// occupancy model has to handle.

export interface DatasetFaculty {
  code: string
  name: string
  dept: string
  phone: string
  /** day -> [start, end]; omitted = available all week */
  availability?: { day: number; start: number; end: number }[]
}

export interface DatasetSubject {
  code: string
  name: string
  dept: string
  type: "theory" | "lab"
  periods: number
}

export interface DatasetSection {
  name: string
  dept: string
  year: number
  students: number
  /** subject code -> faculty code */
  courses: Record<string, string>
}

export interface DatasetRoom {
  name: string
  type: "theory" | "lab"
  capacity: number
  building: string
}

export const COLLEGE = {
  id: "c0000000-0000-4000-8000-000000000001",
  username: "srkr_admin",
  password: "College@123",
  name: "SRKR College Administrator",
  institution: "SRKR Engineering College",
  email: "college.admin@srkr.example",
}

export const DEPARTMENTS = [
  { code: "CSE", name: "Computer Science & Engineering", admin: "cse_admin" },
  { code: "IT", name: "Information Technology", admin: "it_admin" },
  { code: "ECE", name: "Electronics & Communication Engineering", admin: "ece_admin" },
  { code: "BSH", name: "Basic Sciences & Humanities", admin: "bsh_admin" },
]

export const DEPARTMENT_ADMIN_PASSWORD = "Dept@123"

const weekdays = (start: number, end: number, days = [0, 1, 2, 3, 4]) => days.map((day) => ({ day, start, end }))

export const FACULTY: DatasetFaculty[] = [
  { code: "CSE-F01", name: "Dr. K. Srinivasa Rao", dept: "CSE", phone: "9848000101" },
  { code: "CSE-F02", name: "Dr. P. Lakshmi", dept: "CSE", phone: "9848000102", availability: [...weekdays(1, 8, [0, 1, 2, 3]), { day: 5, start: 1, end: 4 }] },
  { code: "CSE-F03", name: "Mr. V. Ramesh", dept: "CSE", phone: "9848000103" },
  { code: "CSE-F04", name: "Ms. S. Anusha", dept: "CSE", phone: "9848000104" },
  { code: "CSE-F05", name: "Dr. M. Venkatesh", dept: "CSE", phone: "9848000105" },
  { code: "CSE-F06", name: "Mr. T. Kiran Kumar", dept: "CSE", phone: "9848000106" },
  { code: "CSE-F07", name: "Ms. R. Divya", dept: "CSE", phone: "9848000107" },
  { code: "CSE-F08", name: "Dr. G. Sudhakar", dept: "CSE", phone: "9848000108" },
  { code: "IT-F01", name: "Dr. B. Suresh", dept: "IT", phone: "9848000201" },
  { code: "IT-F02", name: "Ms. N. Swathi", dept: "IT", phone: "9848000202" },
  { code: "IT-F03", name: "Mr. Ch. Praveen", dept: "IT", phone: "9848000203" },
  { code: "IT-F04", name: "Ms. K. Bhavani", dept: "IT", phone: "9848000204" },
  { code: "IT-F05", name: "Mr. A. Naresh", dept: "IT", phone: "9848000205" },
  { code: "ECE-F01", name: "Dr. Y. Rajasekhar", dept: "ECE", phone: "9848000301" },
  { code: "ECE-F02", name: "Ms. P. Hemalatha", dept: "ECE", phone: "9848000302" },
  { code: "ECE-F03", name: "Mr. D. Satish", dept: "ECE", phone: "9848000303" },
  { code: "ECE-F04", name: "Ms. L. Madhuri", dept: "ECE", phone: "9848000304", availability: [0, 1, 2, 3, 4, 5].map((day) => ({ day, start: 1, end: 4 })) },
  { code: "ECE-F05", name: "Mr. J. Vamsi", dept: "ECE", phone: "9848000305" },
  { code: "BSH-M01", name: "Dr. S. Ravi Kumar (Mathematics)", dept: "BSH", phone: "9848000401", availability: weekdays(1, 6) },
  { code: "BSH-M02", name: "Dr. A. Padmaja (Mathematics)", dept: "BSH", phone: "9848000402" },
  { code: "BSH-E01", name: "Ms. M. Sravani (English)", dept: "BSH", phone: "9848000403" },
  { code: "BSH-E02", name: "Mr. R. Prasad (English)", dept: "BSH", phone: "9848000404" },
]

export const SUBJECTS: DatasetSubject[] = [
  // BSH subjects taught to every department
  { code: "MA201", name: "Probability & Statistics", dept: "BSH", type: "theory", periods: 4 },
  { code: "HS201", name: "Professional Communication", dept: "BSH", type: "theory", periods: 2 },
  // CSE
  { code: "CS201", name: "Data Structures", dept: "CSE", type: "theory", periods: 4 },
  { code: "CS202", name: "Object Oriented Programming (Java)", dept: "CSE", type: "theory", periods: 4 },
  { code: "CS203", name: "Database Management Systems", dept: "CSE", type: "theory", periods: 4 },
  { code: "CS204", name: "Computer Organization", dept: "CSE", type: "theory", periods: 3 },
  { code: "CS201L", name: "Data Structures Lab", dept: "CSE", type: "lab", periods: 3 },
  { code: "CS202L", name: "Java Programming Lab", dept: "CSE", type: "lab", periods: 3 },
  { code: "CS301", name: "Operating Systems", dept: "CSE", type: "theory", periods: 4 },
  { code: "CS302", name: "Computer Networks", dept: "CSE", type: "theory", periods: 4 },
  { code: "CS303", name: "Software Engineering", dept: "CSE", type: "theory", periods: 3 },
  { code: "CS304", name: "Theory of Computation", dept: "CSE", type: "theory", periods: 4 },
  { code: "CS301L", name: "Operating Systems Lab", dept: "CSE", type: "lab", periods: 3 },
  { code: "CS302L", name: "Networks Lab", dept: "CSE", type: "lab", periods: 3 },
  // IT
  { code: "IT201", name: "Data Structures & Algorithms", dept: "IT", type: "theory", periods: 4 },
  { code: "IT202", name: "Web Technologies", dept: "IT", type: "theory", periods: 4 },
  { code: "IT203", name: "Database Systems", dept: "IT", type: "theory", periods: 4 },
  { code: "IT201L", name: "DSA Lab", dept: "IT", type: "lab", periods: 3 },
  { code: "IT202L", name: "Web Technologies Lab", dept: "IT", type: "lab", periods: 3 },
  { code: "IT301", name: "Cloud Computing", dept: "IT", type: "theory", periods: 4 },
  { code: "IT302", name: "Information Security", dept: "IT", type: "theory", periods: 4 },
  { code: "IT303", name: "Data Mining", dept: "IT", type: "theory", periods: 3 },
  { code: "IT301L", name: "Cloud Lab", dept: "IT", type: "lab", periods: 3 },
  // ECE
  { code: "EC201", name: "Electronic Devices & Circuits", dept: "ECE", type: "theory", periods: 4 },
  { code: "EC202", name: "Signals & Systems", dept: "ECE", type: "theory", periods: 4 },
  { code: "EC203", name: "Digital Logic Design", dept: "ECE", type: "theory", periods: 4 },
  { code: "EC201L", name: "EDC Lab", dept: "ECE", type: "lab", periods: 3 },
  { code: "EC203L", name: "Digital Logic Lab", dept: "ECE", type: "lab", periods: 3 },
  { code: "EC301", name: "Analog Communications", dept: "ECE", type: "theory", periods: 4 },
  { code: "EC302", name: "Microprocessors", dept: "ECE", type: "theory", periods: 4 },
  { code: "EC303", name: "Control Systems", dept: "ECE", type: "theory", periods: 3 },
  { code: "EC302L", name: "Microprocessors Lab", dept: "ECE", type: "lab", periods: 3 },
]

export const SECTIONS: DatasetSection[] = [
  // CSE (5 sections)
  { name: "CSE-2A", dept: "CSE", year: 2, students: 62, courses: { CS201: "CSE-F01", CS202: "CSE-F02", CS203: "CSE-F03", CS204: "CSE-F04", CS201L: "CSE-F01", CS202L: "CSE-F02", MA201: "BSH-M01", HS201: "BSH-E01" } },
  { name: "CSE-2B", dept: "CSE", year: 2, students: 60, courses: { CS201: "CSE-F05", CS202: "CSE-F06", CS203: "CSE-F03", CS204: "CSE-F04", CS201L: "CSE-F05", CS202L: "CSE-F06", MA201: "BSH-M01", HS201: "BSH-E01" } },
  { name: "CSE-2C", dept: "CSE", year: 2, students: 58, courses: { CS201: "CSE-F01", CS202: "CSE-F06", CS203: "CSE-F07", CS204: "CSE-F08", CS201L: "CSE-F07", CS202L: "CSE-F06", MA201: "BSH-M02", HS201: "BSH-E02" } },
  { name: "CSE-3A", dept: "CSE", year: 3, students: 61, courses: { CS301: "CSE-F07", CS302: "CSE-F08", CS303: "CSE-F02", CS304: "CSE-F05", CS301L: "CSE-F07", CS302L: "CSE-F08" } },
  { name: "CSE-3B", dept: "CSE", year: 3, students: 59, courses: { CS301: "CSE-F03", CS302: "CSE-F08", CS303: "CSE-F04", CS304: "CSE-F05", CS301L: "CSE-F03", CS302L: "CSE-F04" } },
  // IT (3 sections)
  { name: "IT-2A", dept: "IT", year: 2, students: 60, courses: { IT201: "IT-F01", IT202: "IT-F02", IT203: "IT-F03", IT201L: "IT-F01", IT202L: "IT-F02", MA201: "BSH-M01", HS201: "BSH-E01" } },
  { name: "IT-2B", dept: "IT", year: 2, students: 58, courses: { IT201: "IT-F04", IT202: "IT-F02", IT203: "IT-F03", IT201L: "IT-F04", IT202L: "IT-F05", MA201: "BSH-M02", HS201: "BSH-E02" } },
  { name: "IT-3A", dept: "IT", year: 3, students: 57, courses: { IT301: "IT-F05", IT302: "IT-F01", IT303: "IT-F04", IT301L: "IT-F05" } },
  // ECE (3 sections)
  { name: "ECE-2A", dept: "ECE", year: 2, students: 63, courses: { EC201: "ECE-F01", EC202: "ECE-F02", EC203: "ECE-F03", EC201L: "ECE-F01", EC203L: "ECE-F03", MA201: "BSH-M02", HS201: "BSH-E02" } },
  { name: "ECE-2B", dept: "ECE", year: 2, students: 60, courses: { EC201: "ECE-F05", EC202: "ECE-F02", EC203: "ECE-F04", EC201L: "ECE-F05", EC203L: "ECE-F03", MA201: "BSH-M01", HS201: "BSH-E02" } },
  { name: "ECE-3A", dept: "ECE", year: 3, students: 56, courses: { EC301: "ECE-F01", EC302: "ECE-F04", EC303: "ECE-F05", EC302L: "ECE-F02" } },
]

export const ROOMS: DatasetRoom[] = [
  { name: "TH-101", type: "theory", capacity: 66, building: "Main Block" },
  { name: "TH-102", type: "theory", capacity: 66, building: "Main Block" },
  { name: "TH-103", type: "theory", capacity: 70, building: "Main Block" },
  { name: "TH-201", type: "theory", capacity: 66, building: "CSE Block" },
  { name: "TH-202", type: "theory", capacity: 66, building: "CSE Block" },
  { name: "TH-301", type: "theory", capacity: 70, building: "IT Block" },
  { name: "TH-401", type: "theory", capacity: 66, building: "ECE Block" },
  { name: "LAB-CSE-1", type: "lab", capacity: 60, building: "CSE Block" },
  { name: "LAB-CSE-2", type: "lab", capacity: 60, building: "CSE Block" },
  { name: "LAB-IT-1", type: "lab", capacity: 60, building: "IT Block" },
  { name: "LAB-ECE-1", type: "lab", capacity: 60, building: "ECE Block" },
]

export interface Dataset {
  key: string
  title: string
  college: typeof COLLEGE
  departments: { code: string; name: string; admin: string }[]
  departmentAdminPassword: string
  faculty: DatasetFaculty[]
  subjects: DatasetSubject[]
  sections: DatasetSection[]
  rooms: DatasetRoom[]
  /** Order in which departments generate and publish (later ones schedule around earlier ones) */
  scheduleOrder: string[]
  notes?: string[]
}

export const SRKR_DATASET: Dataset = {
  key: "srkr",
  title: "SRKR sample college (hand-built)",
  college: COLLEGE,
  departments: DEPARTMENTS,
  departmentAdminPassword: DEPARTMENT_ADMIN_PASSWORD,
  faculty: FACULTY,
  subjects: SUBJECTS,
  sections: SECTIONS,
  rooms: ROOMS,
  scheduleOrder: ["CSE", "IT", "ECE"],
}
