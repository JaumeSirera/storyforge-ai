CREATE TABLE public.capture_scene_annotations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  capture_session_id uuid NOT NULL REFERENCES public.capture_sessions(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scene_index integer NOT NULL,
  scene_title text,
  start_sec numeric NOT NULL DEFAULT 0,
  end_sec numeric NOT NULL DEFAULT 0,
  note text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (capture_session_id, scene_index)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.capture_scene_annotations TO authenticated;
GRANT ALL ON public.capture_scene_annotations TO service_role;

ALTER TABLE public.capture_scene_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their scene annotations"
ON public.capture_scene_annotations FOR ALL TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE INDEX idx_capture_scene_annotations_session ON public.capture_scene_annotations (capture_session_id, scene_index);

CREATE TRIGGER trg_capture_scene_annotations_updated
BEFORE UPDATE ON public.capture_scene_annotations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();