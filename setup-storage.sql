-- Set up Supabase Storage for student post images

-- Create storage bucket for student post images
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-posts', 'student-posts', true)
ON CONFLICT (id) DO NOTHING;

-- Create policy to allow authenticated users to upload images
CREATE POLICY "Allow authenticated users to upload images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'student-posts'
  AND auth.role() = 'authenticated'
);

-- Create policy to allow authenticated users to view images
CREATE POLICY "Allow authenticated users to view images" ON storage.objects
FOR SELECT USING (
  bucket_id = 'student-posts'
  AND auth.role() = 'authenticated'
);

-- Create policy to allow users to update their own images
CREATE POLICY "Allow users to update their own images" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'student-posts'
  AND auth.role() = 'authenticated'
);

-- Create policy to allow users to delete their own images
CREATE POLICY "Allow users to delete their own images" ON storage.objects
FOR DELETE USING (
  bucket_id = 'student-posts'
  AND auth.role() = 'authenticated'
);

-- Add image_url column to posts table
ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add comment to clarify the purpose
COMMENT ON COLUMN posts.image_url IS 'URL to uploaded image for student posts'; 