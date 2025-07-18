-- Fix storage policies for avatars bucket
-- Run this in your Supabase SQL editor

-- First, make sure the avatars bucket exists and is public
-- Go to Storage in Supabase dashboard and create bucket named "avatars" if it doesn't exist
-- Set it as public bucket

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users to upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their own avatars" ON storage.objects;

-- Create new policies with proper permissions

-- Policy to allow authenticated users to upload avatars
CREATE POLICY "Allow authenticated users to upload avatars" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN ('teacher-avatars', 'parent-avatars', 'student-avatars')
);

-- Policy to allow public read access to avatars
CREATE POLICY "Allow public read access to avatars" ON storage.objects
FOR SELECT USING (
  bucket_id = 'avatars'
);

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

-- Alternative: If you want to allow all authenticated users to manage any avatar (less secure but simpler)
-- Uncomment the following if the above policies don't work:

/*
-- Allow all authenticated users to manage avatars
CREATE POLICY "Allow authenticated users to manage avatars" ON storage.objects
FOR ALL USING (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
);
*/ 