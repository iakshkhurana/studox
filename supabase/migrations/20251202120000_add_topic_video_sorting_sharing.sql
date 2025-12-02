-- Add YouTube video URL, manual sorting, and sharing fields to topics table
ALTER TABLE public.topics
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER,
  ADD COLUMN IF NOT EXISTS share_token UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT false;

-- Set initial sort_order for existing topics based on created_at
-- This ensures existing topics maintain their order
-- Only update topics that don't already have a sort_order
UPDATE public.topics
SET sort_order = subquery.row_number
FROM (
  SELECT 
    id,
    ROW_NUMBER() OVER (PARTITION BY subject_id ORDER BY created_at ASC) as row_number
  FROM public.topics
  WHERE sort_order IS NULL
) AS subquery
WHERE public.topics.id = subquery.id AND public.topics.sort_order IS NULL;

-- Set default sort_order for new topics (will be set by application logic)
-- Create index for better query performance on sort_order
CREATE INDEX IF NOT EXISTS idx_topics_subject_sort_order 
  ON public.topics(subject_id, sort_order);

-- Create index for share_token lookups
CREATE INDEX IF NOT EXISTS idx_topics_share_token 
  ON public.topics(share_token) 
  WHERE share_token IS NOT NULL;

-- Add RLS policy to allow public read access to shared topics
-- This allows anyone with the share_token to view the topic
CREATE POLICY "Public can view shared topics"
  ON public.topics FOR SELECT
  USING (is_shared = true);

-- Add RLS policy to allow reading notes for shared topics
-- This allows anyone to view notes associated with a shared topic
CREATE POLICY "Public can view notes for shared topics"
  ON public.notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.topics
      WHERE topics.id = notes.topic_id
      AND topics.is_shared = true
    )
  );

-- Note: The existing "Users can manage their own topics" policy will still apply
-- for UPDATE, INSERT, DELETE operations, so users can only modify their own topics

