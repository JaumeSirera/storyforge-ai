CREATE TABLE public.exam_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.assessment_candidates(id) ON DELETE CASCADE,
  event text NOT NULL,
  ip text,
  user_agent text,
  client_version text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_exam_audit_log_candidate ON public.exam_audit_log (candidate_id, created_at DESC);
CREATE INDEX idx_exam_audit_log_assessment ON public.exam_audit_log (assessment_id, created_at DESC);

GRANT SELECT ON public.exam_audit_log TO authenticated;
GRANT ALL ON public.exam_audit_log TO service_role;

ALTER TABLE public.exam_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can read their exam audit log"
ON public.exam_audit_log FOR SELECT TO authenticated
USING (auth.uid() = owner_id);