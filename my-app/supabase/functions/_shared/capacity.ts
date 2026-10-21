// College-wide room reservation.
//
// Departments generate one after another. Without a reservation the first ones (whose
// optimizers prefer mornings) take most of the morning room capacity, and at high
// utilization the last departments are left with periods their sections cannot use.
// Each run may therefore occupy, at every period, only the rooms that remain after
// reserving a fair share for sections of the college that are not scheduled yet: their
// remaining demand spread evenly over the week.
//
// (A reserve proportional to the rooms still free at each period was also tried; it let
// early departments keep taking the scarce periods and left the last department ~30
// periods short on the 100-section benchmark, so the flat reserve is used.)

import { ClassroomOption, DAYS_PER_WEEK, Occupancy, PERIODS_PER_DAY, RoomCaps, slotKey } from "./scheduling-types.ts"

/** Demand of sections that still need a timetable (not in this run, not published) */
export interface RemainingDemand {
  theoryPeriods: number
  labBlocks: number
}

/** Theory periods usable by every year (Saturday afternoon is first-year only) */
const THEORY_SLOTS_PER_WEEK = 5 * PERIODS_PER_DAY + 4
/** Lab blocks per room per week: a morning and an afternoon block on weekdays, Saturday morning */
const LAB_BLOCKS_PER_WEEK = 5 * 2 + 1

export function computeRoomCaps(rooms: ClassroomOption[], occupancy: Occupancy, remaining: RemainingDemand): RoomCaps {
  const theoryReserve = remaining.theoryPeriods / THEORY_SLOTS_PER_WEEK
  const labReserve = remaining.labBlocks / LAB_BLOCKS_PER_WEEK
  const caps: RoomCaps = { theory: new Map(), lab: new Map() }

  for (let day = 0; day < DAYS_PER_WEEK; day++) {
    for (let p = 1; p <= PERIODS_PER_DAY; p++) {
      const key = slotKey(day, p)
      const saturdayAfternoon = day === 5 && p > 4
      for (const type of ["theory", "lab"] as const) {
        const free = rooms.filter((r) => r.roomType === type && !occupancy.roomBusy.get(r.id)?.has(key)).length
        const reserve = saturdayAfternoon ? 0 : Math.floor(type === "theory" ? theoryReserve : labReserve)
        caps[type].set(key, Math.max(0, free - reserve))
      }
    }
  }
  return caps
}

/** Rooms of `type` this run may still occupy at `key` (Infinity when no reservation applies) */
export function roomCap(occupancy: Occupancy, type: "theory" | "lab", key: string): number {
  return occupancy.roomCaps?.[type].get(key) ?? Infinity
}
