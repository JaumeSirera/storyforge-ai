
CREATE POLICY "Users read own character files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'characters' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users upload own character files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'characters' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users update own character files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'characters' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own character files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'characters' AND (storage.foldername(name))[1] = auth.uid()::text);
