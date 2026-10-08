import { createServerFn } from "@tanstack/react-start";
import { requireAnyAuth } from "@/lib/require-auth";
import { z } from "zod";
import { AI_MODEL_IDS } from "./ai-models";

export type TextProvider = "openai" | "gemini" | "lovable";

export interface UserApiKeys {
  openaiKey: string | null;
  geminiKey: string | null;
  replicateKey: string | null;
  elevenlabsKey: string | null;
  lovableKey: string | null;
  textProvider: TextProvider;
}

const EMPTY: UserApiKeys = {
  openaiKey: null,
  geminiKey: null,
  replicateKey: null,
  elevenlabsKey: null,
  lovableKey: null,
  textProvider: "gemini",
};

/** Cada usuario paga su propia IA: no hay claves de plataforma de respaldo.
 *  Si falta la clave necesaria, se lanza un error claro para que la configure. */
function requireOwnKeys(keys: UserApiKeys): UserApiKeys {
  // Cada función comprueba la clave que necesita (texto: OpenAI/Gemini;
  // vídeo/imagen: Replicate; voz: ElevenLabs) y avisa si falta.
  return keys;
}

/** Devuelve una máscara "sk-…xxxx" para no exponer la clave completa al cliente. */
function maskKey(k: string | null): string | null {
  if (!k) return null;
  if (k.length <= 8) return "••••";
  return `${k.slice(0, 4)}…${k.slice(-4)}`;
}

export const getMyApiKeys = createServerFn({ method: "GET" })
  .middleware([requireAnyAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_api_keys")
      .select("openai_key, gemini_key, replicate_key, elevenlabs_key, text_provider, preferred_model")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);

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
      preferredModel: (data?.preferred_model as string | null) ?? null,
    };
  });

const SaveInput = z.object({
  openaiKey: z.string().trim().max(300).optional().nullable(),
  geminiKey: z.string().trim().max(300).optional().nullable(),
  replicateKey: z.string().trim().max(300).optional().nullable(),
  elevenlabsKey: z.string().trim().max(300).optional().nullable(),
  textProvider: z.enum(["openai", "gemini"]).optional(),
  preferredModel: z.enum(AI_MODEL_IDS).optional(),
});

/**
 * Actualiza sólo los campos que llegan definidos.
 * - `null` limpia la clave.
 * - `undefined` deja el valor actual intacto.
 * - Cadena vacía se interpreta como "no cambiar" para evitar borrados accidentales.
 */
export const saveMyApiKeys = createServerFn({ method: "POST" })
  .middleware([requireAnyAuth])
  .inputValidator((input: unknown) => SaveInput.parse(input))
  .handler(async ({ data, context }) => {
    const patch: {
      user_id: string;
      openai_key?: string | null;
      gemini_key?: string | null;
      replicate_key?: string | null;
      elevenlabs_key?: string | null;
      text_provider?: TextProvider;
      preferred_model?: string;
    } = { user_id: context.userId };
    if (data.openaiKey !== undefined && data.openaiKey !== "") patch.openai_key = data.openaiKey;
    if (data.geminiKey !== undefined && data.geminiKey !== "") patch.gemini_key = data.geminiKey;
    if (data.replicateKey !== undefined && data.replicateKey !== "") patch.replicate_key = data.replicateKey;
    if (data.elevenlabsKey !== undefined && data.elevenlabsKey !== "") patch.elevenlabs_key = data.elevenlabsKey;
    if (data.textProvider !== undefined) patch.text_provider = data.textProvider;
    if (data.preferredModel !== undefined) patch.preferred_model = data.preferredModel;

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

  // Cada usuario usa exclusivamente sus propias claves (guardadas en la API
  // externa vía el cliente enrutado del middleware). Sin claves => error claro.
  const { data } = await client
    .from("user_api_keys")
    .select("openai_key, gemini_key, replicate_key, elevenlabs_key, text_provider")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return requireOwnKeys(EMPTY);
  return requireOwnKeys({
    openaiKey: (data.openai_key as string | null) ?? null,
    geminiKey: (data.gemini_key as string | null) ?? null,
    replicateKey: (data.replicate_key as string | null) ?? null,
    elevenlabsKey: (data.elevenlabs_key as string | null) ?? null,
    lovableKey: null,
    textProvider: ((data.text_provider as TextProvider) ?? "gemini"),
  });
}

