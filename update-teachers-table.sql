-- Update teachers table to work with Supabase Auth
-- Remove password field and update structure

-- First, drop the password column if it exists
ALTER TABLE teachers DROP COLUMN IF EXISTS password;

-- Update the teachers table structure to work with auth
-- The id will be the auth user ID, so we need to make sure it's properly set up

-- Add a comment to clarify the structure
COMMENT ON TABLE teachers IS 'Teachers table linked to Supabase Auth users';

-- Update the email constraint to work with auth
-- (This is already handled by the UNIQUE constraint)

-- Note: The teachers table should now have:
-- id UUID PRIMARY KEY (this will be the auth user ID)
-- name TEXT NOT NULL
-- email TEXT NOT NULL UNIQUE
-- created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() 