DROP POLICY IF EXISTS "Anyone signed in can read pricing" ON public.pricing_config;
CREATE POLICY "Only admins can read pricing" ON public.pricing_config
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));