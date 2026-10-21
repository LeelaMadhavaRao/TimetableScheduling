// Offline reproduction of the baseline-vs-enhanced comparison.
//
// Runs the exact modules the Supabase edge functions use (supabase/functions/_shared) for
// each department in turn, publishing each enhanced timetable so later departments must
// schedule around it, then measures incremental rescheduling.
//
//   npm run experiment                         SRKR sample college (see experiments/README.md)
//   DATASET=kaggle npm run experiment          Kaggle-derived college
//   ILP_SOLVER_URL=http://localhost:8000 RUNS=5 npm run experiment

import { setSolverUrl, silently } from "../supabase/functions/_shared/base-generator.ts"
import { buildSchedulingContext, evaluateHardConstraints } from "../supabase/functions/_shared/constraints.ts"
import { runBaseStage, runOptimizeStage } from "../supabase/functions/_shared/pipeline.ts"
import { runIncrementalReschedule } from "../supabase/functions/_shared/rescheduler.ts"
import { computeRoomCaps } from "../supabase/functions/_shared/capacity.ts"
import {
  AlgorithmMode,
  buildOccupancy,
  ClassroomOption,
  CourseAssignment,
  emptyOccupancy,
  FacultyAvailabilitySlot,
  Occupancy,
  TimetableSlot,
} from "../supabase/functions/_shared/scheduling-types.ts"
import { SRKR_DATASET } from "./dataset.ts"
import { loadKaggleDataset } from "./kaggle-dataset.ts"
import { buildLargeDataset } from "./large-dataset.ts"
import { mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const RUNS = Number(process.env.RUNS || 3)
const DATA = process.env.DATASET === "kaggle" ? loadKaggleDataset() : process.env.DATASET === "large" ? buildLargeDataset() : SRKR_DATASET
const { faculty: FACULTY, rooms: ROOMS, sections: SECTIONS, subjects: SUBJECTS } = DATA
const deptOfSection = new Map(SECTIONS.map((s) => [s.name, s.dept]))
setSolverUrl(process.env.ILP_SOLVER_URL || "http://localhost:8000")

const rooms: ClassroomOption[] = ROOMS.map((r) => ({ id: r.name, name: r.name, capacity: r.capacity, roomType: r.type }))
const availability: FacultyAvailabilitySlot[] = FACULTY.flatMap((f) =>
  (f.availability || []).map((a) => ({ facultyId: f.code, dayOfWeek: a.day as any, startPeriod: a.start as any, endPeriod: a.end as any })),
)

/** A scheduling chunk is a department ("CSE") or one year of a department ("CSE:2") */
const inChunk = (chunk: string, s: { dept: string; year: number }) => {
  const [dept, year] = chunk.split(":")
  return s.dept === dept && (!year || s.year === Number(year))
}
const sectionByName = new Map(SECTIONS.map((s) => [s.name, s]))

function coursesFor(chunk: string): CourseAssignment[] {
  return SECTIONS.filter((s) => inChunk(chunk, s)).flatMap((section) =>
    Object.entries(section.courses).map(([subjectCode, facultyCode]) => {
      const subject = SUBJECTS.find((s) => s.code === subjectCode)!
      return {
        sectionId: section.name,
        sectionName: section.name,
        subjectId: subject.code,
        subjectName: subject.name,
        subjectCode: subject.code,
        subjectType: subject.type,
        periodsPerWeek: subject.periods,
        facultyId: facultyCode,
        facultyCode,
        studentCount: section.students,
        yearLevel: section.year,
      }
    }),
  )
}

interface RunRecord {
  dept: string
  mode: AlgorithmMode
  run: number
  baseTimeMs: number
  base: any
  final: any
  process: any
  slots: TimetableSlot[]
}

async function runDepartment(dept: string, mode: AlgorithmMode, occupancy: Occupancy, run: number): Promise<RunRecord> {
  const courses = coursesFor(dept)
  const ctx = buildSchedulingContext(courses, rooms, availability, occupancy)
  const base = await silently(() => runBaseStage(mode, courses, rooms, availability, occupancy))
  const optimized = await silently(() => runOptimizeStage(mode, base.slots, base.seeds, ctx))
  return {
    dept,
    mode,
    run,
    baseTimeMs: base.timeMs,
    base: { ...evaluateHardConstraints(base.slots, ctx), seeds: base.seeds.length, diversification: base.diversification },
    final: optimized.final,
    process: optimized.process,
    slots: optimized.finalSlots,
  }
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)
const fmt = (x: number, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : String(x))

const ROWS: [string, (r: RunRecord) => number, boolean][] = [
  ["Hard violations (final)", (r) => r.final.hard.totalViolations, false],
  ["  double bookings", (r) => r.final.hard.criticalViolations, false],
  ["  availability breaches", (r) => r.final.hard.facultyAvailability, false],
  ["  >2 periods/day of a subject", (r) => r.final.hard.theoryDailyLimit, false],
  ["Coverage %", (r) => r.final.hard.coveragePercent, true],
  ["f1 faculty-gap score", (r) => r.final.objectives.facultyGap, true],
  ["f2 student-gap score", (r) => r.final.objectives.studentGap, true],
  ["f3 workload balance", (r) => r.final.objectives.workloadBalance, true],
  ["f4 morning preference", (r) => r.final.objectives.morningPreference, true],
  ["f5 lab compactness", (r) => r.final.objectives.labCompactness, true],
  ["Weighted quality Q", (r) => r.final.quality, true],
  ["Constraint preservation % (CP)", (r) => r.process.constraintPreservation, true],
  ["Initial diversity (PIE)", (r) => r.process.initialDiversity, true],
  ["Final diversity (GD)", (r) => r.process.finalDiversity, true],
  ["Mutation attempts / accepted", (r) => r.process.mutationAttemptsPerAcceptedMove, false],
  ["Hypervolume (returned set)", (r) => r.process.hypervolume, true],
  ["Hypervolume (final population)", (r) => r.process.populationHypervolume, true],
  ["Pareto front size", (r) => r.process.paretoFrontSize, true],
  ["Base stage time ms", (r) => r.baseTimeMs, false],
  ["Optimization time ms", (r) => r.process.optimizationTimeMs, false],
]

function table(dept: string, records: RunRecord[]): string {
  const b = records.filter((r) => r.mode === "baseline")
  const e = records.filter((r) => r.mode === "enhanced")
  const lines = [`\n### ${dept} (${RUNS} runs each, mean)\n`, "| Metric | Baseline | Enhanced | Better |", "|---|---:|---:|:--:|"]
  for (const [label, get, higher] of ROWS) {
    const bv = mean(b.map(get))
    const ev = mean(e.map(get))
    const better = Math.abs(bv - ev) < 1e-9 ? "=" : (higher ? ev > bv : ev < bv) ? "enhanced" : "baseline"
    lines.push(`| ${label} | ${fmt(bv)} | ${fmt(ev)} | ${better} |`)
  }
  return lines.join("\n")
}

async function main() {
  let committed: TimetableSlot[] = []
  const report: string[] = [
    `# Baseline vs Enhanced ILP-GA - ${DATA.title}`,
    "",
    ...(DATA.notes || []).map((n) => `- ${n}`),
    `- ${RUNS} runs per mode; departments scheduled in order ${DATA.scheduleOrder.join(" -> ")}, each around the previous ones' published timetables`,
    "",
  ]
  const all: RunRecord[] = []

  for (const [chunkIndex, dept] of DATA.scheduleOrder.entries()) {
    const occupancy = buildOccupancy(
      committed.map((s) => ({ faculty_id: s.facultyId, classroom_id: s.classroomId, day_of_week: s.day, start_period: s.startPeriod, end_period: s.endPeriod })),
    )
    // Same college-wide room reservation the edge function applies: rooms kept free for the
    // chunks still to be scheduled
    const later = DATA.scheduleOrder.slice(chunkIndex + 1).flatMap(coursesFor)
    occupancy.roomCaps = computeRoomCaps(rooms, occupancy, {
      theoryPeriods: later.filter((c) => c.subjectType === "theory").reduce((a, c) => a + c.periodsPerWeek, 0),
      labBlocks: later.filter((c) => c.subjectType === "lab").length,
    })
    const records: RunRecord[] = []
    for (let run = 1; run <= RUNS; run++) {
      for (const mode of ["baseline", "enhanced"] as AlgorithmMode[]) {
        const record = await runDepartment(dept, mode, occupancy, run)
        records.push(record)
        console.log(`${dept} ${mode} run ${run}: Q=${fmt(record.final.quality)} violations=${record.final.hard.totalViolations} coverage=${fmt(record.final.hard.coveragePercent, 1)}%`)
      }
    }
    report.push(table(dept, records))
    all.push(...records)

    // Publish the best enhanced run so the next department schedules around it
    const best = records.filter((r) => r.mode === "enhanced" && r.final.hard.criticalViolations === 0).sort((a, b) => b.final.quality - a.final.quality)[0]
    if (best) committed = committed.concat(best.slots)
  }

  // College-wide check: nothing published may double-book shared faculty or rooms
  const allCourses = DATA.scheduleOrder.flatMap(coursesFor)
  const collegeCheck = evaluateHardConstraints(committed, buildSchedulingContext(allCourses, rooms, availability, emptyOccupancy()))
  report.push(
    `\n### College-wide check of the published timetables\n\nFaculty double bookings: ${collegeCheck.facultyOverlap}, room double bookings: ${collegeCheck.roomOverlap}, section clashes: ${collegeCheck.sectionOverlap}, coverage ${fmt(collegeCheck.coveragePercent, 1)}%`,
  )

  // Incremental rescheduling: the first department's busiest faculty member goes on leave
  // on their busiest day
  const firstDept = DATA.scheduleOrder[0]
  const cseSlots = committed.filter((s) => inChunk(firstDept, sectionByName.get(s.sectionId)!))
  const load = new Map<string, number>()
  for (const s of cseSlots) load.set(`${s.facultyId}|${s.day}`, (load.get(`${s.facultyId}|${s.day}`) || 0) + 1)
  const [busiest] = [...load.entries()].sort((a, b) => b[1] - a[1])
  const [leaveFaculty, leaveDay] = busiest ? busiest[0].split("|") : [FACULTY[0].code, "0"]
  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
  const otherOcc = buildOccupancy(
    committed.filter((s) => !inChunk(firstDept, sectionByName.get(s.sectionId)!)).map((s) => ({ faculty_id: s.facultyId, classroom_id: s.classroomId, day_of_week: s.day, start_period: s.startPeriod, end_period: s.endPeriod })),
  )
  const resched = await silently(() => runIncrementalReschedule({
    currentSlots: cseSlots,
    courses: coursesFor(firstDept),
    rooms,
    availability,
    occupancy: otherOcc,
    disruption: { type: "faculty", facultyId: leaveFaculty, days: [Number(leaveDay)] },
  }))
  const fullRegen = all.filter((r) => r.dept === firstDept && r.mode === "enhanced").map((r) => r.baseTimeMs + r.process.optimizationTimeMs)
  const m = resched.metrics
  report.push(
    `\n### Incremental rescheduling (${leaveFaculty} unavailable on ${dayNames[Number(leaveDay)]})\n\n| Metric | Value |\n|---|---:|\n` +
      `| Latency ms | ${m.latencyMs} |\n| Full enhanced regeneration ms (mean) | ${fmt(mean(fullRegen), 0)} |\n` +
      `| Speed-up | ${fmt(mean(fullRegen) / Math.max(1, m.latencyMs), 1)}x |\n| Affected slots | ${m.affectedSlots}/${m.totalSlots} |\n` +
      `| SAF | ${fmt(m.scheduleAffectedFraction * 100, 1)}% |\n| Periods re-placed | ${m.periodsReplaced}/${m.periodsToReplace} |\n` +
      `| Quality before -> after | ${fmt(m.qualityBefore)} -> ${fmt(m.qualityAfter)} (${fmt(m.qualityChangePercent, 2)}%) |\n` +
      `| Hard violations after | ${resched.summary.hard.totalViolations} |`,
  )

  const output = report.join("\n")
  console.log(output)
  // Run from my-app/ (npm scripts do)
  const resultsDir = resolve(process.cwd(), "experiments/results")
  mkdirSync(resultsDir, { recursive: true })
  writeFileSync(resolve(resultsDir, `comparison-${DATA.key}.md`), output + "\n")
  writeFileSync(
    resolve(resultsDir, `comparison-${DATA.key}.json`),
    JSON.stringify({ runs: RUNS, records: all.map(({ slots, ...r }) => r), collegeCheck, reschedule: m }, null, 2),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
