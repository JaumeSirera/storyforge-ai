
DROP POLICY IF EXISTS "Public can view published simulations" ON public.simulations;
DROP POLICY IF EXISTS "sim_select_own_or_public" ON public.simulations;

CREATE POLICY "sim_select_own" ON public.simulations
  FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);

REVOKE SELECT ON public.simulations FROM anon;
