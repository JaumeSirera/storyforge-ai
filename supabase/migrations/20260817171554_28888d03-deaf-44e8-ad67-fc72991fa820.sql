GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assessment_can(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submission_can(uuid, uuid, text) TO authenticated, service_role;