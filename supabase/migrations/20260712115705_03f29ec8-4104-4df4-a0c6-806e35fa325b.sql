
CREATE TABLE public.pricing_config (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE,
  openai_input_per_1k NUMERIC(12,6) NOT NULL DEFAULT 15,
  openai_output_per_1k NUMERIC(12,6) NOT NULL DEFAULT 60,
  gemini_input_per_1k NUMERIC(12,6) NOT NULL DEFAULT 7.5,
  gemini_output_per_1k NUMERIC(12,6) NOT NULL DEFAULT 30,
  replicate_video_per_second NUMERIC(12,6) NOT NULL DEFAULT 8,
  replicate_lipsync_per_second NUMERIC(12,6) NOT NULL DEFAULT 5,
  replicate_image_per_unit NUMERIC(12,6) NOT NULL DEFAULT 5,
  elevenlabs_per_1k_chars NUMERIC(12,6) NOT NULL DEFAULT 30,
  margin_user_pays_pct NUMERIC(6,2) NOT NULL DEFAULT 15.00,
  margin_platform_pays_pct NUMERIC(6,2) NOT NULL DEFAULT 40.00,
  subscription_price_cents INTEGER NOT NULL DEFAULT 1900,
  subscription_included_cents INTEGER NOT NULL DEFAULT 500,
  currency TEXT NOT NULL DEFAULT 'EUR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pricing_config_singleton CHECK (id = TRUE)
);

GRANT SELECT ON public.pricing_config TO authenticated;
GRANT ALL ON public.pricing_config TO service_role;
ALTER TABLE public.pricing_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can read pricing"
  ON public.pricing_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admins can update pricing"
  ON public.pricing_config FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_pricing_config_updated_at
  BEFORE UPDATE ON public.pricing_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.pricing_config (id) VALUES (TRUE) ON CONFLICT DO NOTHING;

CREATE TABLE public.usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  simulation_id UUID REFERENCES public.simulations(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('text','image','video','lipsync','tts')),
  provider TEXT NOT NULL,
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  seconds NUMERIC(10,3),
  characters INTEGER,
  units INTEGER,
  cost_raw_cents NUMERIC(12,4) NOT NULL DEFAULT 0,
  margin_pct NUMERIC(6,2) NOT NULL DEFAULT 0,
  total_cents NUMERIC(12,4) NOT NULL DEFAULT 0,
  pays_platform BOOLEAN NOT NULL DEFAULT FALSE,
  billed BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_usage_events_user_created ON public.usage_events(user_id, created_at DESC);
CREATE INDEX idx_usage_events_unbilled ON public.usage_events(user_id, billed) WHERE billed = FALSE;

GRANT SELECT ON public.usage_events TO authenticated;
GRANT ALL ON public.usage_events TO service_role;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own usage"
  ON public.usage_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.user_billing (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  subscription_status TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  included_used_cents NUMERIC(12,4) NOT NULL DEFAULT 0,
  extra_pending_cents NUMERIC(12,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_billing TO authenticated;
GRANT ALL ON public.user_billing TO service_role;
ALTER TABLE public.user_billing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own billing"
  ON public.user_billing FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_user_billing_updated_at
  BEFORE UPDATE ON public.user_billing
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
