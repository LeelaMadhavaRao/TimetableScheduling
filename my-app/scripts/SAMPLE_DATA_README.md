# Sample Data Documentation

## Overview

This sample data script (`015_sample_data_8_sections.sql`) creates a complete test dataset for the timetable scheduling system with the following specifications:

## Data Structure

### 1. Departments (2)
| Department | Code |
|------------|------|
| Computer Science & Engineering | CSE |
| Information Technology | IT |

### 2. Classrooms (5 total)
| Room | Type | Capacity | Building |
|------|------|----------|----------|
| CR-101 | Theory | 60 | Main Block |
| CR-102 | Theory | 60 | Main Block |
| CR-103 | Theory | 60 | Main Block |
| LAB-01 | Lab | 60 | Lab Block |
| LAB-02 | Lab | 60 | Lab Block |

**Note**: Lab rooms have capacity 60 to comfortably accommodate sections with up to 50 students (85% capacity rule satisfied).

### 3. Faculty (12 members)
| Department | Faculty Count |
|------------|---------------|
| CSE | 6 (CSE-F001 to CSE-F006) |
| IT | 6 (IT-F001 to IT-F006) |

### 4. Subjects (16 total)

#### Theory Subjects (10) - 4 periods/week each
| Code | Name | Department |
|------|------|------------|
| CS201 | Data Structures | CSE |
| CS301 | Database Management | CSE |
| CS302 | Operating Systems | CSE |
| CS303 | Computer Networks | CSE |
| CS401 | Software Engineering | CSE |
| IT201 | Web Technologies | IT |
| IT301 | Cloud Computing | IT |
| IT302 | Cyber Security | IT |
| IT303 | Machine Learning | IT |
| IT401 | Big Data Analytics | IT |

#### Lab Subjects (6) - 3 periods/week each (continuous)
| Code | Name | Department |
|------|------|------------|
| CS201L | Data Structures Lab | CSE |
| CS301L | DBMS Lab | CSE |
| CS303L | Networks Lab | CSE |
| IT201L | Web Tech Lab | IT |
| IT301L | Cloud Lab | IT |
| IT303L | ML Lab | IT |

### 5. Sections (8 total)
| Section | Year | Department | Strength |
|---------|------|------------|----------|
| CSE-2A | 2 | CSE | 50 |
| CSE-2B | 2 | CSE | 50 |
| CSE-3A | 3 | CSE | 45 |
| CSE-3B | 3 | CSE | 45 |
| IT-2A | 2 | IT | 50 |
| IT-2B | 2 | IT | 50 |
| IT-3A | 3 | IT | 45 |
| IT-3B | 3 | IT | 45 |

### 6. Section-Subject Assignments
Each section has **8 subjects**:
- 5 Theory subjects × 4 periods = **20 theory periods/week**
- 3 Lab subjects × 3 periods = **9 lab periods/week** (3 continuous blocks)
- **Total: 29 periods/week per section**

## Scheduling Constraints

### Lab Rules (Updated)
- **3 consecutive periods** per lab session (instead of previous 4)
- Labs scheduled **once per week** only
- Labs use rooms with `room_type = 'lab'`
- Labs are scheduled FIRST (higher priority)

### Theory Rules
- **4 periods per week** per theory subject
- Maximum **2 periods per day** per subject
- Can be split across multiple days
- Theory uses rooms with `room_type = 'theory'`

### Capacity Analysis

#### Weekly Periods Demand
| Item | Calculation | Total |
|------|-------------|-------|
| Theory per section | 5 subjects × 4 periods | 20 periods |
| Labs per section | 3 subjects × 3 periods | 9 periods |
| Total per section | 20 + 9 | 29 periods |
| **Total (8 sections)** | 8 × 29 | **232 periods** |

#### Available Slots
| Resource | Calculation | Total |
|----------|-------------|-------|
| Days per week | 6 (Mon-Sat) | |
| Periods per day | 8 | |
| Slots per room | 6 × 8 | 48 slots |
| Theory rooms (3) | 3 × 48 | 144 slots |
| Lab rooms (2) | 2 × 48 | 96 slots |
| **Total available** | 144 + 96 | **240 slots** |

#### Feasibility Check
- Total demand: 232 periods
- Total supply: 240 slots
- **Buffer: 8 slots (3.3%)** ✅ Feasible

## Faculty Load Distribution

### CSE Faculty
| Faculty | Subjects | Sections | Periods/Week |
|---------|----------|----------|--------------|
| Dr. Arun (F001) | DS, DS Lab | 4 CSE sections | 16 + 12 = 28 |
| Prof. Priya (F002) | DBMS, DBMS Lab | 4 CSE sections | 16 + 12 = 28 |
| Mr. Karthik (F003) | OS | 4 CSE sections | 16 |
| Ms. Deepa (F004) | CN, CN Lab | 4 CSE sections | 16 + 12 = 28 |
| Dr. Ramesh (F005) | SE | 4 CSE sections | 16 |
| Prof. Sunitha (F006) | - | - | Available |

### IT Faculty
| Faculty | Subjects | Sections | Periods/Week |
|---------|----------|----------|--------------|
| Dr. Suresh (F001) | Web Tech, Web Lab | 4 IT sections | 16 + 12 = 28 |
| Prof. Meena (F002) | Cloud, Cloud Lab | 4 IT sections | 16 + 12 = 28 |
| Mr. Vijay (F003) | Cyber Sec | 4 IT sections | 16 |
| Ms. Lakshmi (F004) | ML, ML Lab | 4 IT sections | 16 + 12 = 28 |
| Dr. Ganesh (F005) | Big Data | 4 IT sections | 16 |
| Prof. Anitha (F006) | - | - | Available |

## Usage Instructions

### Run in Supabase SQL Editor
```sql
-- Copy and paste the entire content of 015_sample_data_8_sections.sql
-- in Supabase Dashboard → SQL Editor → New query
```

### Verify Data
After running the script, check the verification output:
```
entity                    | count
--------------------------|------
Departments               | 2
Classrooms                | 5
Faculty                   | 12
Subjects (Theory)         | 10
Subjects (Lab)            | 6
Sections                  | 8
Section-Subject Mappings  | 64
Faculty Availability Slots| 72
```

## Key Changes from Previous Data

1. **Lab Periods**: Changed from 4 to **3 consecutive periods**
2. **Theory Periods**: Changed to **4 periods/week** (was 3)
3. **Per Section**: 5 theory + 3 lab subjects
4. **Total Sections**: 8 (was variable)
5. **Classrooms**: 5 (3 theory + 2 labs)

## Timetable Generation Notes

### Labs Schedule First
Labs are scheduled before theory because:
- They require continuous blocks (harder to fit)
- They need specific lab rooms (limited resource)
- Only 2 lab rooms for 24 lab sessions (8 sections × 3 labs)

### Lab Distribution Example
With 2 lab rooms and 6 days:
- Each lab room can handle: ~12 lab sessions (6 days × 2 possible slots)
- Total capacity: 24 lab sessions ✅

### Theory Distribution
With 3 theory rooms and flexible scheduling:
- 160 theory periods needed (8 sections × 20 periods)
- 144 theory room slots available
- Faculty sharing allows multiple sections same time in same room ❌
- Need careful scheduling to avoid faculty conflicts
