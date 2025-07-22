-- Add support for students being in multiple classes
-- This creates a many-to-many relationship between students and classes

-- Create student_class relationship table
CREATE TABLE IF NOT EXISTS student_class (
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (student_id, class_id)
);

-- Enable Row Level Security (RLS)
ALTER TABLE student_class ENABLE ROW LEVEL SECURITY;

-- Create policy for public access (for now, we'll make it more secure later)
CREATE POLICY "Allow all operations on student_class" ON student_class FOR ALL USING (true);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_student_class_student_id ON student_class(student_id);
CREATE INDEX IF NOT EXISTS idx_student_class_class_id ON student_class(class_id);

-- Add comment to clarify the purpose
COMMENT ON TABLE student_class IS 'Many-to-many relationship between students and classes, allowing students to be in multiple classes';

-- Note: The existing class_id column in students table can be kept for backward compatibility
-- or removed later if no longer needed. For now, we'll keep it to avoid breaking existing functionality. 