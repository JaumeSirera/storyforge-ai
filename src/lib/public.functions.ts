import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

function serverPublicClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input as any, { ...init, headers: h });
      },
    },
  });
}

/** Public gallery — anyone (no login) can view published + public simulations. */
export const listPublicSimulations = createServerFn({ method: "GET" }).handler(async () => {
  const supa = serverPublicClient();
  const { data, error } = await supa
    .from("simulations")
    .select("id, title, objective, topic, duration_min, cover_image_url, updated_at")
    .eq("is_public", true)
    .eq("status", "published")
    .order("updated_at", { ascending: false })
    .limit(120);
  if (error) throw new Error(error.message);
  return data ?? [];
});

/** Public detail — safe subset for the gallery landing. */
export const getPublicSimulation = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data }) => {
    const supa = serverPublicClient();
    const { data: sim, error } = await supa
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
