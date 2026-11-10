/**
 * Publicación en LinkedIn con la conexión original de LinkedIn (la misma que
 * usaba Story Weaver Social), sin pasar por Upload-Post. Server-only.
 *
 * - Si este servidor tiene la conexión (vista previa y app publicada en
 *   Lovable), publica directamente.
 * - Si no la tiene (xandralyze.com en tu hosting), reenvía la petición firmada
 *   a la app publicada en Lovable, que es la que tiene la conexión.
 */
import type { SocialMedia } from "./social-shared";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/linkedin";
const DEFAULT_RELAY = "https://iworkpre.lovable.app";
const RELAY_PATH = "/api/public/social/linkedin-relay";
const MAX_SKEW_MS = 5 * 60_000;

export type LinkedInMedia = { bytes: ArrayBuffer; contentType: string; fileName: string; kind: "imagen" | "video" };
export type LinkedInOutcome = { ok: boolean; detail: string };
export type LinkedInRelayBody = { ts: number; text: string; media: SocialMedia[] };

function gatewayKeys() {
  const lovableApiKey = process.env["LOVABLE_API_KEY"];
  const linkedinApiKey = process.env["LINKEDIN_API_KEY"];
  return lovableApiKey && linkedinApiKey ? { lovableApiKey, linkedinApiKey } : null;
}

export function hasLinkedInConnection(): boolean {
  return gatewayKeys() !== null;
}

async function gateway(path: string, init?: RequestInit) {
  const keys = gatewayKeys();
  if (!keys) throw new Error("La conexión de LinkedIn no está disponible en este servidor.");
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${keys.lovableApiKey}`);
  headers.set("X-Connection-Api-Key", keys.linkedinApiKey);
  const res = await fetch(`${GATEWAY_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.text();
    console.error(`LinkedIn gateway error [${res.status}]: ${body}`);
    throw new Error(`LinkedIn respondió ${res.status}: ${body.slice(0, 400)}`);
  }
  return res;
}

async function profileUrn(): Promise<string> {
  const res = await gateway("/v2/userinfo");
  const info = (await res.json()) as { sub?: string };
  if (!info.sub) throw new Error("LinkedIn no devolvió el identificador del perfil.");
  return `urn:li:person:${info.sub}`;
}

/** Sube un archivo a LinkedIn y devuelve el URN del asset. */
async function uploadAsset(urn: string, media: LinkedInMedia): Promise<string> {
  const recipe = media.kind === "video" ? "urn:li:digitalmediaRecipe:feedshare-video" : "urn:li:digitalmediaRecipe:feedshare-image";
  const registerRes = await gateway("/v2/assets?action=registerUpload", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Restli-Protocol-Version": "2.0.0" },
    body: JSON.stringify({
      registerUploadRequest: {
        owner: urn,
        recipes: [recipe],
        serviceRelationships: [{ relationshipType: "OWNER", identifier: "urn:li:userGeneratedContent" }],
      },
    }),
  });
  const registered = (await registerRes.json()) as {
    value?: { asset?: string; uploadMechanism?: Record<string, { uploadUrl?: string; headers?: Record<string, string> }> };
  };
  const asset = registered.value?.asset;
  const mechanism = Object.values(registered.value?.uploadMechanism ?? {})[0];
  if (!asset || !mechanism?.uploadUrl) throw new Error("LinkedIn no devolvió la URL de subida del archivo.");
  // La URL de subida ya viene firmada por LinkedIn: se sube directamente, no por el gateway.
  const headers = new Headers(mechanism.headers ?? {});
  headers.set("Content-Type", media.contentType || "application/octet-stream");
  const up = await fetch(mechanism.uploadUrl, { method: "PUT", headers, body: media.bytes });
  if (!up.ok) {
    const body = await up.text();
    console.error(`LinkedIn upload error [${up.status}]: ${body}`);
    throw new Error(`LinkedIn rechazó el archivo (${up.status}): ${body.slice(0, 200)}`);
  }
  return asset;
}

