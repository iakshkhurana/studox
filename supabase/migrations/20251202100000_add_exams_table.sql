-- Create exams table to store subject-specific exams with datesheet, tags, and PPT metadata
CREATE TABLE public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  exam_date TIMESTAMP WITH TIME ZONE NOT NULL,
  exam_type TEXT,
  tags TEXT[],
  ppt_url TEXT,
  ppt_name TEXT,
  ppt_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for exams table
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

-- Allow users to fully manage their own exams
CREATE POLICY "Users can manage their own exams"
  ON public.exams
  FOR ALL
  USING (auth.uid() = user_id);

-- Keep updated_at column in sync on updates
CREATE TRIGGER update_exams_updated_at
  BEFORE UPDATE ON public.exams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create a dedicated storage bucket for exam PPTs
INSERT INTO storage.buckets (id, name, public)
VALUES ('exams', 'exams', false);

-- Storage policies for exam PPTs
CREATE POLICY "Users can upload their own exams PPTs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'exams'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own exams PPTs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'exams'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own exams PPTs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'exams'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );


