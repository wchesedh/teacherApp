-- Add ID number field to students table
-- This allows for a unique identifier for each student

ALTER TABLE students ADD COLUMN IF NOT EXISTS id_number TEXT;

-- Add a unique constraint to ensure ID numbers are unique
-- Note: This will fail if there are existing duplicate ID numbers
-- You may need to clean up existing data first if needed
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'students_id_number_unique'
    ) THEN
        ALTER TABLE students ADD CONSTRAINT students_id_number_unique UNIQUE (id_number);
    END IF;
END $$;

-- Add an index for better performance when querying by ID number
CREATE INDEX IF NOT EXISTS idx_students_id_number ON students(id_number);

-- Add comment to clarify the purpose
COMMENT ON COLUMN students.id_number IS 'Unique identifier for the student (e.g., student ID, enrollment number)'; 