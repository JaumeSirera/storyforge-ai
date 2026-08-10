ALTER TABLE public.capture_consents
  ADD COLUMN IF NOT EXISTS consent_version text NOT NULL DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'host';

CREATE INDEX IF NOT EXISTS capture_consents_session_idx
  ON public.capture_consents (capture_session_id, recorded_at DESC);