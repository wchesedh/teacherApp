-- Fix parents table to use auth user IDs as primary keys
-- This aligns with how teachers are handled and fixes the parent login issue

-- Step 1: Drop the foreign key constraint that depends on parents_pkey
ALTER TABLE student_parent DROP CONSTRAINT IF EXISTS student_parent_parent_id_fkey;

-- Step 2: Drop the existing primary key constraint
ALTER TABLE parents DROP CONSTRAINT IF EXISTS parents_pkey;

-- Step 3: Change the id column to not auto-generate and allow manual insertion
ALTER TABLE parents ALTER COLUMN id SET DEFAULT NULL;

-- Step 4: Re-add the primary key constraint
ALTER TABLE parents ADD PRIMARY KEY (id);

-- Step 5: Re-add the foreign key constraint
ALTER TABLE student_parent ADD CONSTRAINT student_parent_parent_id_fkey 
  FOREIGN KEY (parent_id) REFERENCES parents(id) ON DELETE CASCADE;

-- Add a comment to clarify the purpose
COMMENT ON COLUMN parents.id IS 'Auth user ID from Supabase Auth'; 