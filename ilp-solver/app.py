"""
ILP Timetable Solver Service using OR-Tools CP-SAT
This microservice solves the lab scheduling problem using constraint programming.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ortools.sat.python import cp_model
from typing import List, Dict, Optional
import uvicorn
import time

app = FastAPI(title="ILP Timetable Solver", version="1.0.0")

# Enable CORS for Supabase Edge Functions
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Input Models
class Course(BaseModel):
    sectionId: str
    sectionName: str
    subjectId: str
    subjectCode: str
    facultyId: str
    facultyCode: str
    studentCount: int
    yearLevel: int

class Room(BaseModel):
    id: str
    name: str
    capacity: int

class AvailabilitySlot(BaseModel):
    dayOfWeek: int
    startPeriod: int
    endPeriod: int

class FacultyAvailability(BaseModel):
    facultyId: str
    slots: List[AvailabilitySlot]

class Rules(BaseModel):
    labPeriods: int
    daysPerWeek: int
    periodsPerDay: int

class ProblemData(BaseModel):
    courses: List[Course]
    rooms: List[Room]
    facultyAvailability: List[FacultyAvailability]
    rules: Rules

# Output Models
class Assignment(BaseModel):
    sectionId: str
    subjectId: str
    day: int
    startPeriod: int
    endPeriod: int
    roomId: str

class SolutionResponse(BaseModel):
    success: bool
    status: str
    message: str
    assignments: List[Assignment]
    solveTimeMs: int

@app.get("/")
def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "ILP Timetable Solver",
        "solver": "OR-Tools CP-SAT"
    }

@app.post("/solve-labs", response_model=SolutionResponse)
def solve_lab_timetable(data: ProblemData):
    """
    Solve the lab scheduling problem using OR-Tools CP-SAT solver.
    
    Decision Variables: L[course_idx][day][block][room_idx]
    - binary: 1 if lab course is assigned to (day, block, room), 0 otherwise
    
    Constraints:
    1. Each lab scheduled exactly once
    2. Room capacity constraints
    3. Room non-overlap (no double booking per period)
    4. Section non-overlap (students can't be in two places)
    5. Faculty non-overlap (faculty can't teach two classes simultaneously)
    6. Faculty availability constraints
    7. Saturday afternoon only for year 1
    """
    
    start_time = time.time()
    
    # Log incoming request
    print(f"\n[Solver] ===== NEW REQUEST RECEIVED =====")
    print(f"[Solver] 📥 Incoming solve-labs request at {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"[Solver] Request Details:")
    print(f"[Solver]   • Courses (labs): {len(data.courses)}")
    print(f"[Solver]   • Rooms: {len(data.rooms)}")
    print(f"[Solver]   • Faculty with availability: {len(data.facultyAvailability)}")
    print(f"[Solver]   • Days per week: {data.rules.daysPerWeek}")
    print(f"[Solver]   • Periods per day: {data.rules.periodsPerDay}")
    print(f"[Solver]   • Lab periods: {data.rules.labPeriods}")
    print(f"[Solver] ====================================\n")
    
    try:
        model = cp_model.CpModel()
        
        courses = data.courses
        rooms = data.rooms
        rules = data.rules
        
        # Block definitions: Morning (M) = periods 1-4, Afternoon (A) = periods 5-8
        blocks = ["M", "A"]
        block_periods = {
            "M": list(range(1, 5)),  # [1, 2, 3, 4]
            "A": list(range(5, 9)),  # [5, 6, 7, 8]
        }
        
        days = list(range(rules.daysPerWeek))  # 0-5 (Mon-Sat)
        
        # Build faculty availability map
        faculty_avail_map = {}
        print(f"\n[Solver] 📊 FACULTY AVAILABILITY ANALYSIS:")
        for fa in data.facultyAvailability:
            if not fa.slots:  # Empty means available all times
                faculty_avail_map[fa.facultyId] = "all"
                print(f"[Solver]   {fa.facultyId}: FULL AVAILABILITY (no restrictions)")
            else:
                avail_set = set()
                for slot in fa.slots:
                    for period in range(slot.startPeriod, slot.endPeriod + 1):
                        avail_set.add((slot.dayOfWeek, period))
                faculty_avail_map[fa.facultyId] = avail_set
                # Count blocks this faculty can teach
                block_count = 0
                for slot in fa.slots:
                    # Count 4-period blocks within this slot
                    block_count += max(0, slot.endPeriod - slot.startPeriod - 3 + 1)
                print(f"[Solver]   {fa.facultyId}: {len(fa.slots)} windows, {len(avail_set)} period-slots, ~{block_count} possible 4-period blocks")
                print(f"[Solver]      Windows: {[(s.dayOfWeek, s.startPeriod, s.endPeriod) for s in fa.slots]}")
        
        print(f"\n[Solver] Problem size: {len(courses)} labs, {len(rooms)} rooms")
        
        # ============================================
        # DECISION VARIABLES
        # ============================================
        # L[course_idx][day][block][room_idx] = 1 if assigned
        L = {}
        valid_assignments = []  # Track valid variable combinations
        
        for c_idx, course in enumerate(courses):
            for day in days:
                for block in blocks:
                    # Saturday afternoon only for year 1
                    if day == 5 and block == "A" and course.yearLevel != 1:
                        continue
                    
                    # Check faculty availability for all periods in block
                    faculty_avail = faculty_avail_map.get(course.facultyId, "all")
                    if faculty_avail != "all":
                        periods_in_block = block_periods[block]
                        if not all((day, p) in faculty_avail for p in periods_in_block):
                            continue  # Faculty not available for this block
                    
                    for r_idx, room in enumerate(rooms):
                        # RELAXED CAPACITY: Allow "best fit" rooms
                        # Accept rooms with at least 85% capacity to handle shortages
                        min_acceptable = int(course.studentCount * 0.85)
                        if room.capacity < min_acceptable:
                            continue
                        
                        # Create decision variable
                        var_name = f"L_{c_idx}_{day}_{block}_{r_idx}"
                        L[(c_idx, day, block, r_idx)] = model.NewBoolVar(var_name)
                        valid_assignments.append((c_idx, day, block, r_idx))
        
        print(f"[Solver] Created {len(valid_assignments)} decision variables")
        
        # ============================================
        # CONSTRAINT 1: Each lab scheduled exactly once (HARD REQUIREMENT)
        # ============================================
        print(f"\n[Solver] 🔍 DEBUG: Checking valid assignments for all labs...")
        print(f"[Solver] Total valid assignment combinations: {len(valid_assignments)}")
        
        unschedulable_labs = []
        for c_idx, course in enumerate(courses):
            course_vars = [
                L[(c_idx, day, block, r_idx)]
                for (c, day, block, r_idx) in valid_assignments
                if c == c_idx
            ]
            
            print(f"[Solver] Lab {c_idx}: {course.subjectCode} ({course.sectionName}, {course.studentCount} students)")
            print(f"[Solver]   Faculty: {course.facultyCode}")
            print(f"[Solver]   Valid assignments: {len(course_vars)}")
            
            if course_vars:
                # HARD CONSTRAINT: Exactly 1 assignment per lab
                model.Add(sum(course_vars) == 1)
            else:
                # Diagnose why no valid assignments - DETAILED ANALYSIS
                suitable_rooms = [r for r in rooms if r.capacity >= int(course.studentCount * 0.85)]
                faculty_avail = faculty_avail_map.get(course.facultyId, "all")
                faculty_slots = [] if faculty_avail == "all" else list(data.facultyAvailability)
                faculty_info = next((fa for fa in data.facultyAvailability if fa.facultyId == course.facultyId), None)
                faculty_slots_list = faculty_info.slots if faculty_info else []
                
                print(f"[Solver]   ❌ NO VALID ASSIGNMENTS FOUND")
                print(f"[Solver]   Suitable rooms (>=85% capacity): {len(suitable_rooms)}")
                print(f"[Solver]   Rooms list: {[f'{r.name}({r.capacity})' for r in suitable_rooms[:5]]}")
                print(f"[Solver]   Faculty availability windows: {len(faculty_slots_list)}")
                print(f"[Solver]   Faculty slots detail: {[(s.dayOfWeek, s.startPeriod, s.endPeriod) for s in faculty_slots_list]}")
                
                # Check which specific constraints are blocking
                blocking_reasons = []
                if len(suitable_rooms) == 0:
                    blocking_reasons.append(f"No rooms with capacity >= {int(course.studentCount * 0.85)}")
                if len(faculty_slots_list) == 0:
                    blocking_reasons.append(f"Faculty {course.facultyCode} has NO availability windows")
                else:
                    # Check if faculty slots allow 4-period blocks
                    valid_blocks = []
                    for slot in faculty_slots_list:
                        for start_p in range(slot.startPeriod, slot.endPeriod - 3 + 1):
                            valid_blocks.append((slot.dayOfWeek, start_p))
                    if len(valid_blocks) == 0:
                        blocking_reasons.append(f"Faculty windows don't allow 4-period blocks")
                    print(f"[Solver]   Possible 4-period blocks for faculty: {len(valid_blocks)}")
                
                # Track labs that cannot be scheduled
                unschedulable_labs.append({
                    "subjectCode": course.subjectCode,
                    "section": course.sectionName,
                    "studentCount": course.studentCount,
                    "facultyCode": course.facultyCode,
                    "suitableRooms": len(suitable_rooms),
                    "facultyWindows": len(faculty_slots_list),
                    "blockingReasons": blocking_reasons,
                    "reason": " | ".join(blocking_reasons) if blocking_reasons else "Unknown constraint conflict"
                })
        
        # FAIL HARD if any labs cannot be scheduled
        if unschedulable_labs:
            error_details = "\n".join([
                f"  • {lab['subjectCode']} ({lab['section']}, {lab['studentCount']} students)\n"
                f"    Faculty: {lab['facultyCode']}, Suitable Rooms: {lab['suitableRooms']}, Availability Windows: {lab['facultyWindows']}"
                for lab in unschedulable_labs
            ])
            raise ValueError(
                f"INFEASIBLE: Cannot schedule {len(unschedulable_labs)} lab(s):\n{error_details}\n\n"
                f"Diagnosis:\n"
                f"- Total rooms: {len(rooms)}\n"
                f"- Total time blocks: {len(days)} days × {len(blocks)} blocks = {len(days) * len(blocks)}\n"
                f"- Total valid assignments checked: {len(valid_assignments)}\n"
                f"\nPlease check: (1) Lab room capacities, (2) Faculty availability, (3) Time block availability"
            )
        
        print(f"[Solver] ✓ Added constraint: each of {len(courses)} labs exactly once (HARD)")
        
        # ============================================
        # CONSTRAINT 2: Room non-overlap (period-level)
        # ============================================
        for r_idx in range(len(rooms)):
            for day in days:
                for period in range(1, rules.periodsPerDay + 1):
                    # Find all variables that use this room at this period
                    period_vars = []
                    for (c_idx, d, block, r) in valid_assignments:
                        if r == r_idx and d == day:
                            if period in block_periods[block]:
                                period_vars.append(L[(c_idx, d, block, r)])
                    
                    if period_vars:
                        model.Add(sum(period_vars) <= 1)
        
        print("[Solver] ✓ Added constraint: room non-overlap")
        
        # ============================================
        # CONSTRAINT 3: Section non-overlap (period-level)
        # ============================================
        # Group courses by section to prevent section from having multiple classes at same time
        section_to_courses = {}
        for c_idx, course in enumerate(courses):
            if course.sectionId not in section_to_courses:
                section_to_courses[course.sectionId] = []
            section_to_courses[course.sectionId].append(c_idx)
        
        for section_id, course_indices in section_to_courses.items():
            for day in days:
                for period in range(1, rules.periodsPerDay + 1):
                    period_vars = []
                    for c_idx in course_indices:
                        for (c, d, block, r_idx) in valid_assignments:
                            if c == c_idx and d == day:
                                if period in block_periods[block]:
                                    period_vars.append(L[(c, d, block, r_idx)])
                    
                    if period_vars:
                        model.Add(sum(period_vars) <= 1)
        
        print("[Solver] ✓ Added constraint: section non-overlap")
        
        # ============================================
        # CONSTRAINT 4: Faculty non-overlap (period-level)
        # ============================================
        faculty_to_courses = {}
        for c_idx, course in enumerate(courses):
            if course.facultyId not in faculty_to_courses:
                faculty_to_courses[course.facultyId] = []
            faculty_to_courses[course.facultyId].append(c_idx)
        
        for faculty_id, course_indices in faculty_to_courses.items():
            for day in days:
                for period in range(1, rules.periodsPerDay + 1):
                    period_vars = []
                    for c_idx in course_indices:
                        for (c, d, block, r_idx) in valid_assignments:
                            if c == c_idx and d == day:
                                if period in block_periods[block]:
                                    period_vars.append(L[(c, d, block, r_idx)])
                    
                    if period_vars:
                        model.Add(sum(period_vars) <= 1)
        
        print("[Solver] ✓ Added constraint: faculty non-overlap")
        
        # ============================================
        # OBJECTIVE: Prefer exact capacity matches
        # ============================================
        # Minimize "capacity waste" = sum of (room_capacity - student_count) for all assignments
        capacity_penalties = []
        for (c_idx, day, block, r_idx) in valid_assignments:
            course = courses[c_idx]
            room = rooms[r_idx]
            # Penalty = excess capacity (0 if perfect match)
            penalty = max(0, room.capacity - course.studentCount)
            capacity_penalties.append(penalty * L[(c_idx, day, block, r_idx)])
        
        if capacity_penalties:
            model.Minimize(sum(capacity_penalties))
            print("[Solver] ✓ Objective: Minimize capacity waste (prefer exact matches)")
        
        # ============================================
        # SOLVE THE MODEL
        # ============================================
        print("[Solver] Starting CP-SAT solver...")
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = 60.0  # 60 second timeout
        solver.parameters.log_search_progress = False
        
        status = solver.Solve(model)
        
        solve_time_ms = int((time.time() - start_time) * 1000)
        
        # ============================================
        # PROCESS SOLUTION
        # ============================================
        if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
            print(f"[Solver] ✅ Solution found! Status: {'OPTIMAL' if status == cp_model.OPTIMAL else 'FEASIBLE'}")
            
            assignments = []
            for (c_idx, day, block, r_idx) in valid_assignments:
                if solver.Value(L[(c_idx, day, block, r_idx)]) == 1:
                    course = courses[c_idx]
                    room = rooms[r_idx]
                    periods = block_periods[block]
                    
                    assignments.append(Assignment(
                        sectionId=course.sectionId,
                        subjectId=course.subjectId,
                        day=day,
                        startPeriod=periods[0],
                        endPeriod=periods[-1],
                        roomId=room.id
                    ))
            
            print(f"[Solver] Extracted {len(assignments)} lab assignments")
            
            print(f"\n[Solver] ✅ SUCCESS: Request completed in {solve_time_ms}ms")
            print(f"[Solver] Response: {len(assignments)} lab assignments scheduled")
            print(f"[Solver] Status: {'OPTIMAL' if status == cp_model.OPTIMAL else 'FEASIBLE'}\n")
            
            return SolutionResponse(
                success=True,
                status="OPTIMAL" if status == cp_model.OPTIMAL else "FEASIBLE",
                message=f"Successfully scheduled {len(assignments)} labs",
                assignments=assignments,
                solveTimeMs=solve_time_ms
            )
        
        elif status == cp_model.INFEASIBLE:
            print("[Solver] ❌ Problem is INFEASIBLE")
            print(f"[Solver] Request failed: No feasible solution found\n")
            
            # Diagnose why infeasible
            diagnostic = []
            for c_idx, course in enumerate(courses):
                course_has_vars = any(c == c_idx for (c, d, b, r) in valid_assignments)
                if not course_has_vars:
                    diagnostic.append(f"• {course.subjectCode} ({course.sectionName}): No valid rooms/times available (check capacity & faculty availability)")
            
            diag_msg = "\n".join(diagnostic) if diagnostic else "Unknown reason"
            
            return SolutionResponse(
                success=False,
                status="INFEASIBLE",
                message=f"No feasible solution exists.\n\nPossible issues:\n{diag_msg}\n\nSuggestions:\n• Add more lab rooms\n• Increase room capacities\n• Expand faculty availability\n• Reduce number of sections",
                assignments=[],
                solveTimeMs=solve_time_ms
            )
        
        else:
            print(f"[Solver] ⚠️ Solver status: {solver.StatusName(status)}")
            print(f"[Solver] Request failed: Solver returned {solver.StatusName(status)}\n")
            return SolutionResponse(
                success=False,
                status=solver.StatusName(status),
                message=f"Solver terminated with status: {solver.StatusName(status)}",
                assignments=[],
                solveTimeMs=solve_time_ms
            )
    
    except Exception as e:
        print(f"[Solver] ❌ Error: {str(e)}")
        print(f"[Solver] Request failed with exception: {type(e).__name__}\n")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# THEORY SOLVER ENDPOINT
# ============================================

class TheoryCourse(BaseModel):
    sectionId: str
    sectionName: str
    subjectId: str
    subjectCode: str
    facultyId: str
    facultyCode: str
    studentCount: int
    yearLevel: int
    periodsPerWeek: int  # Theory courses have variable periods

class ExistingAssignment(BaseModel):
    sectionId: str
    day: int
    startPeriod: int
    endPeriod: int
    facultyId: str
    roomId: str

class TheoryRules(BaseModel):
    daysPerWeek: int
    periodsPerDay: int
    maxPeriodsPerBlock: int  # Max consecutive periods (e.g., 3)
    maxPeriodsPerDay: int    # Max periods per section per day

class TheoryProblemData(BaseModel):
    courses: List[TheoryCourse]
    rooms: List[Room]
    facultyAvailability: List[FacultyAvailability]
    existingAssignments: List[ExistingAssignment]  # Lab slots already scheduled
    rules: TheoryRules

@app.post("/solve-theory", response_model=SolutionResponse)
def solve_theory_timetable(data: TheoryProblemData):
    """
    Solve the theory scheduling problem using OR-Tools CP-SAT solver.
    
    This is called as a FALLBACK when greedy algorithm fails to schedule >80% of theory periods.
    
    Decision Variables: T[course_idx][day][start_period][block_size][room_idx]
    - binary: 1 if theory course block is assigned to (day, start, size, room), 0 otherwise
    
    Constraints:
    1. Each theory course gets exactly its required periods per week
    2. Room capacity constraints
    3. Room non-overlap (no double booking)
    4. Section non-overlap (students can't be in two places)
    5. Faculty non-overlap (faculty can't teach two classes simultaneously)
    6. Faculty availability constraints
    7. Don't conflict with existing lab assignments
    8. No splitting across lunch (periods 4-5)
    9. Max periods per day per section
    """
    
    start_time = time.time()
    
    print(f"\n[Theory Solver] ===== NEW THEORY REQUEST RECEIVED =====")
    print(f"[Theory Solver] 📥 Request at {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"[Theory Solver] Request Details:")
    print(f"[Theory Solver]   • Theory courses: {len(data.courses)}")
    print(f"[Theory Solver]   • Rooms: {len(data.rooms)}")
    print(f"[Theory Solver]   • Existing assignments (labs): {len(data.existingAssignments)}")
    print(f"[Theory Solver]   • Total periods needed: {sum(c.periodsPerWeek for c in data.courses)}")
    print(f"[Theory Solver] ====================================\n")
    
    try:
        model = cp_model.CpModel()
        
        courses = data.courses
        rooms = data.rooms
        rules = data.rules
        
        days = list(range(rules.daysPerWeek))  # 0-5 (Mon-Sat)
        block_sizes = [1, 2, 3]  # Possible block sizes (1, 2, or 3 periods)
        
        # Build faculty availability map
        faculty_avail_map = {}
        for fa in data.facultyAvailability:
            if not fa.slots:
                faculty_avail_map[fa.facultyId] = "all"
            else:
                avail_set = set()
                for slot in fa.slots:
                    for period in range(slot.startPeriod, slot.endPeriod + 1):
                        avail_set.add((slot.dayOfWeek, period))
                faculty_avail_map[fa.facultyId] = avail_set
        
        # Build existing assignments map (from labs)
        existing_faculty = {}  # facultyId -> Set of "day-period"
        existing_room = {}     # roomId -> Set of "day-period"
        existing_section = {}  # sectionId -> Set of "day-period"
        
        for assign in data.existingAssignments:
            for p in range(assign.startPeriod, assign.endPeriod + 1):
                key = f"{assign.day}-{p}"
                
                if assign.facultyId not in existing_faculty:
                    existing_faculty[assign.facultyId] = set()
                existing_faculty[assign.facultyId].add(key)
                
                if assign.roomId not in existing_room:
                    existing_room[assign.roomId] = set()
                existing_room[assign.roomId].add(key)
                
                if assign.sectionId not in existing_section:
                    existing_section[assign.sectionId] = set()
                existing_section[assign.sectionId].add(key)
        
        print(f"[Theory Solver] Built existing assignment maps")
        
        # ============================================
        # DECISION VARIABLES
        # ============================================
        # T[course_idx][day][start][size][room_idx] = 1 if assigned
        T = {}
        valid_assignments = []
        
        for c_idx, course in enumerate(courses):
            for day in days:
                max_period = 4 if (day == 5 and course.yearLevel != 1) else 8
                
                for size in block_sizes:
                    if size > course.periodsPerWeek:
                        continue  # Block can't be bigger than total needed
                    
                    for start in range(1, max_period - size + 2):
                        end = start + size - 1
                        if end > max_period:
                            continue
                        
                        # Don't split across lunch (periods 4 and 5)
                        if start <= 4 and end >= 5:
                            continue
                        
                        # Check faculty availability
                        faculty_avail = faculty_avail_map.get(course.facultyId, "all")
                        if faculty_avail != "all":
                            if not all((day, p) in faculty_avail for p in range(start, end + 1)):
                                continue
                        
                        # Check not conflicting with existing assignments
                        section_blocked = existing_section.get(course.sectionId, set())
                        faculty_blocked = existing_faculty.get(course.facultyId, set())
                        
                        conflict = False
                        for p in range(start, end + 1):
                            key = f"{day}-{p}"
                            if key in section_blocked or key in faculty_blocked:
                                conflict = True
                                break
                        
                        if conflict:
                            continue
                        
                        for r_idx, room in enumerate(rooms):
                            if room.capacity < course.studentCount:
                                continue
                            
                            # Check room not blocked by existing assignments
                            room_blocked = existing_room.get(room.id, set())
                            room_conflict = False
                            for p in range(start, end + 1):
                                if f"{day}-{p}" in room_blocked:
                                    room_conflict = True
                                    break
                            
                            if room_conflict:
                                continue
                            
                            var_name = f"T_{c_idx}_{day}_{start}_{size}_{r_idx}"
                            T[(c_idx, day, start, size, r_idx)] = model.NewBoolVar(var_name)
                            valid_assignments.append((c_idx, day, start, size, r_idx))
        
        print(f"[Theory Solver] Created {len(valid_assignments)} decision variables")
        
        # ============================================
        # CONSTRAINT 1: Each course gets exact periods
        # ============================================
        for c_idx, course in enumerate(courses):
            course_period_vars = []
            for (c, day, start, size, r_idx) in valid_assignments:
                if c == c_idx:
                    # Weight by block size
                    course_period_vars.append(size * T[(c, day, start, size, r_idx)])
            
            if course_period_vars:
                model.Add(sum(course_period_vars) == course.periodsPerWeek)
            else:
                print(f"[Theory Solver] ❌ No valid slots for {course.subjectCode} ({course.sectionName})")
        
        # ============================================
        # CONSTRAINT 2: Room non-overlap (period-level)
        # ============================================
        for r_idx in range(len(rooms)):
            for day in days:
                for period in range(1, rules.periodsPerDay + 1):
                    period_vars = []
                    for (c_idx, d, start, size, r) in valid_assignments:
                        if r == r_idx and d == day:
                            end = start + size - 1
                            if start <= period <= end:
                                period_vars.append(T[(c_idx, d, start, size, r)])
                    
                    if period_vars:
                        model.Add(sum(period_vars) <= 1)
        
        # ============================================
        # CONSTRAINT 3: Section non-overlap
        # ============================================
        section_to_courses = {}
        for c_idx, course in enumerate(courses):
            if course.sectionId not in section_to_courses:
                section_to_courses[course.sectionId] = []
            section_to_courses[course.sectionId].append(c_idx)
        
        for section_id, course_indices in section_to_courses.items():
            for day in days:
                for period in range(1, rules.periodsPerDay + 1):
                    period_vars = []
                    for c_idx in course_indices:
                        for (c, d, start, size, r_idx) in valid_assignments:
                            if c == c_idx and d == day:
                                end = start + size - 1
                                if start <= period <= end:
                                    period_vars.append(T[(c, d, start, size, r_idx)])
                    
                    if period_vars:
                        model.Add(sum(period_vars) <= 1)
        
        # ============================================
        # CONSTRAINT 4: Faculty non-overlap
        # ============================================
        faculty_to_courses = {}
        for c_idx, course in enumerate(courses):
            if course.facultyId not in faculty_to_courses:
                faculty_to_courses[course.facultyId] = []
            faculty_to_courses[course.facultyId].append(c_idx)
        
        for faculty_id, course_indices in faculty_to_courses.items():
            for day in days:
                for period in range(1, rules.periodsPerDay + 1):
                    period_vars = []
                    for c_idx in course_indices:
                        for (c, d, start, size, r_idx) in valid_assignments:
                            if c == c_idx and d == day:
                                end = start + size - 1
                                if start <= period <= end:
                                    period_vars.append(T[(c, d, start, size, r_idx)])
                    
                    if period_vars:
                        model.Add(sum(period_vars) <= 1)
        
        # ============================================
        # CONSTRAINT 5: Max periods per day per section
        # ============================================
        for section_id, course_indices in section_to_courses.items():
            for day in days:
                day_period_vars = []
                for c_idx in course_indices:
                    for (c, d, start, size, r_idx) in valid_assignments:
                        if c == c_idx and d == day:
                            day_period_vars.append(size * T[(c, d, start, size, r_idx)])
                
                if day_period_vars:
                    model.Add(sum(day_period_vars) <= rules.maxPeriodsPerDay)
        
        # ============================================
        # OBJECTIVE: Balanced schedule
        # ============================================
        # 1. Minimize capacity waste
        # 2. Prefer morning slots
        # 3. Distribute across days
        
        objective_terms = []
        
        for (c_idx, day, start, size, r_idx) in valid_assignments:
            course = courses[c_idx]
            room = rooms[r_idx]
            
            # Capacity waste penalty
            capacity_penalty = max(0, room.capacity - course.studentCount)
            
            # Afternoon penalty (prefer morning)
            afternoon_penalty = 10 if start >= 5 else 0
            
            # Saturday penalty
            saturday_penalty = 5 if day == 5 else 0
            
            total_penalty = capacity_penalty + afternoon_penalty + saturday_penalty
            objective_terms.append(total_penalty * T[(c_idx, day, start, size, r_idx)])
        
        if objective_terms:
            model.Minimize(sum(objective_terms))
        
        # ============================================
        # SOLVE
        # ============================================
        print("[Theory Solver] Starting CP-SAT solver...")
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = 30.0  # 30 second timeout (faster than labs)
        solver.parameters.log_search_progress = False
        
        status = solver.Solve(model)
        solve_time_ms = int((time.time() - start_time) * 1000)
        
        # ============================================
        # PROCESS SOLUTION
        # ============================================
        if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
            print(f"[Theory Solver] ✅ Solution found! Status: {'OPTIMAL' if status == cp_model.OPTIMAL else 'FEASIBLE'}")
            
            assignments = []
            for (c_idx, day, start, size, r_idx) in valid_assignments:
                if solver.Value(T[(c_idx, day, start, size, r_idx)]) == 1:
                    course = courses[c_idx]
                    room = rooms[r_idx]
                    
                    assignments.append(Assignment(
                        sectionId=course.sectionId,
                        subjectId=course.subjectId,
                        day=day,
                        startPeriod=start,
                        endPeriod=start + size - 1,
                        roomId=room.id
                    ))
            
            total_periods = sum(a.endPeriod - a.startPeriod + 1 for a in assignments)
            print(f"[Theory Solver] Extracted {len(assignments)} blocks ({total_periods} total periods)")
            
            return SolutionResponse(
                success=True,
                status="OPTIMAL" if status == cp_model.OPTIMAL else "FEASIBLE",
                message=f"Successfully scheduled {len(assignments)} theory blocks ({total_periods} periods)",
                assignments=assignments,
                solveTimeMs=solve_time_ms
            )
        
        elif status == cp_model.INFEASIBLE:
            print("[Theory Solver] ❌ Problem is INFEASIBLE")
            return SolutionResponse(
                success=False,
                status="INFEASIBLE",
                message="No feasible theory schedule exists. Check room capacities and faculty availability.",
                assignments=[],
                solveTimeMs=solve_time_ms
            )
        
        else:
            print(f"[Theory Solver] ⚠️ Solver status: {solver.StatusName(status)}")
            return SolutionResponse(
                success=False,
                status=solver.StatusName(status),
                message=f"Solver terminated with status: {solver.StatusName(status)}",
                assignments=[],
                solveTimeMs=solve_time_ms
            )
    
    except Exception as e:
        print(f"[Theory Solver] ❌ Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
