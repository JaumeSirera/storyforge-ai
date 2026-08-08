ALTER TABLE public.email_settings ADD COLUMN IF NOT EXISTS auto_send_on_complete boolean NOT NULL DEFAULT false;

CREATE TABLE public.report_email_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  simulation_id uuid REFERENCES public.simulations(id) ON DELETE SET NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient text NOT NULL,
  subject text,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  error_message text,
  auto boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX report_email_log_session_idx ON public.report_email_log (session_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.report_email_log TO authenticated;
GRANT ALL ON public.report_email_log TO service_role;

ALTER TABLE public.report_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rel_select_owner" ON public.report_email_log FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "rel_insert_owner" ON public.report_email_log FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "rel_update_owner" ON public.report_email_log FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TRIGGER trg_report_email_log_updated BEFORE UPDATE ON public.report_email_log FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();