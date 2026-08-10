CREATE TABLE public.capture_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capture_session_id uuid NOT NULL REFERENCES public.capture_sessions(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES public.capture_participants(id) ON DELETE SET NULL,
  owner_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  note text,
  expires_at timestamptz,
  max_uses integer,
  uses_count integer NOT NULL DEFAULT 0,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.capture_invitations TO authenticated;
GRANT ALL ON public.capture_invitations TO service_role;

ALTER TABLE public.capture_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their capture invitations"
ON public.capture_invitations FOR ALL TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE INDEX idx_capture_invitations_session ON public.capture_invitations(capture_session_id);

CREATE TRIGGER trg_capture_invitations_updated
BEFORE UPDATE ON public.capture_invitations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.capture_participants
  ADD COLUMN user_id uuid,
  ADD COLUMN joined_at timestamptz;

CREATE INDEX idx_capture_participants_user ON public.capture_participants(user_id);

CREATE POLICY "Invited participants can read their own participant row"
ON public.capture_participants FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Invited participants can update their own participant row"
ON public.capture_participants FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);