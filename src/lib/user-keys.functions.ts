import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type TextProvider = "openai" | "gemini";

export interface UserApiKeys {
  openaiKey: string | null;
  geminiKey: string | null;
  replicateKey: string | null;
  elevenlabsKey: string | null;
  textProvider: TextProvider;
}

const EMPTY: UserApiKeys = {
  openaiKey: null,
  geminiKey: null,
  replicateKey: null,
  elevenlabsKey: null,
  textProvider: "gemini",
};

/** Devuelve una máscara "sk-…xxxx" para no exponer la clave completa al cliente. */
function maskKey(k: string | null): string | null {
  if (!k) return null;
  if (k.length <= 8) return "••••";
  return `${k.slice(0, 4)}…${k.slice(-4)}`;
}

export const getMyApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_api_keys")
      .select("openai_key, gemini_key, replicate_key, elevenlabs_key, text_provider")
      .eq("user_id", context.userId)
      .maybeSingle();

    return {
      openaiKeyMasked: maskKey(data?.openai_key ?? null),
      geminiKeyMasked: maskKey(data?.gemini_key ?? null),
      replicateKeyMasked: maskKey(data?.replicate_key ?? null),
      elevenlabsKeyMasked: maskKey(data?.elevenlabs_key ?? null),
      hasOpenai: !!data?.openai_key,
      hasGemini: !!data?.gemini_key,
      hasReplicate: !!data?.replicate_key,
      hasElevenlabs: !!data?.elevenlabs_key,
      textProvider: (data?.text_provider as TextProvider | undefined) ?? "gemini",
    };
  });

const SaveInput = z.object({
  openaiKey: z.string().trim().max(300).optional().nullable(),
  geminiKey: z.string().trim().max(300).optional().nullable(),
  replicateKey: z.string().trim().max(300).optional().nullable(),
  elevenlabsKey: z.string().trim().max(300).optional().nullable(),
  textProvider: z.enum(["openai", "gemini"]).optional(),
});

/**
 * Actualiza sólo los campos que llegan definidos.
 * - `null` limpia la clave.
 * - `undefined` deja el valor actual intacto.
 * - Cadena vacía se interpreta como "no cambiar" para evitar borrados accidentales.
 */
export const saveMyApiKeys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveInput.parse(input))
  .handler(async ({ data, context }) => {
    const patch: {
      user_id: string;
      openai_key?: string | null;
      gemini_key?: string | null;
      replicate_key?: string | null;
      elevenlabs_key?: string | null;
      text_provider?: TextProvider;
    } = { user_id: context.userId };
    if (data.openaiKey !== undefined && data.openaiKey !== "") patch.openai_key = data.openaiKey;
    if (data.geminiKey !== undefined && data.geminiKey !== "") patch.gemini_key = data.geminiKey;
    if (data.replicateKey !== undefined && data.replicateKey !== "") patch.replicate_key = data.replicateKey;
    if (data.elevenlabsKey !== undefined && data.elevenlabsKey !== "") patch.elevenlabs_key = data.elevenlabsKey;
    if (data.textProvider !== undefined) patch.text_provider = data.textProvider;

    const { error } = await context.supabase
      .from("user_api_keys")
      .upsert(patch, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Helper server-only para leer las claves crudas desde otros server functions.
 * NO exportar hacia el bundle cliente: sólo se importa desde handlers.
 */
export async function loadUserKeys(
  supabase: unknown,
  userId: string,
): Promise<UserApiKeys> {
  const client = supabase as {
    from: (t: string) => any;
  };

  // 1) Check profile: is_active + use_platform_ai
  const { data: profile } = await client
    .from("profiles")
    .select("is_active, use_platform_ai")
    .eq("id", userId)
    .maybeSingle();

  if (profile && profile.is_active === false) {
    throw new Error("Tu cuenta está desactivada. Contacta con el administrador.");
  }

  // 2) If user has platform-AI enabled, use admin's keys instead
  if (profile?.use_platform_ai) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: adminRow } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();
    if (adminRow?.user_id) {
      const { data: adminKeys } = await supabaseAdmin
        .from("user_api_keys")
        .select("openai_key, gemini_key, replicate_key, elevenlabs_key, text_provider")
        .eq("user_id", adminRow.user_id)
        .maybeSingle();
      if (adminKeys) {
        return {
          openaiKey: (adminKeys.openai_key as string | null) ?? null,
          geminiKey: (adminKeys.gemini_key as string | null) ?? null,
          replicateKey: (adminKeys.replicate_key as string | null) ?? null,
          elevenlabsKey: (adminKeys.elevenlabs_key as string | null) ?? null,
          textProvider: ((adminKeys.text_provider as TextProvider) ?? "gemini"),
        };
      }
    }
  }

  // 3) Own keys
  const { data } = await client
    .from("user_api_keys")
    .select("openai_key, gemini_key, replicate_key, elevenlabs_key, text_provider")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return EMPTY;
  return {
    openaiKey: (data.openai_key as string | null) ?? null,
    geminiKey: (data.gemini_key as string | null) ?? null,
    replicateKey: (data.replicate_key as string | null) ?? null,
    elevenlabsKey: (data.elevenlabs_key as string | null) ?? null,
    textProvider: ((data.text_provider as TextProvider) ?? "gemini"),
  };
}

