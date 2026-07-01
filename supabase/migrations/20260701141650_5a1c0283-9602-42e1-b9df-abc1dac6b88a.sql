
CREATE TABLE public.simulation_characters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  simulation_id UUID REFERENCES public.simulations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  image_path TEXT NOT NULL,
  consent_acknowledged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulation_characters TO authenticated;
GRANT ALL ON public.simulation_characters TO service_role;

ALTER TABLE public.simulation_characters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own characters"
  ON public.simulation_characters FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_simulation_characters_updated_at
  BEFORE UPDATE ON public.simulation_characters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX simulation_characters_user_idx ON public.simulation_characters(user_id, created_at DESC);
