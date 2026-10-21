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

// ---------------------------------------------------------------------------
// Curriculum: 20 sections, each with 5 theory subjects (4 periods/week) and 3 labs
// (3 continuous periods) = 29 periods/week per section.
//   - 4 theory subjects + 3 labs from the section's own department
//   - 1 theory subject from Basic Sciences & Humanities (BSH), shared by every department
// ---------------------------------------------------------------------------

export const THEORY_PERIODS = 4
export const LAB_PERIODS = 3
/** Weekly teaching load cap per faculty member used to size the faculty pool */
export const MAX_FACULTY_LOAD = 18

const CURRICULUM: Record<string, Record<number, { theory: [string, string][]; labs: [string, string][] }>> = {
  CSE: {
    2: {
      theory: [["CS201", "Data Structures"], ["CS202", "Object Oriented Programming"], ["CS203", "Database Management Systems"], ["CS204", "Computer Organization"]],
      labs: [["CS201L", "Data Structures Lab"], ["CS202L", "OOP (Java) Lab"], ["CS203L", "DBMS Lab"]],
    },
    3: {
      theory: [["CS301", "Operating Systems"], ["CS302", "Computer Networks"], ["CS303", "Software Engineering"], ["CS304", "Theory of Computation"]],
      labs: [["CS301L", "Operating Systems Lab"], ["CS302L", "Networks Lab"], ["CS303L", "Software Engineering Lab"]],
    },
  },
  IT: {
    2: {
      theory: [["IT201", "Data Structures & Algorithms"], ["IT202", "Web Technologies"], ["IT203", "Database Systems"], ["IT204", "Discrete Mathematics"]],
      labs: [["IT201L", "DSA Lab"], ["IT202L", "Web Technologies Lab"], ["IT203L", "Database Lab"]],
    },
    3: {
      theory: [["IT301", "Cloud Computing"], ["IT302", "Information Security"], ["IT303", "Data Mining"], ["IT304", "Mobile Computing"]],
      labs: [["IT301L", "Cloud Lab"], ["IT302L", "Security Lab"], ["IT303L", "Data Mining Lab"]],
    },
  },
  ECE: {
    2: {
      theory: [["EC201", "Electronic Devices & Circuits"], ["EC202", "Signals & Systems"], ["EC203", "Digital Logic Design"], ["EC204", "Network Analysis"]],
      labs: [["EC201L", "EDC Lab"], ["EC202L", "Signals Lab"], ["EC203L", "Digital Logic Lab"]],
    },
    3: {
      theory: [["EC301", "Analog Communications"], ["EC302", "Microprocessors"], ["EC303", "Control Systems"], ["EC304", "Linear IC Applications"]],
      labs: [["EC301L", "Communications Lab"], ["EC302L", "Microprocessors Lab"], ["EC303L", "LIC Lab"]],
    },
  },
}
const BSH_THEORY: Record<number, [string, string]> = {
  2: ["MA201", "Probability & Statistics"],
  3: ["HS301", "Managerial Economics"],
}
/** Sections per department and year */
const SECTION_PLAN: { dept: string; year: number; count: number }[] = [
  { dept: "CSE", year: 2, count: 4 },
  { dept: "CSE", year: 3, count: 4 },
  { dept: "IT", year: 2, count: 3 },
  { dept: "IT", year: 3, count: 3 },
  { dept: "ECE", year: 2, count: 3 },
  { dept: "ECE", year: 3, count: 3 },
]

export const SUBJECTS: DatasetSubject[] = [
  ...Object.values(BSH_THEORY).map(([code, name]) => ({ code, name, dept: "BSH", type: "theory" as const, periods: THEORY_PERIODS })),
  ...Object.entries(CURRICULUM).flatMap(([dept, years]) =>
    Object.values(years).flatMap(({ theory, labs }) => [
      ...theory.map(([code, name]) => ({ code, name, dept, type: "theory" as const, periods: THEORY_PERIODS })),
      ...labs.map(([code, name]) => ({ code, name, dept, type: "lab" as const, periods: LAB_PERIODS })),
    ]),
  ),
]

interface Demand {
  section: string
  subject: string
  owner: string
  periods: number
  /** Theory subject a lab belongs to (lab i <-> theory i), so the same teacher can take both */
  pairedTheory?: string
}

const sectionDemand: { name: string; dept: string; year: number; students: number; demand: Demand[] }[] = []
for (const plan of SECTION_PLAN) {
  for (let i = 0; i < plan.count; i++) {
    const name = `${plan.dept}-${plan.year}${String.fromCharCode(65 + i)}`
    const { theory, labs } = CURRICULUM[plan.dept][plan.year]
    const demand: Demand[] = [
      ...theory.map(([code]) => ({ section: name, subject: code, owner: plan.dept, periods: THEORY_PERIODS })),
      { section: name, subject: BSH_THEORY[plan.year][0], owner: "BSH", periods: THEORY_PERIODS },
      ...labs.map(([code], k) => ({ section: name, subject: code, owner: plan.dept, periods: LAB_PERIODS, pairedTheory: theory[k][0] })),
    ]
    // Section sizes 55-65, deterministic
    const students = 55 + ((sectionDemand.length * 7 + 3) % 11)
    sectionDemand.push({ name, dept: plan.dept, year: plan.year, students, demand })
  }
}

/**
 * Faculty pool sized from demand: each department gets ceil(total periods / MAX_FACULTY_LOAD)
 * faculty, then courses are packed onto the least-loaded member (longest first), preferring
 * someone who already teaches the subject and giving each lab to the teacher of its theory.
 * Everyone ends up within a period or two of the average load, so no faculty member idles.
 */
