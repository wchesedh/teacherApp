-- Add reactions table for class announcements
-- Parents can react to class-wide announcements with positive reactions only

-- Create reactions table
CREATE TABLE IF NOT EXISTS post_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES parents(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('thumbs_up', 'heart', 'clap', 'smile')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, parent_id, reaction_type)
);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_post_reactions_post_id ON post_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_post_reactions_parent_id ON post_reactions(parent_id);

-- Enable Row Level Security
ALTER TABLE post_reactions ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (for now, we'll make it more secure later)
CREATE POLICY "Allow all operations on post_reactions" ON post_reactions FOR ALL USING (true);

-- Add comment to clarify the purpose
COMMENT ON TABLE post_reactions IS 'Positive reactions from parents to class announcements';
COMMENT ON COLUMN post_reactions.reaction_type IS 'Only positive reactions: thumbs_up, heart, clap, smile'; 