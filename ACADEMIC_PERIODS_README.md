# Academic Periods Feature

This feature adds semester/quarter functionality to your teacher-parent communication system, allowing you to organize classes by academic periods.

## What's New

### Database Changes
- **New `academic_periods` table**: Stores semesters, quarters, trimesters, and terms
- **Updated `classes` table**: Now includes `academic_period_id` and `is_active` fields
- **Automatic period management**: Only one academic period can be active at a time

### Key Features

1. **Academic Period Management**
   - Create and manage semesters, quarters, trimesters, and terms
   - Set start and end dates for each period
   - Mark periods as active/inactive
   - Only one period can be active at a time

2. **Class Organization**
   - Assign classes to specific academic periods
   - Filter classes by active period
   - Teachers only see classes for the current active period
   - Parents only see their children's classes for the active period

3. **Automatic Filtering**
   - Teacher dashboard shows only classes for the active period
   - Parent dashboard shows only children's classes for the active period
   - Admin can manage all classes across all periods

## How to Use

### For Administrators

1. **Set up Academic Periods**
   - Go to Admin Dashboard → "Manage Academic Periods"
   - Create new periods (e.g., "Fall Semester 2024", "Spring Quarter 2024")
   - Set start and end dates
   - Mark the current period as active

2. **Manage Classes**
   - Go to Admin Dashboard → "Manage Classes"
   - Create new classes and assign them to academic periods
   - Filter classes by period using the dropdown

### For Teachers

- Your dashboard will automatically show only classes for the active academic period
- When a new semester/quarter starts, administrators will activate the new period
- Your classes will automatically filter to show only current period classes

### For Parents

- You'll only see your children's classes for the active academic period
- When periods change, you'll automatically see the new classes

## Database Migration

To apply the changes to your database:

1. Run the migration script:
   ```sql
   \i add-academic-periods.sql
   ```

2. Or run the verification script:
   ```sql
   \i run-migration.sql
   ```

## Default Academic Periods

The migration creates these default periods:
- Fall Semester 2024 (set as active)
- Spring Semester 2024
- Fall Quarter 2024
- Winter Quarter 2024
- Spring Quarter 2024

## API Endpoints

The system now supports:
- `GET /admin/periods` - Manage academic periods
- `GET /admin/classes` - Manage classes with period filtering
- Automatic filtering in teacher and parent dashboards

## Benefits

1. **Organized Class Management**: Classes are now organized by academic periods
2. **Automatic Filtering**: Users only see relevant classes for the current period
3. **Easy Period Transitions**: Simply activate a new period to switch to the next semester/quarter
4. **Historical Data**: Previous periods remain accessible for reference
5. **Flexible Period Types**: Support for semesters, quarters, trimesters, and terms

## Technical Details

### Database Schema

```sql
-- Academic periods table
CREATE TABLE academic_periods (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('semester', 'quarter', 'trimester', 'term')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT false,
  school_year TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Updated classes table
ALTER TABLE classes 
ADD COLUMN academic_period_id UUID REFERENCES academic_periods(id),
ADD COLUMN is_active BOOLEAN DEFAULT true;
```

### Key Constraints

- Only one academic period can be active at a time (enforced by database trigger)
- Classes can be assigned to specific periods or left unassigned
- Active classes are automatically filtered by the active period

This feature ensures that your system can properly handle academic year transitions and keep classes organized by time periods. 