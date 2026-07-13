// Redsys asynchronous notification endpoint (Ds_MerchantURL).
// Redsys POSTs application/x-www-form-urlencoded with:
//   Ds_SignatureVersion, Ds_MerchantParameters, Ds_Signature
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/redsys/notification")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { getRedsysConfig, verifyResponseSignature } = await import(
          "@/lib/redsys.server"
        );
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let merchantParameters = "";
        let signature = "";
        const contentType = request.headers.get("content-type") ?? "";
        try {
          if (contentType.includes("application/json")) {
            const j = (await request.json()) as any;
            merchantParameters = String(j.Ds_MerchantParameters ?? "");
            signature = String(j.Ds_Signature ?? "");
          } else {
            const form = await request.formData();
            merchantParameters = String(form.get("Ds_MerchantParameters") ?? "");
            signature = String(form.get("Ds_Signature") ?? "");
          }
        } catch (err) {
          console.error("[redsys] cannot parse notification body", err);
          return new Response("Bad Request", { status: 400 });
        }
        if (!merchantParameters || !signature) {
          return new Response("Missing params", { status: 400 });
        }

        const cfg = getRedsysConfig();
        const { ok, params } = verifyResponseSignature(
          merchantParameters,
          signature,
          cfg.merchantKey,
        );
        if (!ok) {
          console.error("[redsys] invalid signature");
          return new Response("Invalid signature", { status: 401 });
        }

        const order = params.Ds_Order;
        const responseCode = String(params.Ds_Response ?? "");
        const numeric = Number(responseCode);
        const isPaid = Number.isFinite(numeric) && numeric >= 0 && numeric <= 99;
        const authCode = params.Ds_AuthorisationCode ?? null;
        const cardToken = params.Ds_Merchant_Identifier ?? null;
        const cardBrand = params.Ds_Card_Brand ?? null;
        const cardExpiry = params.Ds_ExpiryDate ?? null;

        // 1. Update the payment record
        const { data: payment } = await supabaseAdmin
          .from("redsys_payments")
          .update({
            status: isPaid ? "paid" : "failed",
            response_code: responseCode,
            auth_code: authCode,
            card_token: cardToken,
            card_brand: cardBrand,
            card_expiry: cardExpiry,
            raw_response: params,
          })
          .eq("order_code", order)
          .select("user_id, kind, amount_cents")
          .maybeSingle();

        if (!payment) {
          console.warn("[redsys] no matching order:", order);
          return new Response("OK");
        }
        if (!isPaid) return new Response("OK");

        // 2. Update user_billing based on the payment kind
        if (payment.kind === "subscription") {
          const now = new Date();
          const nextCharge = new Date(now);
          nextCharge.setMonth(nextCharge.getMonth() + 1);
          await supabaseAdmin.from("user_billing").upsert(
            {
              user_id: payment.user_id,
              subscription_status: "active",
              current_period_start: now.toISOString(),
              current_period_end: nextCharge.toISOString(),
              next_charge_at: nextCharge.toISOString(),
              included_used_cents: 0,
              redsys_card_token: cardToken,
              redsys_card_brand: cardBrand,
              redsys_card_expiry: cardExpiry,
              redsys_original_auth_code: authCode,
              redsys_original_order: order,
            },
            { onConflict: "user_id" },
          );
        } else if (payment.kind === "extra") {
          await supabaseAdmin
            .from("user_billing")
            .update({ extra_pending_cents: 0 })
            .eq("user_id", payment.user_id);
        }

        return new Response("OK");
      },
    },
  },
});
