CREATE TABLE public.assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  area_key text,
  prompt text,
  instructions text,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  rubric jsonb NOT NULL DEFAULT '[]'::jsonb,
  max_score numeric NOT NULL DEFAULT 10,
  handwriting_weight_pct integer NOT NULL DEFAULT 15,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessments TO authenticated;
GRANT ALL ON public.assessments TO service_role;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their assessments"
ON public.assessments FOR ALL TO authenticated
USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TRIGGER trg_assessments_updated BEFORE UPDATE ON public.assessments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.assessment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  candidate_name text NOT NULL,
  candidate_identifier text,
  source_kind text NOT NULL DEFAULT 'handwritten',
  pages jsonb NOT NULL DEFAULT '[]'::jsonb,
  extracted_text text,
  handwriting jsonb,
  evaluation jsonb,
  score numeric,
  max_score numeric,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  graded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_assessment_submissions_assessment ON public.assessment_submissions(assessment_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_submissions TO authenticated;
GRANT ALL ON public.assessment_submissions TO service_role;
ALTER TABLE public.assessment_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their submissions"
ON public.assessment_submissions FOR ALL TO authenticated
USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TRIGGER trg_assessment_submissions_updated BEFORE UPDATE ON public.assessment_submissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();