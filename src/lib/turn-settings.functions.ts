import { createServerFn } from "@tanstack/react-start";
import { requireAnyAuth } from "@/lib/require-auth";
import { z } from "zod";

function mask(v: string | null): string | null {
  if (!v) return null;
  if (v.length <= 8) return "••••";
  return `${v.slice(0, 4)}…${v.slice(-4)}`;
}

export const getMyTurnSettings = createServerFn({ method: "GET" })
  .middleware([requireAnyAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_api_keys")
      .select("turn_key_id, turn_api_token, turn_urls, turn_username, turn_credential")
      .eq("user_id", context.userId)
      .maybeSingle();

    return {
      turnKeyId: (data?.turn_key_id as string | null) ?? null,
      turnApiTokenMasked: mask((data?.turn_api_token as string | null) ?? null),
      hasTurnApiToken: !!data?.turn_api_token,
      turnUrls: (data?.turn_urls as string | null) ?? null,
      turnUsername: (data?.turn_username as string | null) ?? null,
      hasTurnCredential: !!data?.turn_credential,
    };
  });

const SaveTurn = z.object({
  turnKeyId: z.string().trim().max(200).optional().nullable(),
  turnApiToken: z.string().trim().max(500).optional().nullable(),
  turnUrls: z.string().trim().max(1000).optional().nullable(),
  turnUsername: z.string().trim().max(200).optional().nullable(),
  turnCredential: z.string().trim().max(500).optional().nullable(),
});

export const saveMyTurnSettings = createServerFn({ method: "POST" })
  .middleware([requireAnyAuth])
  .inputValidator((input: unknown) => SaveTurn.parse(input))
  .handler(async ({ data, context }) => {
    const patch: {
      user_id: string;
      turn_key_id?: string | null;
      turn_api_token?: string | null;
      turn_urls?: string | null;
      turn_username?: string | null;
      turn_credential?: string | null;
    } = { user_id: context.userId };
    // "" = no cambiar, null = borrar
    if (data.turnKeyId !== undefined && data.turnKeyId !== "") patch.turn_key_id = data.turnKeyId;
    if (data.turnKeyId === null) patch.turn_key_id = null;
    if (data.turnApiToken !== undefined && data.turnApiToken !== "")
      patch.turn_api_token = data.turnApiToken;
    if (data.turnApiToken === null) patch.turn_api_token = null;
    if (data.turnUrls !== undefined && data.turnUrls !== "") patch.turn_urls = data.turnUrls;
    if (data.turnUrls === null) patch.turn_urls = null;
    if (data.turnUsername !== undefined && data.turnUsername !== "")
      patch.turn_username = data.turnUsername;
    if (data.turnUsername === null) patch.turn_username = null;
    if (data.turnCredential !== undefined && data.turnCredential !== "")
      patch.turn_credential = data.turnCredential;
    if (data.turnCredential === null) patch.turn_credential = null;

    const { error } = await context.supabase
      .from("user_api_keys")
      .upsert(patch, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Comprueba que las credenciales de Cloudflare TURN funcionan. */
export const testMyTurnSettings = createServerFn({ method: "POST" })
  .middleware([requireAnyAuth])
  .handler(async ({ context }) => {
    const { resolveIceConfig } = await import("./ice.server");
    const cfg = await resolveIceConfig(context.userId, context.supabase);
    return {
      provider: cfg.provider,
      hasTurn: cfg.hasTurn,
      error: cfg.error ?? null,
      urls: cfg.iceServers.flatMap((s) =>
        Array.isArray(s.urls) ? s.urls : [s.urls],
      ),
    };
  });