/** Publica en el perfil de LinkedIn conectado. Las imágenes van juntas; el vídeo, en su propio post. */
export async function publishToLinkedInDirect(text: string, media: LinkedInMedia[]): Promise<LinkedInOutcome> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("El texto del capítulo está vacío.");
  const urn = await profileUrn();
  const errors: string[] = [];
  const ids: string[] = [];

  const createPost = async (category: "NONE" | "IMAGE" | "VIDEO", entries: { status: string; media: string }[]) => {
    const shareContent: Record<string, unknown> = { shareCommentary: { text: trimmed.slice(0, 2900) }, shareMediaCategory: category };
    if (entries.length) shareContent["media"] = entries;
    const res = await gateway("/v2/ugcPosts", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Restli-Protocol-Version": "2.0.0" },
      body: JSON.stringify({
        author: urn,
        lifecycleState: "PUBLISHED",
        specificContent: { "com.linkedin.ugc.ShareContent": shareContent },
        visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
      }),
    });
    const created = (await res.json().catch(() => ({}))) as { id?: string };
    return created.id ?? res.headers.get("x-restli-id") ?? "";
  };

  const images = media.filter((m) => m.kind === "imagen");
  const videos = media.filter((m) => m.kind === "video");
  const imageAssets: string[] = [];
  for (const m of images) {
    try {
      imageAssets.push(await uploadAsset(urn, m));
    } catch (e) {
      errors.push(`imagen ${m.fileName}: ${e instanceof Error ? e.message : "no se pudo subir"}`);
    }
  }
  if (imageAssets.length) ids.push(await createPost("IMAGE", imageAssets.map((a) => ({ status: "READY", media: a }))));
  const video = videos[0];
  if (video) {
    try {
      const asset = await uploadAsset(urn, video);
      ids.push(await createPost("VIDEO", [{ status: "READY", media: asset }]));
      if (videos.length > 1) errors.push("LinkedIn admite un solo vídeo por publicación; se adjuntó el primero");
    } catch (e) {
      errors.push(`vídeo ${video.fileName}: ${e instanceof Error ? e.message : "no se pudo subir"}`);
    }
  }
  // Si ningún archivo se pudo subir, se publica solo el texto.
  if (!ids.length) ids.push(await createPost("NONE", []));

  const links = ids.filter(Boolean).map((id) => `https://www.linkedin.com/feed/update/${id}/`);
  const base = links.length ? links.join(" ") : "Publicado en LinkedIn.";
  return { ok: true, detail: errors.length ? `${base} (aviso: ${errors.join("; ")})` : base };
}

/** Descarga del almacén propio los adjuntos del capítulo. */
export async function loadLinkedInMedia(media: SocialMedia[]): Promise<LinkedInMedia[]> {
  if (!media.length) return [];
  const { externalStorage } = await import("./external-storage.server");
  const out: LinkedInMedia[] = [];
  for (const m of media) {
    if (m.kind !== "imagen" && m.kind !== "video") continue;
    const { data, error } = await externalStorage.from("videos").download(m.path);
    if (error || !data) throw new Error(`No se pudo preparar el archivo «${m.name}» para LinkedIn.`);
    const name = m.name || m.path.split("/").pop() || (m.kind === "video" ? "video.mp4" : "imagen.jpg");
    const type = data.type && data.type !== "application/octet-stream" ? data.type : m.kind === "video" ? "video/mp4" : "image/jpeg";
    out.push({ bytes: await data.arrayBuffer(), contentType: type, fileName: name, kind: m.kind });
  }
  return out;
}

// ---- Firma del reenvío entre tu hosting y la app publicada en Lovable ----

function relaySecret(): string {
  return (process.env["EXTERNAL_API_TOKEN"] ?? "").trim();
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signRelayBody(raw: string): Promise<string> {
  const secret = relaySecret();
  if (!secret) throw new Error("Falta EXTERNAL_API_TOKEN para firmar el envío a LinkedIn.");
  return hmac(secret, raw);
}

/** Verifica firma y antigüedad del reenvío; devuelve el cuerpo o null. */
export async function verifyRelayBody(raw: string, signature: string, now = Date.now()): Promise<LinkedInRelayBody | null> {
  const secret = relaySecret();
  if (!secret || !signature) return null;
  if (!safeEqual(await hmac(secret, raw), signature)) return null;
  let body: LinkedInRelayBody;
  try {
    body = JSON.parse(raw) as LinkedInRelayBody;
  } catch {
    return null;
  }
  if (typeof body.ts !== "number" || Math.abs(now - body.ts) > MAX_SKEW_MS) return null;
  if (typeof body.text !== "string" || !Array.isArray(body.media)) return null;
  const okMedia = body.media.every(
    (m) => m && typeof m.path === "string" && /\/social\//.test(m.path) && !m.path.includes("..") && (m.kind === "imagen" || m.kind === "video"),
  );
  return okMedia ? body : null;
}

/** Publica en LinkedIn desde aquí o, si este servidor no tiene la conexión, a través de la app publicada en Lovable. */
export async function publishLinkedIn(text: string, media: SocialMedia[]): Promise<LinkedInOutcome> {
  try {
    if (hasLinkedInConnection()) return await publishToLinkedInDirect(text, await loadLinkedInMedia(media));
    const base = (process.env["LINKEDIN_RELAY_URL"] ?? DEFAULT_RELAY).replace(/\/+$/, "");
    const raw = JSON.stringify({ ts: Date.now(), text, media } satisfies LinkedInRelayBody);
    const res = await fetch(`${base}${RELAY_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Relay-Signature": await signRelayBody(raw) },
      body: raw,
    });
    const json = (await res.json().catch(() => ({}))) as Partial<LinkedInOutcome> & { error?: string };
    if (!res.ok) return { ok: false, detail: json.error || json.detail || `La conexión de LinkedIn respondió ${res.status}.` };
    return { ok: Boolean(json.ok), detail: json.detail || "Publicado en LinkedIn." };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}
