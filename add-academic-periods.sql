-- Add academic periods functionality to the system
-- This allows classes to be associated with specific semesters/quarters

-- 1. Create academic_periods table
CREATE TABLE IF NOT EXISTS academic_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('semester', 'quarter', 'trimester', 'term')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT false,
  school_year TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add period fields to classes table
ALTER TABLE classes 
ADD COLUMN IF NOT EXISTS academic_period_id UUID REFERENCES academic_periods(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 3. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_academic_periods_active ON academic_periods(is_active);
CREATE INDEX IF NOT EXISTS idx_academic_periods_school_year ON academic_periods(school_year);
CREATE INDEX IF NOT EXISTS idx_classes_academic_period_id ON classes(academic_period_id);
CREATE INDEX IF NOT EXISTS idx_classes_active ON classes(is_active);

-- 4. Enable Row Level Security
ALTER TABLE academic_periods ENABLE ROW LEVEL SECURITY;

-- 5. Create policies for academic_periods
CREATE POLICY "Allow all operations on academic_periods" ON academic_periods FOR ALL USING (true);

-- 6. Add comments for documentation
COMMENT ON TABLE academic_periods IS 'Academic periods (semesters, quarters, etc.) for organizing classes by time periods';
COMMENT ON COLUMN academic_periods.type IS 'Type of academic period: semester, quarter, trimester, term';
COMMENT ON COLUMN academic_periods.is_active IS 'Only one period should be active at a time';
COMMENT ON COLUMN academic_periods.school_year IS 'School year (e.g., 2023-2024)';
COMMENT ON COLUMN classes.academic_period_id IS 'The academic period this class belongs to';
COMMENT ON COLUMN classes.is_active IS 'Whether this class is currently active';

-- 7. Create a function to ensure only one active period at a time
CREATE OR REPLACE FUNCTION ensure_single_active_period()
RETURNS TRIGGER AS $$
BEGIN
  -- If we're setting a period as active, deactivate all others
  IF NEW.is_active = true THEN
    UPDATE academic_periods 
    SET is_active = false 
    WHERE id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Create trigger to enforce single active period
CREATE TRIGGER ensure_single_active_period_trigger
  BEFORE INSERT OR UPDATE ON academic_periods
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_active_period();

-- 9. Insert some default academic periods for the current year
INSERT INTO academic_periods (name, type, start_date, end_date, is_active, school_year) VALUES
('Fall Semester 2024', 'semester', '2024-08-15', '2024-12-20', false, '2024-2025'),
('Spring Semester 2024', 'semester', '2024-01-15', '2024-05-20', false, '2023-2024'),
('Fall Quarter 2024', 'quarter', '2024-09-15', '2024-12-15', false, '2024-2025'),
('Winter Quarter 2024', 'quarter', '2024-01-15', '2024-03-15', false, '2024-2025'),
('Spring Quarter 2024', 'quarter', '2024-03-15', '2024-06-15', false, '2024-2025');

-- 10. Set the most recent period as active (you can change this as needed)
UPDATE academic_periods 
SET is_active = true 
WHERE name = 'Fall Semester 2024'; 