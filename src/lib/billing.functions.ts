import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export interface BillingSummary {
  subscriptionStatus: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  includedCapCents: number;
  includedUsedCents: number;
  extraPendingCents: number;
  currency: string;
  hasStripeCustomer: boolean;
}

/** Current user's billing summary (plan + running usage). */
export const getMyBilling = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BillingSummary> => {
    const [{ data: pricing }, { data: billing }] = await Promise.all([
      context.supabase
        .from("pricing_config")
        .select("subscription_included_cents, currency")
        .eq("id", true)
        .maybeSingle(),
      context.supabase
        .from("user_billing")
        .select("*")
        .eq("user_id", context.userId)
        .maybeSingle(),
    ]);
    return {
      subscriptionStatus: billing?.subscription_status ?? null,
      currentPeriodStart: billing?.current_period_start ?? null,
      currentPeriodEnd: billing?.current_period_end ?? null,
      includedCapCents: pricing?.subscription_included_cents ?? 0,
      includedUsedCents: Number(billing?.included_used_cents ?? 0),
      extraPendingCents: Number(billing?.extra_pending_cents ?? 0),
      currency: pricing?.currency ?? "EUR",
      hasStripeCustomer: !!billing?.stripe_customer_id,
    };
  });

/** Recent usage events for current user. */
export const listMyUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ limit: z.number().int().min(1).max(200).default(50) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("usage_events")
      .select("id, action, provider, model, input_tokens, output_tokens, seconds, characters, units, cost_raw_cents, margin_pct, total_cents, pays_platform, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
