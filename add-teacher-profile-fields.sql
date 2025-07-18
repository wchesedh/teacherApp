-- Add profile fields to teachers table
ALTER TABLE teachers 
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS subjects TEXT[];

-- Create avatars storage bucket if it doesn't exist
-- Note: This needs to be done in Supabase dashboard or via API
-- The bucket should be named 'avatars' with public access 