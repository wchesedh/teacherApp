-- Create storage bucket for avatars (run this in Supabase SQL editor)
-- Note: This needs to be done via the Supabase dashboard or API
-- Go to Storage > Create bucket > Name: "avatars" > Public bucket: true

-- Storage policies for the avatars bucket
-- These policies allow authenticated users to upload and read avatars

-- Policy to allow authenticated users to upload avatars
CREATE POLICY "Allow authenticated users to upload avatars" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN ('teacher-avatars', 'parent-avatars')
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
  AND (storage.foldername(name))[1] IN ('teacher-avatars', 'parent-avatars')
);

-- Policy to allow users to delete their own avatars
CREATE POLICY "Allow users to delete their own avatars" ON storage.objects
FOR DELETE USING (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN ('teacher-avatars', 'parent-avatars')
); 