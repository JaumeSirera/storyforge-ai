ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS time_limit_min integer;
ALTER TABLE public.assessment_candidates ADD COLUMN IF NOT EXISTS time_expired boolean NOT NULL DEFAULT false;