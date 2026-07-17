
CREATE TABLE public.simulation_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id uuid NOT NULL REFERENCES public.simulations(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  note text,
  expires_at timestamptz,
  max_uses integer,
  uses_count integer NOT NULL DEFAULT 0,
  revoked_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX simulation_invitations_sim_idx ON public.simulation_invitations(simulation_id);
CREATE INDEX simulation_invitations_token_idx ON public.simulation_invitations(token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulation_invitations TO authenticated;
GRANT ALL ON public.simulation_invitations TO service_role;

ALTER TABLE public.simulation_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads own invitations"
  ON public.simulation_invitations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.simulations s
      WHERE s.id = simulation_id AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Owner inserts invitations"
  ON public.simulation_invitations FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.simulations s
      WHERE s.id = simulation_id AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Owner updates own invitations"
  ON public.simulation_invitations FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.simulations s
      WHERE s.id = simulation_id AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Owner deletes own invitations"
  ON public.simulation_invitations FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.simulations s
      WHERE s.id = simulation_id AND s.owner_id = auth.uid()
    )
  );
