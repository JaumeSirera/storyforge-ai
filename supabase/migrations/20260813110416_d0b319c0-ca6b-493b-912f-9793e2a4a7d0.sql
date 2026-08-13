REVOKE EXECUTE ON FUNCTION public.has_session_for_simulation(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_session_for_simulation(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_session_for_simulation(uuid, uuid) TO authenticated;