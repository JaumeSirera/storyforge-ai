ALTER TABLE public.user_api_keys
  ADD COLUMN IF NOT EXISTS turn_key_id TEXT,
  ADD COLUMN IF NOT EXISTS turn_api_token TEXT,
  ADD COLUMN IF NOT EXISTS turn_urls TEXT,
  ADD COLUMN IF NOT EXISTS turn_username TEXT,
  ADD COLUMN IF NOT EXISTS turn_credential TEXT;