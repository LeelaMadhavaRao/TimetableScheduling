// Builds a timetabling instance from the two public Kaggle datasets referenced in the
// project presentation:
//
//   khhaledahmaad/academic-timetable    -> timetable.csv  (semester / week calendar)
//   kathuman/room-assignment-problem    -> rooms.csv, participants.csv
//
// Neither dataset is a course-timetabling instance (no courses, faculty or periods), so the
// mapping below takes what they do contain and synthesizes the rest with a fixed seed:
//
//   FROM KAGGLE                                   SYNTHESIZED (seeded, reproducible)
//   rooms.csv        -> theory classrooms          2 lab rooms (no labs in the data)
//   Team             -> section, size = members    faculty, their availability
//   Center (majority)-> department (Center group)  periods/week from preference share
//   Priority1..3     -> subjects a section takes    one lab per department's main activity
//   timetable.csv    -> teaching weeks per semester (reported only)
//
// Download the CSVs first (they declare no license, so they are not committed):
//   kaggle datasets download -d khhaledahmaad/academic-timetable -p experiments/data/kaggle --unzip
//   kaggle datasets download -d kathuman/room-assignment-problem -p experiments/data/kaggle --unzip

import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import type { Dataset, DatasetFaculty, DatasetRoom, DatasetSection, DatasetSubject } from "./dataset.ts"

export const KAGGLE_DIR = resolve(process.cwd(), process.env.KAGGLE_DIR || "experiments/data/kaggle")

function readCsv(file: string): Record<string, string>[] {
  const path = resolve(KAGGLE_DIR, file)
  if (!existsSync(path)) {
    throw new Error(`Missing ${path}. Download the Kaggle datasets first (see experiments/README.md).`)
  }
  const lines = readFileSync(path, "utf8").replace(/\r/g, "").split("\n").filter((l) => l.trim() !== "")
  const split = (line: string) => {
    const out: string[] = []
    let cur = ""
    let quoted = false
    for (const ch of line) {
      if (ch === '"') quoted = !quoted
      else if (ch === "," && !quoted) {
        out.push(cur)
        cur = ""
      } else cur += ch
    }
    out.push(cur)
    return out.map((v) => v.trim())
  }
  const header = split(lines[0])
  return lines.slice(1).map((line) => {
    const values = split(line)
    return Object.fromEntries(header.map((h, i) => [h, values[i] ?? ""]))
  })
}

