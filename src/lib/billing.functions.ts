import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export interface BillingSummary {
  subscriptionStatus: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  nextChargeAt: string | null;
  includedCapCents: number;
  includedUsedCents: number;
  extraPendingCents: number;
  currency: string;
  hasSavedCard: boolean;
  cardBrand: string | null;
  cardExpiry: string | null;
  /** true when the monthly donation is converted into AI credits. */
  donationToCredits: boolean;
  /** Remaining AI credit balance (in cents) coming from donations. */
  creditBalanceCents: number;
}

/** Current user's billing summary (plan + running usage). */
export const getMyBilling = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BillingSummary> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: pricing }, { data: billing }] = await Promise.all([
      supabaseAdmin
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
      nextChargeAt: billing?.next_charge_at ?? null,
      includedCapCents: pricing?.subscription_included_cents ?? 0,
      includedUsedCents: Number(billing?.included_used_cents ?? 0),
      extraPendingCents: Number(billing?.extra_pending_cents ?? 0),
      currency: pricing?.currency ?? "EUR",
      hasSavedCard: !!billing?.redsys_card_token,
      cardBrand: billing?.redsys_card_brand ?? null,
      cardExpiry: billing?.redsys_card_expiry ?? null,
      donationToCredits: !!billing?.donation_to_credits,
      creditBalanceCents: Number(billing?.credit_balance_cents ?? 0),
    };
  });

/** Enable/disable converting the monthly donation into AI consumption credits. */
export const setDonationToCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ enabled: z.boolean() }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true; enabled: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("user_billing")
      .upsert(
        { user_id: context.userId, donation_to_credits: data.enabled },
        { onConflict: "user_id" },
      );
    return { ok: true, enabled: data.enabled };
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

export interface PaymentRow {
  id: string;
  order_code: string;
  amount_cents: number;
  currency: string;
  kind: string;
  status: string;
  response_code: string | null;
  auth_code: string | null;
  created_at: string;
}

/** List current user's Redsys payment attempts (subscription, renewals, extras). */
export const listMyPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ limit: z.number().int().min(1).max(500).default(100) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<PaymentRow[]> => {
    const { data: rows, error } = await context.supabase
      .from("redsys_payments")
      .select("id, order_code, amount_cents, currency, kind, status, response_code, auth_code, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Fetch data required to render a receipt PDF for a specific payment. */
export const getMyPaymentReceipt = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ paymentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: pay, error } = await context.supabase
      .from("redsys_payments")
      .select("id, order_code, amount_cents, currency, kind, status, auth_code, response_code, created_at")
      .eq("id", data.paymentId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!pay) throw new Error("Pago no encontrado");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profile }, { data: pricing }] = await Promise.all([
      context.supabase.from("profiles").select("full_name, email").eq("id", context.userId).maybeSingle(),
      supabaseAdmin.from("pricing_config").select("vat_pct").eq("id", true).maybeSingle(),
    ]);
    const product =
      pay.kind === "subscription" || pay.kind === "renewal"
        ? "Xandralyze — Donación mensual"
        : pay.kind === "extra"
          ? "Xandralyze — Consumo extra de IA"
          : "Xandralyze — Simulaciones profesionales";
    return {
      payment: pay,
      buyer: { name: profile?.full_name ?? null, email: profile?.email ?? null },
      merchant: {
        name: "VITA Training",
        merchantCode: "356698696",
        product,
      },
      vatPct: Number(pricing?.vat_pct ?? 21),
    };
  });

/** Build the Redsys hosted-checkout form params for a monthly donation/subscription.
 *  Accepts an optional amount; otherwise falls back to the configured default price.
 *  Returns URL + form fields; the client auto-submits the form. */
