/**
 * Resolución de servidores ICE (STUN/TURN) en el servidor.
 *
 * Sin un TURN operativo, dos dispositivos en redes distintas (móvil 4G ↔ PC)
 * no pueden conectar: los candidatos quedan en "new" y el navegador reporta
 * errores ICE 701. Los relés públicos gratuitos (openrelay.metered.ca) están
 * fuera de servicio, así que priorizamos credenciales propias:
 *   1. Cloudflare Realtime TURN (CLOUDFLARE_TURN_KEY_ID + CLOUDFLARE_TURN_API_TOKEN)
 *   2. TURN genérico (TURN_URLS + TURN_USERNAME + TURN_CREDENTIAL)
 *   3. Solo STUN (funciona únicamente en la misma red / NAT permisivo)
 */

export type IceConfig = {
  iceServers: RTCIceServer[];
  hasTurn: boolean;
  provider: "cloudflare" | "custom" | "stun-only";
};

const STUN: RTCIceServer = {
  urls: [
    "stun:stun.l.google.com:19302",
    "stun:stun1.l.google.com:19302",
    "stun:stun.cloudflare.com:3478",
  ],
};

type StoredTurn = {
  keyId?: string | null;
  token?: string | null;
  urls?: string | null;
  username?: string | null;
  credential?: string | null;
};

/** Lee la configuración TURN guardada en Ajustes (usuario actual, si no el admin). */
async function loadStoredTurn(userId?: string): Promise<StoredTurn> {
  try {
    const { xAdminDb } = await import("./assessments-repo.server");
    const supabaseAdmin = await xAdminDb();
    const cols = "turn_key_id, turn_api_token, turn_urls, turn_username, turn_credential";
    const pick = (row: Record<string, unknown> | null | undefined): StoredTurn => ({
      keyId: (row?.turn_key_id as string | null) ?? null,
      token: (row?.turn_api_token as string | null) ?? null,
      urls: (row?.turn_urls as string | null) ?? null,
      username: (row?.turn_username as string | null) ?? null,
      credential: (row?.turn_credential as string | null) ?? null,
    });

    if (userId) {
      const { data } = await supabaseAdmin
        .from("user_api_keys")
        .select(cols)
        .eq("user_id", userId)
        .maybeSingle();
      const own = pick(data as Record<string, unknown> | null);
      if ((own.keyId && own.token) || (own.urls && own.username && own.credential)) return own;
    }

    // Fallback: credenciales del administrador (las comparten los invitados).
    const { data: adminRow } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();
    if (!adminRow?.user_id) return {};
    const { data } = await supabaseAdmin
      .from("user_api_keys")
      .select(cols)
      .eq("user_id", adminRow.user_id as string)
      .maybeSingle();
    return pick(data as Record<string, unknown> | null);
  } catch {
    return {};
  }
}

async function cloudflareTurn(stored: StoredTurn): Promise<RTCIceServer[] | null> {
  const keyId = stored.keyId || process.env["CLOUDFLARE_TURN_KEY_ID"];
  const token = stored.token || process.env["CLOUDFLARE_TURN_API_TOKEN"];
  if (!keyId || !token) return null;
  try {
    const res = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ttl: 3600 }),
      },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { iceServers?: RTCIceServer | RTCIceServer[] };
    const servers = json.iceServers;
    if (!servers) return null;
    return Array.isArray(servers) ? servers : [servers];
  } catch {
    return null;
  }
}

function customTurn(stored: StoredTurn): RTCIceServer[] | null {
  const urls = stored.urls || process.env["TURN_URLS"];
  const username = stored.username || process.env["TURN_USERNAME"];
  const credential = stored.credential || process.env["TURN_CREDENTIAL"];
  if (!urls || !username || !credential) return null;
  const list = urls
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  if (!list.length) return null;
  return [{ urls: list, username, credential }];
}

export async function resolveIceConfig(userId?: string): Promise<IceConfig> {
  const stored = await loadStoredTurn(userId);
  const cf = await cloudflareTurn(stored);
  if (cf?.length) {
    return { iceServers: [STUN, ...cf], hasTurn: true, provider: "cloudflare" };
  }
  const custom = customTurn(stored);
  if (custom?.length) {
    return { iceServers: [STUN, ...custom], hasTurn: true, provider: "custom" };
  }
  return { iceServers: [STUN], hasTurn: false, provider: "stun-only" };
}
