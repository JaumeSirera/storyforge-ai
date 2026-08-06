CREATE POLICY "branding_own_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'branding' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "branding_own_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'branding' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "branding_own_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'branding' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "branding_own_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'branding' AND (storage.foldername(name))[1] = auth.uid()::text);