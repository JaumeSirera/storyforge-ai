
ALTER TABLE public.simulations
  ADD COLUMN IF NOT EXISTS candidate_fields jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS candidate_name text,
  ADD COLUMN IF NOT EXISTS candidate_email text,
  ADD COLUMN IF NOT EXISTS candidate_fields_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS admin_feedback text,
  ADD COLUMN IF NOT EXISTS admin_feedback_at timestamptz;

-- Public gallery: anon can read published + public simulations (safe columns via server projection).
DROP POLICY IF EXISTS "Public can view published simulations" ON public.simulations;
CREATE POLICY "Public can view published simulations"
  ON public.simulations FOR SELECT
  TO anon
  USING (is_public = true AND status = 'published');

GRANT SELECT ON public.simulations TO anon;

-- Simulation owner can UPDATE sessions run against their simulation (to write feedback).
DROP POLICY IF EXISTS "sess_update_owner_of_sim" ON public.sessions;
CREATE POLICY "sess_update_owner_of_sim"
  ON public.sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() IN (SELECT owner_id FROM public.simulations WHERE id = sessions.simulation_id))
  WITH CHECK (auth.uid() IN (SELECT owner_id FROM public.simulations WHERE id = sessions.simulation_id));
