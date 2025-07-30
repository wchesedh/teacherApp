-- Add support for multiple files in posts
-- This allows teachers to attach multiple images to announcements

-- Add file_urls and file_names array columns to posts table
ALTER TABLE posts ADD COLUMN IF NOT EXISTS file_urls TEXT[];
ALTER TABLE posts ADD COLUMN IF NOT EXISTS file_names TEXT[];

-- Add comments to clarify the purpose
COMMENT ON COLUMN posts.file_urls IS 'Array of file URLs for multiple image attachments';
COMMENT ON COLUMN posts.file_names IS 'Array of file names corresponding to file_urls';

-- Create index for better performance when querying posts with files
CREATE INDEX IF NOT EXISTS idx_posts_file_urls ON posts USING GIN (file_urls);
CREATE INDEX IF NOT EXISTS idx_posts_file_names ON posts USING GIN (file_names); 