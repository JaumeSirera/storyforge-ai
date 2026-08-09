-- Fase 3: Analyze — transcripción por hablante, métricas objetivas y red de interacción

CREATE TABLE public.capture_transcript_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capture_session_id uuid NOT NULL REFERENCES public.capture_sessions(id) ON DELETE CASCADE,
  recording_id uuid NOT NULL REFERENCES public.capture_recordings(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES public.capture_participants(id) ON DELETE SET NULL,
  speaker_label text,
  start_sec numeric NOT NULL DEFAULT 0,
  end_sec numeric NOT NULL DEFAULT 0,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.capture_transcript_segments TO authenticated;
GRANT ALL ON public.capture_transcript_segments TO service_role;
ALTER TABLE public.capture_transcript_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their transcript segments"
  ON public.capture_transcript_segments FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE INDEX idx_transcript_segments_session ON public.capture_transcript_segments (capture_session_id, start_sec);
CREATE INDEX idx_transcript_segments_recording ON public.capture_transcript_segments (recording_id);

CREATE TRIGGER trg_transcript_segments_updated
  BEFORE UPDATE ON public.capture_transcript_segments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.capture_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capture_session_id uuid NOT NULL REFERENCES public.capture_sessions(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  stage text,
  error_message text,
  transcription_model text,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  interactions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT capture_analyses_session_unique UNIQUE (capture_session_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.capture_analyses TO authenticated;
GRANT ALL ON public.capture_analyses TO service_role;
ALTER TABLE public.capture_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their analyses"
  ON public.capture_analyses FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER trg_capture_analyses_updated
  BEFORE UPDATE ON public.capture_analyses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();