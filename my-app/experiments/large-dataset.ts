// Large university instance: 410 faculty, 4 years x 25 sections, rooms sized for 92-95% use.
//
//   Years 1-3: 5 theory subjects (4 periods/week) + 3 labs (3 continuous periods)  = 29 periods
//   Year 4   : 5 theory subjects (4 periods/week) + 1 lab                          = 23 periods
//
//   Theory demand  = 100 sections x 5 x 4                 = 2000 periods/week
//   Lab demand     = 75 x 3 + 25 x 1                       = 250 lab blocks/week
//   Theory rooms   = 49 x 44 usable periods (Sat P1-4)    -> 2000 / 2156 = 92.8 %
//   Lab rooms      = 24 x 11 lab blocks (2/day + Sat AM)  ->  250 /  264 = 94.7 %
//
// Faculty are split across departments in proportion to their teaching demand and packed
// onto the least-loaded member, so every one of the 410 carries a near-equal load.
//
//   DATASET=large npm run experiment:sql     -> scripts/024_large_university.sql

import type { Dataset, DatasetFaculty, DatasetRoom, DatasetSection, DatasetSubject } from "./dataset.ts"

export const FACULTY_TOTAL = 410
const THEORY_PERIODS = 4
const LAB_PERIODS = 3
const THEORY_ROOMS = 49
const LAB_ROOMS = 24
const MAX_LOAD = 18

/** Sections per department per year; each year sums to 25 */
const SECTIONS_PER_YEAR: Record<string, number> = { CSE: 7, ECE: 6, EEE: 4, MECH: 4, CIVIL: 4 }

const DEPT_NAMES: Record<string, string> = {
  CSE: "Computer Science & Engineering",
  ECE: "Electronics & Communication Engineering",
  EEE: "Electrical & Electronics Engineering",
  MECH: "Mechanical Engineering",
  CIVIL: "Civil Engineering",
  BSH: "Basic Sciences & Humanities",
}

// Common first-year subjects (and second-year maths) are taught by BSH
const BSH_THEORY: Record<number, [string, string][]> = {
  1: [["MA101", "Engineering Mathematics I"], ["PH101", "Engineering Physics"], ["EN101", "Communicative English"]],
  2: [["MA201", "Engineering Mathematics III"]],
  3: [],
  4: [],
}
const BSH_LABS: Record<number, [string, string][]> = {
  1: [["PH101L", "Engineering Physics Lab"]],
  2: [],
  3: [],
  4: [],
}

function deptSubjects(dept: string, year: number) {
  const theoryNeeded = 5 - BSH_THEORY[year].length
  const labsNeeded = (year === 4 ? 1 : 3) - BSH_LABS[year].length
  const theory: [string, string][] = Array.from({ length: theoryNeeded }, (_, i) => [`${dept}${year}0${i + 1}`, `${dept} Year ${year} Subject ${i + 1}`])
  const labs: [string, string][] = Array.from({ length: labsNeeded }, (_, i) => [`${dept}${year}0${i + 1}L`, `${dept} Year ${year} Lab ${i + 1}`])
  return { theory, labs }
}

interface Demand {
  section: string
  subject: string
  owner: string
  periods: number
  pairedTheory?: string
}

