ALTER TABLE public.email_settings ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS report_email_sent_at timestamptz;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS report_email_to text;