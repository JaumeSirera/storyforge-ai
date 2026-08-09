CREATE POLICY "recordings_owner_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'recordings' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'recordings' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "participants_owner_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'participants' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'participants' AND (storage.foldername(name))[1] = auth.uid()::text);