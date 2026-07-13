REVOKE INSERT, UPDATE, DELETE ON public.usage_events FROM authenticated, anon;
CREATE POLICY "Deny client inserts on usage_events" ON public.usage_events FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY "Deny client updates on usage_events" ON public.usage_events FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "Deny client deletes on usage_events" ON public.usage_events FOR DELETE TO authenticated, anon USING (false);