CREATE TABLE public.capture_hypothesis_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  capture_session_id uuid NOT NULL REFERENCES public.capture_sessions(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hypothesis_index integer NOT NULL,
  hypothesis_text text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  adjusted_text text,
  confidence text NOT NULL DEFAULT 'media',
  comment text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (capture_session_id, hypothesis_index)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.capture_hypothesis_reviews TO authenticated;
GRANT ALL ON public.capture_hypothesis_reviews TO service_role;
ALTER TABLE public.capture_hypothesis_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their hypothesis reviews"
  ON public.capture_hypothesis_reviews FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER trg_capture_hypothesis_reviews_updated
  BEFORE UPDATE ON public.capture_hypothesis_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.capture_hypothesis_review_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id uuid NOT NULL REFERENCES public.capture_hypothesis_reviews(id) ON DELETE CASCADE,
  capture_session_id uuid NOT NULL REFERENCES public.capture_sessions(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hypothesis_index integer NOT NULL,
  action text NOT NULL DEFAULT 'update',
  status text NOT NULL,
  adjusted_text text,
  confidence text NOT NULL,
  comment text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.capture_hypothesis_review_events TO authenticated;
GRANT ALL ON public.capture_hypothesis_review_events TO service_role;
ALTER TABLE public.capture_hypothesis_review_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read their hypothesis history"
  ON public.capture_hypothesis_review_events FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);
CREATE POLICY "Owners append their hypothesis history"
  ON public.capture_hypothesis_review_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE INDEX idx_hyp_reviews_session ON public.capture_hypothesis_reviews (capture_session_id);
CREATE INDEX idx_hyp_events_session ON public.capture_hypothesis_review_events (capture_session_id, created_at DESC);