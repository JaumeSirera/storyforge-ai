ALTER TABLE public.capture_analyses
  ADD COLUMN IF NOT EXISTS insights jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS insights_generated_at timestamptz;