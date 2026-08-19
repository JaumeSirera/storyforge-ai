ALTER TABLE public.user_billing
  ADD COLUMN IF NOT EXISTS donation_to_credits boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS credit_balance_cents numeric NOT NULL DEFAULT 0;