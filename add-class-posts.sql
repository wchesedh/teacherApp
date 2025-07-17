-- Add support for class-wide posts/announcements
-- This allows teachers to post announcements to entire classes

-- Add class_id column to posts table (nullable to support both student-specific and class-wide posts)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id) ON DELETE CASCADE;

-- Add index for better performance when querying posts by class
CREATE INDEX IF NOT EXISTS idx_posts_class_id ON posts(class_id);

-- Add comment to clarify the purpose
COMMENT ON COLUMN posts.class_id IS 'For class-wide announcements. If NULL, post is student-specific via post_student_tags table'; 