function assignFaculty() {
  const faculty: DatasetFaculty[] = []
  const teacher = new Map<string, string>() // section|subject -> faculty code
  const load = new Map<string, number>()
  const subjectsOf = new Map<string, Set<string>>()

  const owners = ["BSH", ...Object.keys(CURRICULUM)]
  for (const owner of owners) {
    const courses = sectionDemand.flatMap((s) => s.demand).filter((d) => d.owner === owner)
    const total = courses.reduce((sum, d) => sum + d.periods, 0)
    const count = Math.ceil(total / MAX_FACULTY_LOAD)
    const pool: string[] = []
    for (let i = 1; i <= count; i++) {
      const code = `${owner}-F${String(i).padStart(2, "0")}`
      faculty.push({ code, name: `${owner} Faculty ${i}`, dept: owner, phone: `98480${String(faculty.length + 1).padStart(5, "0")}` })
      pool.push(code)
      load.set(code, 0)
      subjectsOf.set(code, new Set())
    }

    // Theory first (larger items), labs after so they can follow their theory teacher
    const ordered = courses.slice().sort((a, b) => b.periods - a.periods || a.subject.localeCompare(b.subject) || a.section.localeCompare(b.section))
    // Pack against the department's average load first; the hard cap is only a fallback
    const target = Math.ceil(total / count)
    for (const d of ordered) {
      const fits = (cap: number) => (f: string) => load.get(f)! + d.periods <= cap
      const leastLoaded = (candidates: string[], cap: number) =>
        candidates.filter(fits(cap)).sort((a, b) => load.get(a)! - load.get(b)! || a.localeCompare(b))[0]
      let chosen: string | undefined
      for (const cap of [target, MAX_FACULTY_LOAD]) {
        if (d.pairedTheory) {
          const theoryTeacher = teacher.get(`${d.section}|${d.pairedTheory}`)
          if (theoryTeacher && fits(cap)(theoryTeacher)) chosen = theoryTeacher
        }
        chosen ??= leastLoaded(pool.filter((f) => subjectsOf.get(f)!.has(d.subject)), cap)
        chosen ??= leastLoaded(pool, cap)
        if (chosen) break
      }
      if (!chosen) throw new Error(`No faculty capacity left for ${d.section} ${d.subject}`)
      teacher.set(`${d.section}|${d.subject}`, chosen)
      load.set(chosen, load.get(chosen)! + d.periods)
      subjectsOf.get(chosen)!.add(d.subject)
    }
  }

  // A few realistic restrictions: one member per department is off one weekday
  const restricted: [string, number][] = [["CSE-F03", 2], ["IT-F02", 4], ["ECE-F04", 0], ["BSH-F01", 5]]
  for (const [code, dayOff] of restricted) {
    const f = faculty.find((x) => x.code === code)
    if (f) f.availability = [0, 1, 2, 3, 4, 5].filter((d) => d !== dayOff).map((day) => ({ day, start: 1, end: day === 5 ? 4 : 8 }))
  }
  return { faculty, teacher, load }
}

const assignment = assignFaculty()

export const FACULTY: DatasetFaculty[] = assignment.faculty

/** Weekly load per faculty member (periods) - used for utilization reporting */
export const FACULTY_LOAD: Map<string, number> = assignment.load

export const SECTIONS: DatasetSection[] = sectionDemand.map((s) => ({
  name: s.name,
  dept: s.dept,
  year: s.year,
  students: s.students,
  courses: Object.fromEntries(s.demand.map((d) => [d.subject, assignment.teacher.get(`${s.name}|${d.subject}`)!])),
}))

// Rooms sized for the demand: 20 x 20 theory periods over 44 usable periods/room -> 12 rooms
// (~76% use); 60 labs over 11 lab blocks/room/week -> 8 lab rooms (~68% use)
export const ROOMS: DatasetRoom[] = [
  ...Array.from({ length: 12 }, (_, i) => ({
    name: `TH-${100 * (1 + Math.floor(i / 4)) + (i % 4) + 1}`,
    type: "theory" as const,
    capacity: i % 3 === 0 ? 72 : 66,
    building: ["Main Block", "CSE Block", "ECE Block"][Math.floor(i / 4)],
  })),
  ...Array.from({ length: 8 }, (_, i) => ({
    name: `LAB-${["CSE", "CSE", "CSE", "IT", "IT", "ECE", "ECE", "COMMON"][i]}-${i + 1}`,
    type: "lab" as const,
    capacity: 66,
    building: ["CSE Block", "CSE Block", "CSE Block", "IT Block", "IT Block", "ECE Block", "ECE Block", "Main Block"][i],
  })),
]

const loads = [...FACULTY_LOAD.values()]
export const DATASET_NOTES = [
  `${SECTIONS.length} sections x (5 theory x ${THEORY_PERIODS} + 3 labs x ${LAB_PERIODS} periods) = 29 periods/week each`,
  `${FACULTY.length} faculty sized at <= ${MAX_FACULTY_LOAD} periods/week: load ${Math.min(...loads)}-${Math.max(...loads)} periods, mean utilization ${((loads.reduce((a, b) => a + b, 0) / loads.length / MAX_FACULTY_LOAD) * 100).toFixed(1)}%`,
  `${ROOMS.filter((r) => r.type === "theory").length} theory rooms + ${ROOMS.filter((r) => r.type === "lab").length} lab rooms shared by all departments`,
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
  title: "SRKR sample college (20 sections, 5 theory + 3 labs each)",
  college: COLLEGE,
  departments: DEPARTMENTS,
  departmentAdminPassword: DEPARTMENT_ADMIN_PASSWORD,
  faculty: FACULTY,
  subjects: SUBJECTS,
  sections: SECTIONS,
  rooms: ROOMS,
  scheduleOrder: ["CSE", "IT", "ECE"],
  notes: DATASET_NOTES,
}
