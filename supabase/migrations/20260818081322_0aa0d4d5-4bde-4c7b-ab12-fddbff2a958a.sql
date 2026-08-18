ALTER TABLE public.assessment_submissions
  ADD COLUMN IF NOT EXISTS transcription_segments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS scan_quality jsonb,
  ADD COLUMN IF NOT EXISTS ocr_updated_at timestamptz;