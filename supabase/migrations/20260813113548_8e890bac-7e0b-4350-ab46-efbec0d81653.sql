-- 1) user_api_keys: only authenticated owners, no anon access
REVOKE ALL ON public.user_api_keys FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_api_keys TO authenticated;
GRANT ALL ON public.user_api_keys TO service_role;

DROP POLICY IF EXISTS "Users manage their own api keys" ON public.user_api_keys;
CREATE POLICY "Users manage their own api keys"
ON public.user_api_keys FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2) capture_participants: no anon access
REVOKE ALL ON public.capture_participants FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.capture_participants TO authenticated;
GRANT ALL ON public.capture_participants TO service_role;

-- Participants (non-owners) may only update a limited set of columns
CREATE OR REPLACE FUNCTION public.protect_capture_participant_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> OLD.owner_id THEN
    NEW.id := OLD.id;
    NEW.owner_id := OLD.owner_id;
    NEW.capture_session_id := OLD.capture_session_id;
    NEW.user_id := OLD.user_id;
    NEW.role := OLD.role;
    NEW.identifier := OLD.identifier;
    NEW.name := OLD.name;
    NEW.is_late := OLD.is_late;
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_capture_participant_fields ON public.capture_participants;
CREATE TRIGGER trg_protect_capture_participant_fields
BEFORE UPDATE ON public.capture_participants
FOR EACH ROW EXECUTE FUNCTION public.protect_capture_participant_fields();