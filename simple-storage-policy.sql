-- Simple storage policy for avatars (use this if the folder-based policies don't work)
-- Run this in your Supabase SQL editor

-- First, make sure the avatars bucket exists and is public
-- Go to Storage in Supabase dashboard and create bucket named "avatars" if it doesn't exist
-- Set it as public bucket

-- Drop any existing policies
DROP POLICY IF EXISTS "Allow authenticated users to upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to manage avatars" ON storage.objects;

-- Create a simple policy that allows all authenticated users to manage avatars
CREATE POLICY "Allow authenticated users to manage avatars" ON storage.objects
FOR ALL USING (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
);

-- Also allow public read access
CREATE POLICY "Allow public read access to avatars" ON storage.objects
FOR SELECT USING (
  bucket_id = 'avatars'
); 