export function buildLargeDataset(): Dataset {
  const departments = Object.keys(SECTIONS_PER_YEAR)
  const subjects = new Map<string, DatasetSubject>()
  const sections: { name: string; dept: string; year: number; students: number; demand: Demand[] }[] = []

  for (const [year, list] of Object.entries(BSH_THEORY)) for (const [code, name] of list) subjects.set(code, { code, name, dept: "BSH", type: "theory", periods: THEORY_PERIODS })
  for (const [year, list] of Object.entries(BSH_LABS)) for (const [code, name] of list) subjects.set(code, { code, name, dept: "BSH", type: "lab", periods: LAB_PERIODS })

  for (const year of [1, 2, 3, 4]) {
    for (const dept of departments) {
      const own = deptSubjects(dept, year)
      for (const [code, name] of own.theory) subjects.set(code, { code, name, dept, type: "theory", periods: THEORY_PERIODS })
      for (const [code, name] of own.labs) subjects.set(code, { code, name, dept, type: "lab", periods: LAB_PERIODS })
      for (let i = 0; i < SECTIONS_PER_YEAR[dept]; i++) {
        const name = `${dept}-${year}${String.fromCharCode(65 + i)}`
        const theory = [...BSH_THEORY[year].map(([c]) => ({ code: c, owner: "BSH" })), ...own.theory.map(([c]) => ({ code: c, owner: dept }))]
        const labs = [...BSH_LABS[year].map(([c]) => ({ code: c, owner: "BSH", paired: c.slice(0, -1) })), ...own.labs.map(([c]) => ({ code: c, owner: dept, paired: c.slice(0, -1) }))]
        const demand: Demand[] = [
          ...theory.map((t) => ({ section: name, subject: t.code, owner: t.owner, periods: THEORY_PERIODS })),
          ...labs.map((l) => ({ section: name, subject: l.code, owner: l.owner, periods: LAB_PERIODS, pairedTheory: subjects.has(l.paired) ? l.paired : undefined })),
        ]
        sections.push({ name, dept, year, students: 56 + ((sections.length * 7 + 3) % 10), demand })
      }
    }
  }

  // --- Faculty: 410 split by demand share (largest remainder), then balanced packing ---
  const owners = ["BSH", ...departments]
  const demandOf = new Map(owners.map((o) => [o, 0]))
  for (const s of sections) for (const d of s.demand) demandOf.set(d.owner, demandOf.get(d.owner)! + d.periods)
  const totalDemand = [...demandOf.values()].reduce((a, b) => a + b, 0)
  const quota = owners.map((o) => ({ o, exact: (demandOf.get(o)! / totalDemand) * FACULTY_TOTAL }))
  const counts = new Map(quota.map((q) => [q.o, Math.floor(q.exact)]))
  let missing = FACULTY_TOTAL - [...counts.values()].reduce((a, b) => a + b, 0)
  for (const q of quota.slice().sort((a, b) => (b.exact % 1) - (a.exact % 1))) {
    if (missing-- <= 0) break
    counts.set(q.o, counts.get(q.o)! + 1)
  }

  const faculty: DatasetFaculty[] = []
  const load = new Map<string, number>()
  const teacher = new Map<string, string>()
  for (const owner of owners) {
    const pool: string[] = []
    for (let i = 1; i <= counts.get(owner)!; i++) {
      const code = `U-${owner}-F${String(i).padStart(3, "0")}`
      faculty.push({ code, name: `${owner} Faculty ${i}`, dept: owner, phone: `97${String(faculty.length + 1).padStart(8, "0")}` })
      pool.push(code)
      load.set(code, 0)
    }
    const courses = sections.flatMap((s) => s.demand).filter((d) => d.owner === owner)
    const target = Math.ceil(courses.reduce((a, d) => a + d.periods, 0) / pool.length)
    // Theory first; a lab follows its theory teacher when that keeps loads balanced
    const ordered = courses.slice().sort((a, b) => b.periods - a.periods || a.subject.localeCompare(b.subject) || a.section.localeCompare(b.section))
    for (const d of ordered) {
      let chosen: string | undefined
      for (const cap of [target, MAX_LOAD]) {
        const fits = (f: string) => load.get(f)! + d.periods <= cap
        if (d.pairedTheory) {
          const t = teacher.get(`${d.section}|${d.pairedTheory}`)
          if (t && fits(t)) chosen = t
        }
        chosen ??= pool.filter(fits).sort((a, b) => load.get(a)! - load.get(b)! || a.localeCompare(b))[0]
        if (chosen) break
      }
      if (!chosen) throw new Error(`No capacity for ${d.section} ${d.subject}`)
      teacher.set(`${d.section}|${d.subject}`, chosen)
      load.set(chosen, load.get(chosen)! + d.periods)
    }
  }
  // About 5% of faculty are unavailable on one weekday
  faculty.forEach((f, i) => {
    if (i % 20 !== 7) return
    const off = i % 5
    f.availability = [0, 1, 2, 3, 4, 5].filter((d) => d !== off).map((day) => ({ day, start: 1, end: day === 5 ? 4 : 8 }))
  })

  const datasetSections: DatasetSection[] = sections.map((s) => ({
    name: s.name,
    dept: s.dept,
    year: s.year,
    students: s.students,
    courses: Object.fromEntries(s.demand.map((d) => [d.subject, teacher.get(`${s.name}|${d.subject}`)!])),
  }))

  const rooms: DatasetRoom[] = [
    ...Array.from({ length: THEORY_ROOMS }, (_, i) => ({ name: `U-TH-${String(i + 1).padStart(3, "0")}`, type: "theory" as const, capacity: i % 4 === 0 ? 72 : 66, building: `Block ${String.fromCharCode(65 + Math.floor(i / 10))}` })),
    ...Array.from({ length: LAB_ROOMS }, (_, i) => ({ name: `U-LAB-${String(i + 1).padStart(2, "0")}`, type: "lab" as const, capacity: 66, building: `Lab Block ${1 + Math.floor(i / 8)}` })),
  ]

  const loads = [...load.values()]
  const theoryPeriods = datasetSections.length * 5 * THEORY_PERIODS
  const labBlocks = sections.reduce((a, s) => a + s.demand.filter((d) => d.periods === LAB_PERIODS && d.subject.endsWith("L")).length, 0)
  const departmentsList = [...departments, "BSH"].map((code) => ({ code, name: DEPT_NAMES[code], admin: `univ_${code.toLowerCase()}_admin` }))

  return {
    key: "large",
    title: "Large university (410 faculty, 4 years x 25 sections)",
    college: {
      id: "c0000000-0000-4000-8000-000000000003",
      username: "univ_admin",
      password: "College@123",
      name: "University College Administrator",
      institution: "SRKR University Campus (Large Benchmark)",
      email: "univ.admin@univ.example",
    },
    departments: departmentsList,
    departmentAdminPassword: "Dept@123",
    faculty,
    subjects: [...subjects.values()],
    sections: datasetSections,
    rooms,
    // Each department generates year by year, around everything published before it
    scheduleOrder: departments.flatMap((d) => [1, 2, 3, 4].map((y) => `${d}:${y}`)),
    notes: [
      `${datasetSections.length} sections (25 per year); years 1-3: 5 theory + 3 labs, year 4: 5 theory + 1 lab`,
      `${faculty.length} faculty (${owners.map((o) => `${o} ${counts.get(o)}`).join(", ")}), load ${Math.min(...loads)}-${Math.max(...loads)} periods/week`,
      `Theory rooms: ${THEORY_ROOMS} -> ${theoryPeriods} / ${THEORY_ROOMS * 44} periods = ${((theoryPeriods / (THEORY_ROOMS * 44)) * 100).toFixed(1)}% utilization`,
      `Lab rooms: ${LAB_ROOMS} -> ${labBlocks} / ${LAB_ROOMS * 11} lab blocks = ${((labBlocks / (LAB_ROOMS * 11)) * 100).toFixed(1)}% utilization`,
    ],
  }
}
