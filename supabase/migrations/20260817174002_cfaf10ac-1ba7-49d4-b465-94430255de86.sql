CREATE TABLE public.assessment_candidates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  identifier text,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'invited',
  submission_id uuid REFERENCES public.assessment_submissions(id) ON DELETE SET NULL,
  expires_at timestamp with time zone,
  started_at timestamp with time zone,
  submitted_at timestamp with time zone,
  note text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_assessment_candidates_assessment ON public.assessment_candidates(assessment_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_candidates TO authenticated;
GRANT ALL ON public.assessment_candidates TO service_role;

ALTER TABLE public.assessment_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage assessment candidates"
ON public.assessment_candidates FOR ALL TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Collaborators can view assessment candidates"
ON public.assessment_candidates FOR SELECT TO authenticated
USING (public.assessment_can(auth.uid(), assessment_id, 'view'));

CREATE TRIGGER trg_assessment_candidates_updated
BEFORE UPDATE ON public.assessment_candidates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();