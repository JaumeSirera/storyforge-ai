
ALTER TABLE public.user_billing
  ADD COLUMN IF NOT EXISTS redsys_card_token text,
  ADD COLUMN IF NOT EXISTS redsys_card_brand text,
  ADD COLUMN IF NOT EXISTS redsys_card_expiry text,
  ADD COLUMN IF NOT EXISTS redsys_original_auth_code text,
  ADD COLUMN IF NOT EXISTS redsys_original_order text,
  ADD COLUMN IF NOT EXISTS next_charge_at timestamptz;

ALTER TABLE public.user_billing
  DROP COLUMN IF EXISTS stripe_customer_id,
  DROP COLUMN IF EXISTS stripe_subscription_id;

CREATE TABLE IF NOT EXISTS public.redsys_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_code text NOT NULL UNIQUE,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  response_code text,
  auth_code text,
  card_token text,
  card_brand text,
  card_expiry text,
  raw_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.redsys_payments TO authenticated;
GRANT ALL ON public.redsys_payments TO service_role;

ALTER TABLE public.redsys_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own redsys payments"
  ON public.redsys_payments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all redsys payments"
  ON public.redsys_payments FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_redsys_payments_user ON public.redsys_payments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_billing_next_charge ON public.user_billing(next_charge_at) WHERE subscription_status = 'active';

CREATE TRIGGER trg_redsys_payments_updated_at
  BEFORE UPDATE ON public.redsys_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
