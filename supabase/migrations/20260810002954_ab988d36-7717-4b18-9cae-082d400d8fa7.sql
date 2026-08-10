CREATE TABLE public.capture_preferences (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  area_key text,
  mode text NOT NULL DEFAULT 'individual',
  capture_mode text NOT NULL DEFAULT 'single_device',
  record_screen boolean NOT NULL DEFAULT false,
  retention_days integer NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.capture_preferences TO authenticated;
GRANT ALL ON public.capture_preferences TO service_role;

ALTER TABLE public.capture_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own capture preferences"
ON public.capture_preferences FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_capture_preferences_updated
BEFORE UPDATE ON public.capture_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();