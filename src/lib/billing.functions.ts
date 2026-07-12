import { createServerFn } from "@tanstack/react-start";
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

/** Create Stripe Checkout Session for the subscription. */
export const createSubscriptionCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ origin: z.string().url() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    const { getStripe } = await import("./stripe.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const stripe = getStripe();

    const { data: pricing } = await supabaseAdmin
      .from("pricing_config")
      .select("subscription_price_cents, currency")
      .eq("id", true)
      .maybeSingle();
    if (!pricing || !pricing.subscription_price_cents) {
      throw new Error("Precio de suscripción no configurado");
    }

    const { data: billing } = await supabaseAdmin
      .from("user_billing")
      .select("stripe_customer_id")
      .eq("user_id", context.userId)
      .maybeSingle();

    let customerId = billing?.stripe_customer_id ?? undefined;
    if (!customerId) {
      const email = context.claims?.email as string | undefined;
      const customer = await stripe.customers.create({
        email,
        metadata: { user_id: context.userId },
      });
      customerId = customer.id;
      await supabaseAdmin
        .from("user_billing")
        .upsert({ user_id: context.userId, stripe_customer_id: customerId }, { onConflict: "user_id" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: context.userId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: (pricing.currency ?? "EUR").toLowerCase(),
            unit_amount: pricing.subscription_price_cents,
            recurring: { interval: "month" },
            product_data: { name: "PlayGame — Suscripción mensual" },
          },
        },
      ],
      success_url: `${data.origin}/app/billing?checkout=success`,
      cancel_url: `${data.origin}/app/billing?checkout=cancel`,
      metadata: { user_id: context.userId },
    });

    if (!session.url) throw new Error("Stripe no devolvió URL de checkout");
    return { url: session.url };
  });

/** Open Stripe Billing Portal for the user. */
export const openBillingPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ origin: z.string().url() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    const { getStripe } = await import("./stripe.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const stripe = getStripe();
    const { data: billing } = await supabaseAdmin
      .from("user_billing")
      .select("stripe_customer_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!billing?.stripe_customer_id) throw new Error("No hay cliente de Stripe");
    const portal = await stripe.billingPortal.sessions.create({
      customer: billing.stripe_customer_id,
      return_url: `${data.origin}/app/billing`,
    });
    return { url: portal.url };
  });

/** Create an on-demand invoice for the user's accumulated `extra_pending_cents`. */
export const payExtraNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true; invoiceId: string | null; amount: number }> => {
    const { getStripe } = await import("./stripe.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const stripe = getStripe();

    const { data: billing } = await supabaseAdmin
      .from("user_billing")
      .select("stripe_customer_id, extra_pending_cents")
      .eq("user_id", context.userId)
      .maybeSingle();

    const amount = Math.round(Number(billing?.extra_pending_cents ?? 0));
    if (!billing?.stripe_customer_id) throw new Error("Primero suscríbete para añadir un método de pago");
    if (amount <= 0) return { ok: true, invoiceId: null, amount: 0 };

    const { data: pricing } = await supabaseAdmin
      .from("pricing_config")
      .select("currency")
      .eq("id", true)
      .maybeSingle();
    const currency = (pricing?.currency ?? "EUR").toLowerCase();

    await stripe.invoiceItems.create({
      customer: billing.stripe_customer_id,
      amount,
      currency,
      description: "PlayGame — Consumo extra de IA",
    });
    const invoice = await stripe.invoices.create({
      customer: billing.stripe_customer_id,
      auto_advance: true,
      collection_method: "charge_automatically",
      metadata: { user_id: context.userId, kind: "extra_usage" },
    });
    if (!invoice.id) throw new Error("Stripe no devolvió invoice.id");
    try {
      await stripe.invoices.pay(invoice.id);
    } catch (e) {
      // Left in draft/open — will retry via Stripe dunning
      console.warn("[billing] invoice pay failed, left open:", (e as Error).message);
    }

    // Optimistically clear the pending balance; webhook will confirm on invoice.paid
    await supabaseAdmin
      .from("user_billing")
      .update({ extra_pending_cents: 0 })
      .eq("user_id", context.userId);

    return { ok: true, invoiceId: invoice.id, amount };
  });
