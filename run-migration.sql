-- Run this script to add academic periods functionality to your database
-- This will create the academic_periods table and update the classes table

-- Execute the academic periods migration
\i add-academic-periods.sql

-- Verify the changes
SELECT 'academic_periods table created' as status;
SELECT COUNT(*) as periods_count FROM academic_periods;

SELECT 'classes table updated' as status;
SELECT COUNT(*) as classes_count FROM classes;

-- Show the active academic period
SELECT name, type, school_year, is_active 
FROM academic_periods 
WHERE is_active = true; 