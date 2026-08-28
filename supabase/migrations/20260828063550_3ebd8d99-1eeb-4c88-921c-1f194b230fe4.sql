CREATE TABLE public.candidate_invite_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.assessment_candidates(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  message_id text,
  error_message text,
  last_attempt_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_invite_emails TO authenticated;
GRANT ALL ON public.candidate_invite_emails TO service_role;

ALTER TABLE public.candidate_invite_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads invite email log"
ON public.candidate_invite_emails FOR SELECT TO authenticated
USING (auth.uid() = owner_id OR public.assessment_can(auth.uid(), assessment_id, 'view'));

CREATE POLICY "Owner writes invite email log"
ON public.candidate_invite_emails FOR INSERT TO authenticated
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owner updates invite email log"
ON public.candidate_invite_emails FOR UPDATE TO authenticated
USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owner deletes invite email log"
ON public.candidate_invite_emails FOR DELETE TO authenticated
USING (auth.uid() = owner_id);

CREATE TRIGGER trg_candidate_invite_emails_updated
BEFORE UPDATE ON public.candidate_invite_emails
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_candidate_invite_emails_assessment ON public.candidate_invite_emails(assessment_id);