REVOKE EXECUTE ON FUNCTION public.assessment_can(uuid, uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.submission_can(uuid, uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.assessment_can(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submission_can(uuid, uuid, text) TO authenticated, service_role;