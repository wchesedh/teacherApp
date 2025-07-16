-- Add password column to parents table for storing generated passwords
-- This is for teacher reference only, not for authentication

ALTER TABLE parents ADD COLUMN IF NOT EXISTS password TEXT;

-- Add a comment to clarify the purpose
COMMENT ON COLUMN parents.password IS 'Generated password for teacher reference only. Not used for authentication.'; 