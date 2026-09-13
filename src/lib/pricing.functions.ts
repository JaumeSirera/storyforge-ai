import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { xdb, xAdminDb } from "./assessments-repo.server";

/** Public: read current pricing (anyone signed in). */
export const getPricingConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await xdb(context)
      .from("pricing_config")
      .select("*")
      .eq("id", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

const NumberField = z.union([z.number(), z.string()]).transform((v) => Number(v)).refine(
  (n) => Number.isFinite(n) && n >= 0,
  "Debe ser un número no negativo",
);

const UpdateInput = z.object({
  openai_input_per_1k: NumberField.optional(),
  openai_output_per_1k: NumberField.optional(),
  gemini_input_per_1k: NumberField.optional(),
  gemini_output_per_1k: NumberField.optional(),
  replicate_video_per_second: NumberField.optional(),
  replicate_lipsync_per_second: NumberField.optional(),
  replicate_image_per_unit: NumberField.optional(),
  elevenlabs_per_1k_chars: NumberField.optional(),
  margin_user_pays_pct: NumberField.optional(),
  margin_platform_pays_pct: NumberField.optional(),
  subscription_price_cents: z.number().int().nonnegative().optional(),
  subscription_included_cents: z.number().int().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  vat_pct: NumberField.optional(),
});

/** Admin only: update pricing knobs. */
export const updatePricingConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateInput.parse(input))
  .handler(async ({ data, context }) => {
    // Guard: only admins
    const { data: isAdmin } = await xdb(context).rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("No autorizado");

    const { error } = await xdb(context)
      .from("pricing_config")
      .update(data)
      .eq("id", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
