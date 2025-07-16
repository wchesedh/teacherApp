-- Fix parents table to use auth user IDs as primary keys
-- This aligns with how teachers are handled and fixes the parent login issue

-- First, drop the existing primary key constraint
ALTER TABLE parents DROP CONSTRAINT IF EXISTS parents_pkey;

-- Change the id column to not auto-generate and allow manual insertion
ALTER TABLE parents ALTER COLUMN id SET DEFAULT NULL;

-- Re-add the primary key constraint
ALTER TABLE parents ADD PRIMARY KEY (id);

-- Add a comment to clarify the purpose
COMMENT ON COLUMN parents.id IS 'Auth user ID from Supabase Auth'; 