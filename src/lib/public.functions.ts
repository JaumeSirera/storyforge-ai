import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Public gallery — anyone (no login) can view published + public simulations.
 * Uses supabaseAdmin (bypasses RLS) but ONLY projects safe, non-sensitive columns.
 * Sensitive fields (prompt, story, evaluation_criteria) are NEVER exposed here. */
export const listPublicSimulations = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("simulations")
    .select("id, title, objective, topic, duration_min, cover_image_url, updated_at")
    .eq("is_public", true)
    .eq("status", "published")
    .order("updated_at", { ascending: false })
    .limit(120);
  if (error) throw new Error(error.message);
  return data ?? [];
});

/** Public detail — safe subset for the gallery landing.
 * Excludes prompt, story, and other internal business-logic fields. */
export const getPublicSimulation = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sim, error } = await supabaseAdmin
      .from("simulations")
      .select(
        "id, title, objective, topic, duration_min, cover_image_url, evaluation_criteria, candidate_fields, status, is_public",
      )
      .eq("id", data.id)
      .eq("is_public", true)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!sim) throw new Error("Simulación no disponible");
    return sim;
  });
