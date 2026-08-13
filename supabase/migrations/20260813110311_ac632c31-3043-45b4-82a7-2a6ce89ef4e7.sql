CREATE OR REPLACE FUNCTION public.has_session_for_simulation(_user_id uuid, _simulation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sessions
    WHERE user_id = _user_id AND simulation_id = _simulation_id
  )
$$;

GRANT EXECUTE ON FUNCTION public.has_session_for_simulation(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "sim_select_participant" ON public.simulations;
CREATE POLICY "sim_select_participant" ON public.simulations
  FOR SELECT TO authenticated
  USING (public.has_session_for_simulation(auth.uid(), id));