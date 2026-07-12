import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { getStripe } = await import("@/lib/stripe.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const stripe = getStripe();

        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        const signature = request.headers.get("stripe-signature") ?? "";
        const body = await request.text();

        let event;
        try {
          if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET no configurado");
          event = await stripe.webhooks.constructEventAsync(body, signature, secret);
        } catch (err) {
          console.error("[stripe webhook] signature verify failed:", (err as Error).message);
          return new Response("Invalid signature", { status: 400 });
        }

        try {
          switch (event.type) {
            case "checkout.session.completed": {
              const s = event.data.object as any;
              const userId = s.client_reference_id ?? s.metadata?.user_id;
              if (userId) {
                await supabaseAdmin
                  .from("user_billing")
                  .upsert(
                    {
                      user_id: userId,
                      stripe_customer_id: s.customer as string,
                      stripe_subscription_id: (s.subscription as string) ?? null,
                      subscription_status: "active",
                    },
                    { onConflict: "user_id" },
                  );
              }
              break;
            }
            case "customer.subscription.created":
            case "customer.subscription.updated":
            case "customer.subscription.deleted": {
              const sub = event.data.object as any;
              const userId = sub.metadata?.user_id ?? null;
              const patch = {
                subscription_status: sub.status as string,
                stripe_subscription_id: sub.id as string,
                current_period_start: sub.current_period_start
                  ? new Date(sub.current_period_start * 1000).toISOString()
                  : null,
                current_period_end: sub.current_period_end
                  ? new Date(sub.current_period_end * 1000).toISOString()
                  : null,
              };
              if (userId) {
                await supabaseAdmin
                  .from("user_billing")
                  .upsert({ user_id: userId, stripe_customer_id: sub.customer, ...patch }, { onConflict: "user_id" });
              } else {
                await supabaseAdmin
                  .from("user_billing")
                  .update(patch)
                  .eq("stripe_customer_id", sub.customer);
              }
              // On renewal, reset the included_used counter for the new period
              if (event.type === "customer.subscription.updated" && sub.status === "active") {
                await supabaseAdmin
                  .from("user_billing")
                  .update({ included_used_cents: 0 })
                  .eq("stripe_customer_id", sub.customer);
              }
              break;
            }
            case "invoice.paid": {
              const inv = event.data.object as any;
              if (inv.metadata?.kind === "extra_usage") {
                await supabaseAdmin
                  .from("user_billing")
                  .update({ extra_pending_cents: 0 })
                  .eq("stripe_customer_id", inv.customer);
              }
              break;
            }
            default:
              break;
          }
        } catch (err) {
          console.error("[stripe webhook] handler error:", err);
          return new Response("Handler error", { status: 500 });
        }

        return new Response("ok");
      },
    },
  },
});
