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

async function cloudflareTurn(): Promise<RTCIceServer[] | null> {
  const keyId = process.env["CLOUDFLARE_TURN_KEY_ID"];
  const token = process.env["CLOUDFLARE_TURN_API_TOKEN"];
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

function customTurn(): RTCIceServer[] | null {
  const urls = process.env["TURN_URLS"];
  const username = process.env["TURN_USERNAME"];
  const credential = process.env["TURN_CREDENTIAL"];
  if (!urls || !username || !credential) return null;
  const list = urls
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  if (!list.length) return null;
  return [{ urls: list, username, credential }];
}

export async function resolveIceConfig(): Promise<IceConfig> {
  const cf = await cloudflareTurn();
  if (cf?.length) {
    return { iceServers: [STUN, ...cf], hasTurn: true, provider: "cloudflare" };
  }
  const custom = customTurn();
  if (custom?.length) {
    return { iceServers: [STUN, ...custom], hasTurn: true, provider: "custom" };
  }
  return { iceServers: [STUN], hasTurn: false, provider: "stun-only" };
}
