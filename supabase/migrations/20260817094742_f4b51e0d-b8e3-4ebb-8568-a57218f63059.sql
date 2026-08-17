CREATE TABLE public.assessment_annotations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id uuid NOT NULL REFERENCES public.assessment_submissions(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_path text NOT NULL,
  page_index integer NOT NULL DEFAULT 0,
  kind text NOT NULL DEFAULT 'transcription',
  x numeric NOT NULL DEFAULT 0,
  y numeric NOT NULL DEFAULT 0,
  w numeric NOT NULL DEFAULT 0,
  h numeric NOT NULL DEFAULT 0,
  correction text NOT NULL DEFAULT '',
  comment text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT assessment_annotations_kind_check CHECK (kind IN ('transcription','handwriting','content'))
);

CREATE INDEX assessment_annotations_submission_idx ON public.assessment_annotations (submission_id, page_index);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_annotations TO authenticated;
GRANT ALL ON public.assessment_annotations TO service_role;

ALTER TABLE public.assessment_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their assessment annotations"
ON public.assessment_annotations FOR ALL TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE TRIGGER trg_assessment_annotations_updated
BEFORE UPDATE ON public.assessment_annotations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();