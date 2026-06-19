CREATE TABLE public.simulation_revisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  simulation_id UUID NOT NULL REFERENCES public.simulations(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('edit', 'submit', 'publish', 'revert', 'create')),
  from_status TEXT,
  to_status TEXT,
  note TEXT,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX simulation_revisions_simulation_id_idx
  ON public.simulation_revisions (simulation_id, created_at DESC);

GRANT SELECT, INSERT ON public.simulation_revisions TO authenticated;
GRANT ALL ON public.simulation_revisions TO service_role;

ALTER TABLE public.simulation_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rev_select_owner"
  ON public.simulation_revisions
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT owner_id FROM public.simulations WHERE id = simulation_revisions.simulation_id
    )
  );

CREATE POLICY "rev_insert_owner_actor"
  ON public.simulation_revisions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = actor_id
    AND auth.uid() IN (
      SELECT owner_id FROM public.simulations WHERE id = simulation_id
    )
  );