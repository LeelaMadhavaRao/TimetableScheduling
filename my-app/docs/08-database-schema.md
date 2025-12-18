# Database Schema for Timetabling

## Overview

The database stores all data needed for timetable generation and the generated results.

## Core Tables

### Departments

```sql
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  created_by UUID REFERENCES timetable_administrators(id),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Example:
-- | id | name | code | created_by |
-- | uuid | Computer Science & Engineering | CSE | admin-uuid |
```

### Faculty

```sql
CREATE TABLE faculty (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,       -- e.g., "CSE001"
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  department_id UUID REFERENCES departments(id),
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES timetable_administrators(id),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Example:
-- | id | code | name | email | department_id |
-- | uuid | CSE001 | Dr. Arun | arun@edu | cse-dept-uuid |
```

### Faculty Availability

```sql
CREATE TABLE faculty_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id UUID NOT NULL REFERENCES faculty(id),
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 5),
  start_period INT NOT NULL CHECK (start_period BETWEEN 1 AND 8),
  end_period INT NOT NULL CHECK (end_period BETWEEN 1 AND 8),
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(faculty_id, day_of_week, start_period, end_period)
);

-- Example (Faculty available Mon-Fri, P1-8):
-- | faculty_id | day_of_week | start_period | end_period |
-- | uuid | 0 | 1 | 8 |
-- | uuid | 1 | 1 | 8 |
-- | uuid | 2 | 1 | 8 |
```

### Subjects

```sql
CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,           -- e.g., "CS201"
  subject_type VARCHAR(20) NOT NULL,          -- "theory" or "lab"
  periods_per_week INT NOT NULL DEFAULT 4,
  department_id UUID REFERENCES departments(id),
  created_by UUID REFERENCES timetable_administrators(id),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  CONSTRAINT valid_subject_type CHECK (subject_type IN ('theory', 'lab'))
);

-- Example:
-- | id | name | code | subject_type | periods_per_week |
-- | uuid | Data Structures | CS201 | theory | 3 |
-- | uuid | DS Lab | CS201L | lab | 4 |
```

### Classrooms

```sql
CREATE TABLE classrooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  capacity INT NOT NULL,
  room_type VARCHAR(20) NOT NULL,            -- "lab" or "theory"
  building VARCHAR(100),
  floor INT,
  created_by UUID REFERENCES timetable_administrators(id),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  CONSTRAINT valid_room_type CHECK (room_type IN ('lab', 'theory'))
);

-- Example:
-- | id | name | capacity | room_type | building | floor |
-- | uuid | ENG-101 | 60 | theory | Engineering Block | 1 |
-- | uuid | ENG-LAB1 | 65 | lab | Engineering Block | 2 |
```

### Sections

```sql
CREATE TABLE sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,         -- e.g., "CSE-2A"
  year_level INT NOT NULL CHECK (year_level BETWEEN 1 AND 4),
  student_count INT NOT NULL,
  department_id UUID REFERENCES departments(id),
  created_by UUID REFERENCES timetable_administrators(id),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Example:
-- | id | name | year_level | student_count | department_id |
-- | uuid | CSE-2A | 2 | 55 | cse-dept-uuid |
```

### Section Subjects (Many-to-Many with Faculty)

```sql
CREATE TABLE section_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES sections(id),
  subject_id UUID NOT NULL REFERENCES subjects(id),
  faculty_id UUID NOT NULL REFERENCES faculty(id),
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(section_id, subject_id)
);

-- Example:
-- | section_id | subject_id | faculty_id |
-- | cse2a-uuid | ds-uuid | arun-uuid |
-- | cse2a-uuid | ds-lab-uuid | arun-uuid |
```

## Timetable Tables

### Timetable Jobs

Tracks generation status:

```sql
CREATE TABLE timetable_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  progress INT DEFAULT 0,
  message TEXT,
  base_generation_time INT,        -- milliseconds
  optimization_time INT,           -- milliseconds
  created_by UUID REFERENCES timetable_administrators(id),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN (
    'pending', 'generating_base', 'base_complete', 
    'optimizing', 'completed', 'failed'
  ))
);

-- Example:
-- | id | status | progress | message |
-- | uuid | completed | 100 | Optimization complete (fitness: 0.84) |
```

### Timetable Base

Stores initial generated timetable:

```sql
CREATE TABLE timetable_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES timetable_jobs(id),
  section_id UUID NOT NULL REFERENCES sections(id),
  subject_id UUID NOT NULL REFERENCES subjects(id),
  faculty_id UUID NOT NULL REFERENCES faculty(id),
  classroom_id UUID NOT NULL REFERENCES classrooms(id),
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 5),
  start_period INT NOT NULL CHECK (start_period BETWEEN 1 AND 8),
  end_period INT NOT NULL CHECK (end_period BETWEEN 1 AND 8),
  created_by UUID REFERENCES timetable_administrators(id),
  created_at TIMESTAMP DEFAULT now()
);

-- Example:
-- | section_id | subject_id | day_of_week | start_period | end_period |
-- | cse2a | ds-lab | 0 | 1 | 4 |  -- Monday P1-4
-- | cse2a | dbms | 1 | 1 | 2 |    -- Tuesday P1-2
```

