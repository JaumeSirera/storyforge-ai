// Recurring charge endpoint — invoked daily by pg_cron. Iterates active
// subscriptions whose next_charge_at has passed and charges the saved card
// via Redsys REST.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/redsys/charge-recurring")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Authenticate cron caller via Supabase anon apikey header.
        const apiKey = request.headers.get("apikey") ?? "";
        if (apiKey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { getRedsysConfig, newOrderCode, chargeRecurringREST } = await import(
          "@/lib/redsys.server"
        );
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const cfg = getRedsysConfig();

        const { data: pricing } = await supabaseAdmin
          .from("pricing_config")
          .select("subscription_price_cents, currency")
          .eq("id", true)
          .maybeSingle();
        const amount = pricing?.subscription_price_cents ?? 0;
        if (!amount) return Response.json({ charged: 0, reason: "no_price" });

        const nowIso = new Date().toISOString();
        const { data: due } = await supabaseAdmin
          .from("user_billing")
          .select(
            "user_id, redsys_card_token, redsys_original_auth_code, next_charge_at",
          )
          .eq("subscription_status", "active")
          .not("redsys_card_token", "is", null)
          .lte("next_charge_at", nowIso)
          .limit(200);

        let charged = 0;
        let failed = 0;
        for (const row of due ?? []) {
          if (!row.redsys_card_token || !row.redsys_original_auth_code) continue;
          const order = newOrderCode();
          await supabaseAdmin.from("redsys_payments").insert({
            user_id: row.user_id,
            order_code: order,
            amount_cents: amount,
            currency: pricing?.currency ?? "EUR",
            kind: "subscription",
            status: "pending",
          });
          try {
            const res = await chargeRecurringREST({
              order,
              amountCents: amount,
              cfg,
              cardToken: row.redsys_card_token,
              originalAuthCode: row.redsys_original_auth_code,
              productDescription: "Playnalyze — Renovación mensual",
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
              const start = new Date();
              const end = new Date(start);
              end.setMonth(end.getMonth() + 1);
              await supabaseAdmin
                .from("user_billing")
                .update({
                  current_period_start: start.toISOString(),
                  current_period_end: end.toISOString(),
                  next_charge_at: end.toISOString(),
                  included_used_cents: 0,
                })
                .eq("user_id", row.user_id);
              charged++;
            } else {
              // Mark past_due after failure; retry next day.
              const retry = new Date();
              retry.setDate(retry.getDate() + 1);
              await supabaseAdmin
                .from("user_billing")
                .update({
                  subscription_status: "past_due",
                  next_charge_at: retry.toISOString(),
                })
                .eq("user_id", row.user_id);
              failed++;
            }
          } catch (err) {
            console.error("[redsys cron] charge failed", err);
            failed++;
          }
        }
        return Response.json({ charged, failed, evaluated: due?.length ?? 0 });
      },
    },
  },
});
