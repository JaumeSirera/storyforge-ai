CREATE TABLE public.assessment_collaborators (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'revisor' CHECK (role IN ('corrector','anotador','aprobador','revisor')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_collaborators TO authenticated;
GRANT ALL ON public.assessment_collaborators TO service_role;

ALTER TABLE public.assessment_collaborators ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_assessment_collaborators_updated
BEFORE UPDATE ON public.assessment_collaborators
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Owners manage collaborators"
ON public.assessment_collaborators FOR ALL TO authenticated
USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Collaborators see their own row"
ON public.assessment_collaborators FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.assessment_can(_user_id uuid, _assessment_id uuid, _perm text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assessments a
    WHERE a.id = _assessment_id AND a.owner_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.assessment_collaborators c
    WHERE c.assessment_id = _assessment_id
      AND c.user_id = _user_id
      AND (
        _perm = 'view'
        OR (_perm = 'grade' AND c.role = 'corrector')
        OR (_perm = 'annotate' AND c.role IN ('corrector','anotador'))
        OR (_perm = 'approve' AND c.role = 'aprobador')
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.submission_can(_user_id uuid, _submission_id uuid, _perm text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assessment_submissions s
    WHERE s.id = _submission_id
      AND public.assessment_can(_user_id, s.assessment_id, _perm)
  )
$$;

ALTER TABLE public.assessment_submissions
  ADD COLUMN approval_status text NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending','approved','rejected')),
  ADD COLUMN approval_note text NOT NULL DEFAULT '',
  ADD COLUMN approved_by uuid,
  ADD COLUMN approved_at timestamp with time zone;

CREATE POLICY "Collaborators can view shared assessments"
ON public.assessments FOR SELECT TO authenticated
USING (public.assessment_can(auth.uid(), id, 'view'));

CREATE POLICY "Collaborators can view shared submissions"
ON public.assessment_submissions FOR SELECT TO authenticated
USING (public.assessment_can(auth.uid(), assessment_id, 'view'));

CREATE POLICY "Correctors can grade shared submissions"
ON public.assessment_submissions FOR UPDATE TO authenticated
USING (
  public.assessment_can(auth.uid(), assessment_id, 'grade')
  OR public.assessment_can(auth.uid(), assessment_id, 'approve')
)
WITH CHECK (
  public.assessment_can(auth.uid(), assessment_id, 'grade')
  OR public.assessment_can(auth.uid(), assessment_id, 'approve')
);

CREATE POLICY "Annotators can view shared annotations"
ON public.assessment_annotations FOR SELECT TO authenticated
USING (public.submission_can(auth.uid(), submission_id, 'view'));

CREATE POLICY "Annotators can create annotations"
ON public.assessment_annotations FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = owner_id
  AND public.submission_can(auth.uid(), submission_id, 'annotate')
);

CREATE POLICY "Annotators can edit their annotations"
ON public.assessment_annotations FOR UPDATE TO authenticated
USING (auth.uid() = owner_id AND public.submission_can(auth.uid(), submission_id, 'annotate'))
WITH CHECK (auth.uid() = owner_id AND public.submission_can(auth.uid(), submission_id, 'annotate'));

CREATE POLICY "Annotators can delete their annotations"
ON public.assessment_annotations FOR DELETE TO authenticated
USING (auth.uid() = owner_id AND public.submission_can(auth.uid(), submission_id, 'annotate'));