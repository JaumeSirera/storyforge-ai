CREATE TABLE public.question_bank_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'narrative',
  subject text,
  area_key text,
  tags text[] NOT NULL DEFAULT '{}',
  question jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  times_used integer NOT NULL DEFAULT 0,
  source_assessment_id uuid REFERENCES public.assessments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_bank_items TO authenticated;
GRANT ALL ON public.question_bank_items TO service_role;
ALTER TABLE public.question_bank_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their bank items" ON public.question_bank_items
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER trg_question_bank_items_updated BEFORE UPDATE ON public.question_bank_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_question_bank_items_owner ON public.question_bank_items (owner_id, updated_at DESC);

CREATE TABLE public.question_bank_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id uuid NOT NULL REFERENCES public.question_bank_items(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version integer NOT NULL,
  question jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, version)
);

GRANT SELECT, INSERT ON public.question_bank_versions TO authenticated;
GRANT ALL ON public.question_bank_versions TO service_role;
ALTER TABLE public.question_bank_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read their bank versions" ON public.question_bank_versions
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owners create their bank versions" ON public.question_bank_versions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE INDEX idx_question_bank_versions_item ON public.question_bank_versions (item_id, version DESC);