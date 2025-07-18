-- Add profile fields to parents table
ALTER TABLE parents 
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT;

-- Note: The avatars storage bucket should already exist from the teacher profile setup 