export const createSubscriptionCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      origin: z.string().url(),
      amountCents: z.number().int().min(100).max(1000000).optional(),
      description: z.string().max(200).optional(),
    }).parse(input ?? {}),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{
      url: string;
      merchantParameters: string;
      signature: string;
      signatureVersion: string;
    }> => {
      const { getRedsysConfig, newOrderCode, buildCheckoutParams, signRequest } = await import(
        "./redsys.server"
      );
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const cfg = getRedsysConfig();

      let amountCents = data.amountCents;
      if (!amountCents || amountCents <= 0) {
        const { data: pricing } = await supabaseAdmin
          .from("pricing_config")
          .select("subscription_price_cents, currency")
          .eq("id", true)
          .maybeSingle();
        amountCents = pricing?.subscription_price_cents ?? 0;
      }
      if (!amountCents) {
        throw new Error("Importe de donación no configurado");
      }

      const order = newOrderCode();
      await supabaseAdmin.from("redsys_payments").insert({
        user_id: context.userId,
        order_code: order,
        amount_cents: amountCents,
        currency: "EUR",
        kind: "subscription",
        status: "pending",
      });

      const params = buildCheckoutParams({
        order,
        amountCents,
        cfg,
        urlOk: `${data.origin}/app/billing?redsys=ok`,
        urlKo: `${data.origin}/app/billing?redsys=ko`,
        urlNotification: `${data.origin}/api/public/redsys/notification`,
        productDescription: data.description ?? "Xandralyze — Aportación mensual",
        requestTokenization: true,
      });
      const { merchantParameters, signature } = signRequest(params, order, cfg.merchantKey);

      return {
        url: cfg.urlTpv,
        merchantParameters,
        signature,
        signatureVersion: "HMAC_SHA256_V1",
      };
    },
  );

/** Build the Redsys checkout for a one-off charge of the accumulated extra usage.
 *  If the user already has a saved card, we charge it via REST directly. */
export const payExtraNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ origin: z.string().url() }).parse(input ?? {}),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<
      | { mode: "none"; amount: 0 }
      | { mode: "charged"; amount: number; ok: boolean; responseCode: string }
      | {
          mode: "redirect";
          amount: number;
          url: string;
          merchantParameters: string;
          signature: string;
          signatureVersion: string;
        }
    > => {
      const { getRedsysConfig, newOrderCode, buildCheckoutParams, signRequest, chargeRecurringREST } =
        await import("./redsys.server");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const cfg = getRedsysConfig();

      const { data: billing } = await supabaseAdmin
        .from("user_billing")
        .select(
          "redsys_card_token, redsys_original_auth_code, extra_pending_cents",
        )
        .eq("user_id", context.userId)
        .maybeSingle();

      const amount = Math.round(Number(billing?.extra_pending_cents ?? 0));
      if (amount <= 0) return { mode: "none", amount: 0 };

      const order = newOrderCode();
      await supabaseAdmin.from("redsys_payments").insert({
        user_id: context.userId,
        order_code: order,
        amount_cents: amount,
        currency: "EUR",
        kind: "extra",
        status: "pending",
      });

      // Path A: saved card → charge server-to-server via REST
      if (billing?.redsys_card_token && billing?.redsys_original_auth_code) {
        const res = await chargeRecurringREST({
          order,
          amountCents: amount,
          cfg,
          cardToken: billing.redsys_card_token,
          originalAuthCode: billing.redsys_original_auth_code,
          productDescription: "Xandralyze — Consumo extra de IA",
        });
        await supabaseAdmin
          .from("redsys_payments")
          .update({
            status: res.ok ? "paid" : "failed",
            response_code: res.responseCode,
            auth_code: res.authCode ?? null,
            raw_response: res.raw,
          })
          .eq("order_code", order);
        if (res.ok) {
          await supabaseAdmin
            .from("user_billing")
            .update({ extra_pending_cents: 0 })
            .eq("user_id", context.userId);
        }
        return { mode: "charged", amount, ok: res.ok, responseCode: res.responseCode };
      }

      // Path B: no saved card → redirect to hosted checkout
      const params = buildCheckoutParams({
        order,
        amountCents: amount,
        cfg,
        urlOk: `${data.origin}/app/billing?redsys=ok`,
        urlKo: `${data.origin}/app/billing?redsys=ko`,
        urlNotification: `${data.origin}/api/public/redsys/notification`,
        productDescription: "Xandralyze — Consumo extra de IA",
        requestTokenization: false,
      });
      const { merchantParameters, signature } = signRequest(params, order, cfg.merchantKey);
      return {
        mode: "redirect",
        amount,
        url: cfg.urlTpv,
        merchantParameters,
        signature,
        signatureVersion: "HMAC_SHA256_V1",
      };
    },
  );

/** Cancel the auto-renewal by clearing the stored card token. */
export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("user_billing")
      .update({
        subscription_status: "canceled",
        next_charge_at: null,
        redsys_card_token: null,
        redsys_card_brand: null,
        redsys_card_expiry: null,
        redsys_original_auth_code: null,
        redsys_original_order: null,
      })
      .eq("user_id", context.userId);
    return { ok: true };
  });
