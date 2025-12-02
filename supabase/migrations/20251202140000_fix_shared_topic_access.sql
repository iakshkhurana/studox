-- Fix RLS policies for shared topics to allow public access without login
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public can view shared topics" ON public.topics;
DROP POLICY IF EXISTS "Public can view notes for shared topics" ON public.notes;

-- Add RLS policy to allow public read access to shared topics (works without authentication)
-- This allows anyone with the share_token to view the topic
CREATE POLICY "Public can view shared topics"
  ON public.topics FOR SELECT
  USING (is_shared = true);

-- Add RLS policy to allow reading notes (files and links) for shared topics
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

-- Add RLS policy to allow reading subjects for shared topics
-- This allows viewing the subject name for shared topics
CREATE POLICY "Public can view subjects for shared topics"
  ON public.subjects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.topics
      WHERE topics.subject_id = subjects.id
      AND topics.is_shared = true
    )
  );

-- Add storage policy to allow public access to files for shared topics
-- This allows generating signed URLs for files in shared topics
-- The file_url in notes table stores the storage path (e.g., "user_id/subject_id/topic_id/filename")
CREATE POLICY "Public can view storage for shared topics"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'notes'
    AND EXISTS (
      SELECT 1 FROM public.notes
      JOIN public.topics ON topics.id = notes.topic_id
      WHERE notes.file_url = storage.objects.name
      AND topics.is_shared = true
      AND notes.file_url IS NOT NULL
    )
  );

-- Note: Signed URLs require authentication to generate, but once generated, they can be accessed.
-- For fully public file access without authentication, consider using a public bucket
-- or creating a serverless function that generates signed URLs for shared topics.

