-- Add sort_order field to notes table for manual sorting of PPTs/resources within topics
ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS sort_order INTEGER;

-- Set initial sort_order for existing notes based on created_at
-- This ensures existing notes maintain their order within each topic
UPDATE public.notes
SET sort_order = subquery.row_number
FROM (
  SELECT 
    id,
    ROW_NUMBER() OVER (PARTITION BY topic_id ORDER BY created_at ASC) as row_number
  FROM public.notes
  WHERE sort_order IS NULL
) AS subquery
WHERE public.notes.id = subquery.id AND public.notes.sort_order IS NULL;

-- Create index for better query performance on sort_order
CREATE INDEX IF NOT EXISTS idx_notes_topic_sort_order 
  ON public.notes(topic_id, sort_order)
  WHERE topic_id IS NOT NULL;