### Timetable Optimized

Stores GA-optimized timetable:

```sql
CREATE TABLE timetable_optimized (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES timetable_jobs(id),
  section_id UUID NOT NULL REFERENCES sections(id),
  subject_id UUID NOT NULL REFERENCES subjects(id),
  faculty_id UUID NOT NULL REFERENCES faculty(id),
  classroom_id UUID NOT NULL REFERENCES classrooms(id),
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 5),
  start_period INT NOT NULL CHECK (start_period BETWEEN 1 AND 8),
  end_period INT NOT NULL CHECK (end_period BETWEEN 1 AND 8),
  fitness_score DECIMAL(10, 6),    -- GA fitness value
  created_by UUID REFERENCES timetable_administrators(id),
  created_at TIMESTAMP DEFAULT now()
);
```

## Authentication Tables

### Admin Users

System administrators:

```sql
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

### Timetable Administrators

Per-institution administrators:

```sql
CREATE TABLE timetable_administrators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  institution_name VARCHAR(255),
  created_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

## Entity Relationships

```
admin_users
    │
    │ creates
    ▼
timetable_administrators
    │
    │ creates (created_by)
    ├──────────────────────────────────────────────────────────────┐
    │                                                               │
    ▼                                                               ▼
departments ◄────────────────────────────────────────┬──────── classrooms
    │                                                │
    │                                                │
    ▼                                                │
faculty                                              │
    │                                                │
    ├─── faculty_availability                        │
    │                                                │
    └─────────────────────────┐                      │
                              │                      │
                              ▼                      │
                        subjects                     │
                              │                      │
                              ▼                      │
                        sections                     │
                              │                      │
                              ▼                      │
                    section_subjects ─────────────────┤
                         │    │                      │
                         │    └───────────────────────┘
                         ▼
                  timetable_jobs
                         │
            ┌────────────┴────────────┐
            ▼                         ▼
    timetable_base          timetable_optimized
```

## Key Queries

### Get Course Assignments for Generation

```sql
SELECT 
  ss.section_id,
  s.name as section_name,
  s.student_count,
  s.year_level,
  ss.subject_id,
  subj.name as subject_name,
  subj.code as subject_code,
  subj.subject_type,
  subj.periods_per_week,
  ss.faculty_id,
  f.code as faculty_code
FROM section_subjects ss
JOIN sections s ON ss.section_id = s.id
JOIN subjects subj ON ss.subject_id = subj.id
JOIN faculty f ON ss.faculty_id = f.id
WHERE s.created_by = :admin_id;
```

### Get Faculty Schedule

```sql
SELECT 
  tb.day_of_week,
  tb.start_period,
  tb.end_period,
  subj.name as subject_name,
  s.name as section_name,
  c.name as classroom_name
FROM timetable_base tb
JOIN subjects subj ON tb.subject_id = subj.id
JOIN sections s ON tb.section_id = s.id
JOIN classrooms c ON tb.classroom_id = c.id
WHERE tb.faculty_id = :faculty_id
ORDER BY tb.day_of_week, tb.start_period;
```

### Get Section Timetable

```sql
SELECT 
  tb.day_of_week,
  tb.start_period,
  tb.end_period,
  subj.name as subject_name,
  subj.code as subject_code,
  f.name as faculty_name,
  c.name as classroom_name
FROM timetable_optimized tb
JOIN subjects subj ON tb.subject_id = subj.id
JOIN faculty f ON tb.faculty_id = f.id
JOIN classrooms c ON tb.classroom_id = c.id
WHERE tb.section_id = :section_id
  AND tb.job_id = :latest_job_id
ORDER BY tb.day_of_week, tb.start_period;
```

## Row Level Security (RLS)

Multi-tenant isolation:

```sql
-- Enable RLS
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own data
CREATE POLICY "Users can only access their own sections" ON sections
  FOR ALL
  USING (created_by = current_setting('app.current_user_id')::uuid);
```

## Data Types Reference

```typescript
// TypeScript types matching database
type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5;  // Monday to Saturday
type Period = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
type SubjectType = "theory" | "lab";
type RoomType = "lab" | "theory";
type YearLevel = 1 | 2 | 3 | 4;

type JobStatus = 
  | "pending"
  | "generating_base"
  | "base_complete"
  | "optimizing"
  | "completed"
  | "failed";
```

## Indexes for Performance

```sql
-- Speed up timetable queries
CREATE INDEX idx_timetable_base_job ON timetable_base(job_id);
CREATE INDEX idx_timetable_base_section ON timetable_base(section_id);
CREATE INDEX idx_timetable_base_faculty ON timetable_base(faculty_id);
CREATE INDEX idx_timetable_base_created_by ON timetable_base(created_by);

-- Speed up course assignment queries
CREATE INDEX idx_section_subjects_section ON section_subjects(section_id);
CREATE INDEX idx_section_subjects_subject ON section_subjects(subject_id);

-- Speed up availability queries
CREATE INDEX idx_faculty_availability_faculty ON faculty_availability(faculty_id);
```
