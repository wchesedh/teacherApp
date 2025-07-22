-- Update storage policies to include student-avatars folder
-- Run this in Supabase SQL editor to fix avatar upload issues

-- Drop existing policies first
DROP POLICY IF EXISTS "Allow authenticated users to upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their own avatars" ON storage.objects;

-- Create updated policies that include student-avatars
CREATE POLICY "Allow authenticated users to upload avatars" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN ('teacher-avatars', 'parent-avatars', 'student-avatars')
);

-- Policy to allow public read access to avatars (keep existing)
-- CREATE POLICY "Allow public read access to avatars" ON storage.objects
-- FOR SELECT USING (
--   bucket_id = 'avatars'
-- );

-- Policy to allow users to update their own avatars
CREATE POLICY "Allow users to update their own avatars" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN ('teacher-avatars', 'parent-avatars', 'student-avatars')
);

-- Policy to allow users to delete their own avatars
CREATE POLICY "Allow users to delete their own avatars" ON storage.objects
FOR DELETE USING (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN ('teacher-avatars', 'parent-avatars', 'student-avatars')
); 