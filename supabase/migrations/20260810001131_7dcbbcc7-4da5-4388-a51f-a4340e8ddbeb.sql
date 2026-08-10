ALTER TABLE public.capture_analyses
  ADD COLUMN IF NOT EXISTS scenes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS scenes_generated_at timestamptz;