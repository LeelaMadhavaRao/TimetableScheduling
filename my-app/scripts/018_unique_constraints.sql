-- =============================================
-- 018: UNIQUE CONSTRAINTS, CHECK CONSTRAINTS & PERFORMANCE INDEXES
-- =============================================
-- Adds idempotent constraints and indexes to enforce data integrity
-- and improve conflict-checking query performance.
-- =============================================

-- 1. UNIQUE constraint on section_subjects(section_id, subject_id)
--    Prevents duplicate section-subject assignments.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_section_subjects_section_subject'
          AND conrelid = 'section_subjects'::regclass
    ) THEN
        ALTER TABLE section_subjects
        ADD CONSTRAINT uq_section_subjects_section_subject UNIQUE (section_id, subject_id);
    END IF;
END $$;

-- 2. UNIQUE constraint on subject_faculty(subject_id, faculty_id)
--    Prevents duplicate faculty-subject links.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_subject_faculty_subject_faculty'
          AND conrelid = 'subject_faculty'::regclass
    ) THEN
        ALTER TABLE subject_faculty
        ADD CONSTRAINT uq_subject_faculty_subject_faculty UNIQUE (subject_id, faculty_id);
    END IF;
END $$;

-- 3. CHECK constraint on faculty_availability: end_period >= start_period
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_faculty_availability_periods'
          AND conrelid = 'faculty_availability'::regclass
    ) THEN
        ALTER TABLE faculty_availability
        ADD CONSTRAINT chk_faculty_availability_periods CHECK (end_period >= start_period);
    END IF;
END $$;

-- 4. CHECK constraint on classrooms: capacity > 0
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_classrooms_capacity_positive'
          AND conrelid = 'classrooms'::regclass
    ) THEN
        ALTER TABLE classrooms
        ADD CONSTRAINT chk_classrooms_capacity_positive CHECK (capacity > 0);
    END IF;
END $$;

-- 5. CHECK constraint on sections: student_count > 0
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_sections_student_count_positive'
          AND conrelid = 'sections'::regclass
    ) THEN
        ALTER TABLE sections
        ADD CONSTRAINT chk_sections_student_count_positive CHECK (student_count > 0);
    END IF;
END $$;

-- 6. Composite index on timetable_base for faculty conflict checking
--    Covers queries filtering by job + faculty + day + start period.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_timetable_base_job_faculty_day_period'
          AND schemaname = 'public'
    ) THEN
        CREATE INDEX idx_timetable_base_job_faculty_day_period
        ON timetable_base (job_id, faculty_id, day_of_week, start_period);
    END IF;
END $$;

-- 7. Composite index on timetable_base for room conflict checking
--    Covers queries filtering by job + classroom + day + start period.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_timetable_base_job_classroom_day_period'
          AND schemaname = 'public'
    ) THEN
        CREATE INDEX idx_timetable_base_job_classroom_day_period
        ON timetable_base (job_id, classroom_id, day_of_week, start_period);
    END IF;
END $$;