// Departments are clusters of the participants' Centers (a team joins the department of
// its majority Center)
const CENTER_GROUPS: { code: string; name: string; centers: string[] }[] = [
  { code: "KC2", name: "Center 2 Department", centers: ["Center2"] },
  { code: "KC57", name: "Centers 5 & 7 Department", centers: ["Center5", "Center7"] },
  { code: "KC346", name: "Centers 3, 4, 6 & 8 Department", centers: ["Center3", "Center4", "Center6", "Center8", "Center1", "Center9"] },
]
// Activities nearly every team ranks highly are taught by a shared faculty pool of a common
// department, the way Mathematics/English faculty serve every engineering department
const COMMON_ACTIVITIES = ["Activity2", "Activity4"]
const COMMON_DEPT = { code: "KCOM", name: "Common Activities Department" }

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function loadKaggleDataset(): Dataset {
  const calendar = readCsv("timetable.csv")
  const roomsCsv = readCsv("rooms.csv")
  const participants = readCsv("participants.csv")
  const random = rng(2026)

  const weeksPerSemester = new Map<string, number>()
  for (const row of calendar) weeksPerSemester.set(row.academic_semester, (weeksPerSemester.get(row.academic_semester) || 0) + 1)

  // --- Sections from teams ---
  const teams = new Map<string, Record<string, string>[]>()
  for (const p of participants) {
    if (!p.Team) continue
    if (!teams.has(p.Team)) teams.set(p.Team, [])
    teams.get(p.Team)!.push(p)
  }
  const teamNames = [...teams.keys()].sort((a, b) => Number(a.replace(/\D/g, "")) - Number(b.replace(/\D/g, "")))

  const deptOfTeam = new Map<string, string>()
  const share = new Map<string, Map<string, number>>()
  for (const team of teamNames) {
    const members = teams.get(team)!
    const centers = new Map<string, number>()
    const activities = new Map<string, number>()
    for (const m of members) {
      centers.set(m.Center, (centers.get(m.Center) || 0) + 1)
      for (const k of ["Priority1", "Priority2", "Priority3"]) if (m[k]) activities.set(m[k], (activities.get(m[k]) || 0) + 1)
    }
    const majority = [...centers.entries()].sort((a, b) => b[1] - a[1])[0][0]
    deptOfTeam.set(team, (CENTER_GROUPS.find((g) => g.centers.includes(majority)) || CENTER_GROUPS[CENTER_GROUPS.length - 1]).code)
    share.set(team, new Map([...activities].map(([a, n]) => [a, n / members.length])))
  }

  const periodsFor = (s: number) => (s >= 0.9 ? 4 : s >= 0.5 ? 3 : 2)
  const subjectCode = (dept: string, activity: string) => `${dept}-${activity.replace("Activity", "ACT")}`

  // --- Subjects and course demand ---
  const subjects = new Map<string, DatasetSubject>()
  const demand: { section: string; dept: string; subject: string; owner: string; periods: number }[] = []
  for (const team of teamNames) {
    const dept = deptOfTeam.get(team)!
    const shares = share.get(team)!
    const taken = [...shares.entries()].filter(([, s]) => s >= 0.2).sort()
    for (const [activity, s] of taken) {
      const owner = COMMON_ACTIVITIES.includes(activity) ? COMMON_DEPT.code : dept
      const code = subjectCode(owner, activity)
      const periods = periodsFor(s)
      if (!subjects.has(code)) subjects.set(code, { code, name: `${activity} (${owner})`, dept: owner, type: "theory", periods })
      demand.push({ section: team, dept, subject: code, owner, periods: subjects.get(code)!.periods })
    }
    // Lab: the department-owned activity this team prefers most
    const main = taken.filter(([a]) => !COMMON_ACTIVITIES.includes(a)).sort((a, b) => b[1] - a[1])[0]
    if (main) {
      const code = `${subjectCode(dept, main[0])}L`
      if (!subjects.has(code)) subjects.set(code, { code, name: `${main[0]} Lab (${dept})`, dept, type: "lab", periods: 3 })
      demand.push({ section: team, dept, subject: code, owner: dept, periods: 3 })
    }
  }

  // --- Synthesized faculty: at most ~14 periods each; common subjects shared across departments ---
  const faculty: DatasetFaculty[] = []
  const teacherOf = new Map<string, string>()
  const load = new Map<string, number>()
  const newFaculty = (dept: string) => {
    const n = faculty.filter((f) => f.dept === dept).length + 1
    const f: DatasetFaculty = {
      code: `${dept}-F${String(n).padStart(2, "0")}`,
      name: `${dept} Faculty ${n}`,
      dept,
      phone: `97000${String(faculty.length + 1).padStart(5, "0")}`,
    }
    // About a quarter of the synthesized faculty are unavailable on one weekday
    if (random() < 0.25) {
      const off = Math.floor(random() * 5)
      f.availability = [0, 1, 2, 3, 4, 5].filter((d) => d !== off).map((day) => ({ day, start: 1, end: day === 5 ? 4 : 8 }))
    }
    faculty.push(f)
    load.set(f.code, 0)
    return f.code
  }
  // Labs go to the faculty who teaches the same activity's theory in that department
  const ordered = demand.slice().sort((a, b) => (a.subject.endsWith("L") ? 1 : 0) - (b.subject.endsWith("L") ? 1 : 0))
  for (const d of ordered) {
    const theoryCode = d.subject.endsWith("L") ? d.subject.slice(0, -1) : d.subject
    const pool = faculty.filter((f) => f.dept === d.owner && [...teacherOf.entries()].some(([k, v]) => v === f.code && k.endsWith(`|${theoryCode}`)))
    let chosen = pool.find((f) => (load.get(f.code) || 0) + d.periods <= 14)?.code
    if (!chosen) chosen = newFaculty(d.owner)
    teacherOf.set(`${d.section}|${d.subject}`, chosen)
    teacherOf.set(`${d.section}|${theoryCode}`, teacherOf.get(`${d.section}|${theoryCode}`) || chosen)
    load.set(chosen, (load.get(chosen) || 0) + d.periods)
  }

  const sections: DatasetSection[] = teamNames.map((team) => ({
    name: team.replace("Team", "TEAM-"),
    dept: deptOfTeam.get(team)!,
    year: 2,
    students: teams.get(team)!.length,
    courses: Object.fromEntries(demand.filter((d) => d.section === team).map((d) => [d.subject, teacherOf.get(`${team}|${d.subject}`)!])),
  }))

  const rooms: DatasetRoom[] = [
    ...roomsCsv.map((r) => ({ name: `KG-${r.Room}`, type: "theory" as const, capacity: Number(r.Size), building: "Kaggle rooms.csv" })),
    { name: "KG-LAB-1", type: "lab", capacity: 75, building: "Synthesized" },
    { name: "KG-LAB-2", type: "lab", capacity: 65, building: "Synthesized" },
  ]

  const departments = [...CENTER_GROUPS, COMMON_DEPT].map((d) => ({ code: d.code, name: d.name, admin: `${d.code.toLowerCase()}_admin` }))

  return {
    key: "kaggle",
    title: "Kaggle-derived college (academic-timetable + room-assignment-problem)",
    college: {
      id: "c0000000-0000-4000-8000-000000000002",
      username: "kaggle_admin",
      password: "College@123",
      name: "Kaggle Benchmark College Administrator",
      institution: "Kaggle Benchmark College",
      email: "kaggle.admin@benchmark.example",
    },
    departments,
    departmentAdminPassword: "Dept@123",
    faculty,
    subjects: [...subjects.values()],
    sections,
    rooms,
    scheduleOrder: CENTER_GROUPS.map((g) => g.code),
    notes: [
      `${participants.length} participants in ${teamNames.length} teams -> ${sections.length} sections (${Math.min(...sections.map((s) => s.students))}-${Math.max(...sections.map((s) => s.students))} students)`,
      `${roomsCsv.length} real rooms (${roomsCsv.map((r) => r.Size).join(", ")} seats) + 2 synthesized labs`,
      `${subjects.size} subjects from activity preferences, ${faculty.length} synthesized faculty (${faculty.filter((f) => f.availability).length} with a day off)`,
      `Calendar: ${[...weeksPerSemester].map(([s, w]) => `semester ${s} = ${w} weeks`).join(", ")}`,
    ],
  }
}
