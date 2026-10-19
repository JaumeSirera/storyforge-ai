/**
 * Publicación de capítulos con Upload-Post (upload-post.com). Server-only.
 * Los archivos adjuntos se pasan como enlaces firmados de larga duración.
 */
import { composePost, type SocialChapter, type SocialMedia } from "./social-shared";

type Result = { platform: string; ok: boolean; detail: string };
export type PublishCreds = { key: string | null; profile: string; facebook_page_id?: string };

const API = "https://api.upload-post.com/api";

async function mediaUrls(media: SocialMedia[]): Promise<{ url: string; kind: SocialMedia["kind"] }[]> {
  if (!media.length) return [];
  const { externalStorage } = await import("./external-storage.server");
  const out: { url: string; kind: SocialMedia["kind"] }[] = [];
  for (const m of media) {
    const { data, error } = await externalStorage.from("videos").createSignedUrl(m.path, 7 * 24 * 3600);
    if (error || !data) throw new Error(`No se pudo preparar el archivo «${m.name}» para publicar.`);
    out.push({ url: data.signedUrl, kind: m.kind });
  }
  return out;
}

const TEXT_OK = new Set(["x", "linkedin", "facebook", "threads"]);

type UpProfile = { username?: string; display_name?: string | null };

/**
 * El panel de Upload-Post muestra el «display_name» del perfil, pero la API
 * necesita su «username» interno. Buscamos el perfil real con la clave.
 */
async function resolveProfile(apiKey: string, typed: string): Promise<{ user: string; known: string[] }> {
  try {
    const res = await fetch(`${API}/uploadposts/users`, {
      headers: { Authorization: `Apikey ${apiKey}`, Accept: "application/json" },
    });
    if (!res.ok) return { user: typed, known: [] };
    const json = (await res.json()) as { profiles?: UpProfile[] };
    const list = (json.profiles ?? []).filter((p) => p.username);
    const known = list.map((p) => (p.display_name ? `${p.display_name} (${p.username})` : String(p.username)));
    const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
    const t = norm(typed);
    const hit =
      list.find((p) => p.username === typed) ??
      list.find((p) => norm(p.username) === t) ??
      list.find((p) => norm(p.display_name) === t) ??
      (list.length === 1 ? list[0] : undefined);
    return { user: hit?.username ?? typed, known };
  } catch {
    return { user: typed, known: [] };
  }
}

export async function publishSocial(
  creds: PublishCreds,
  chapter: Pick<SocialChapter, "body" | "links" | "media"> & { title?: string },
  platforms: string[],
): Promise<Result[]> {
  const apiKey = (creds.key ?? "").trim();
  const typedProfile = (creds.profile ?? "").trim();
  if (!apiKey) throw new Error("Falta la clave de Upload-Post. Añádela en la pestaña «Redes».");
  if (!platforms.length) throw new Error("Esta serie no tiene ninguna red activada.");
  const { user: profile, known } = await resolveProfile(apiKey, typedProfile);
  if (!profile) throw new Error("Falta el nombre del perfil de Upload-Post. Añádelo en la pestaña «Redes».");

  const media = await mediaUrls(chapter.media ?? []);
  const video = media.find((m) => m.kind === "video");
  const photos = media.filter((m) => m.kind === "imagen");
  const results: Result[] = [];
  const send: string[] = [];
  for (const p of platforms) {
    if (p === "youtube" && !video) results.push({ platform: p, ok: false, detail: "YouTube necesita un vídeo." });
    else if ((p === "instagram" || p === "tiktok") && !media.length)
      results.push({ platform: p, ok: false, detail: "Necesita al menos una imagen o vídeo." });
    else if (!media.length && !TEXT_OK.has(p))
      results.push({ platform: p, ok: false, detail: "Esta red no admite publicaciones solo de texto." });
    else send.push(p);
  }
  if (!send.length) return results;

  const text = composePost(chapter.body, chapter.links ?? []);
  const form = new FormData();
  form.append("user", profile);
  for (const p of send) form.append("platform[]", p);
  form.append("title", text);
  if (creds.facebook_page_id?.trim() && send.includes("facebook")) form.append("facebook_page_id", creds.facebook_page_id.trim());

  let endpoint = "upload_text";
  if (video) {
    endpoint = "upload";
    form.append("video", video.url);
    form.append("description", text);
    if (send.includes("youtube")) {
      // YouTube admite como máximo 100 caracteres en el título.
      const plain = (chapter.title || chapter.body || "Vídeo").replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
      const yt = Array.from(plain);
      form.append("youtube_title", yt.length > 100 ? yt.slice(0, 99).join("").trimEnd() + "…" : plain);
      form.append("youtube_description", text.slice(0, 5000));
    }
  } else if (photos.length) {
    endpoint = "upload_photos";
    for (const ph of photos) form.append("photos[]", ph.url);
    form.append("description", text);
  }

  const res = await fetch(`${API}/${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Apikey ${apiKey}`, Accept: "application/json" },
    body: form,
  });
  const raw = await res.text();
  type R = { success?: boolean; url?: string; post_url?: string; error?: string; message?: string };
  let json: { success?: boolean; message?: string; error?: string; results?: Record<string, R> } = {};
  try {
    json = JSON.parse(raw);
  } catch {
    json = {};
  }
  const general =
    json.message ?? json.error ?? (raw && !raw.trim().startsWith("<") ? raw.slice(0, 300) : `HTTP ${res.status}`);
  const explain = (msg: string) => {
    if (/not associated with any profile/i.test(msg))
      return known.length
        ? `Upload-Post no encuentra el perfil «${profile}». Perfiles de esta clave: ${known.join(", ")}.`
        : `Upload-Post no encuentra el perfil «${profile}» y esta API Key no tiene ningún perfil. Probablemente la clave es de otra cuenta de Upload-Post o el perfil aún no tiene redes enlazadas: crea una clave nueva en la misma cuenta donde está el perfil.`;
    if (res.status === 401 || res.status === 403)
      return `Upload-Post rechaza la clave o el perfil (${msg}). Revisa la API Key y el nombre del perfil en «Redes».`;
    return msg;
  };
  for (const p of send) {
    const r = json.results?.[p];
    if (r?.success) results.push({ platform: p, ok: true, detail: r.url ?? r.post_url ?? "publicado" });
    else if (res.ok && json.success && !json.results) results.push({ platform: p, ok: true, detail: "enviado" });
    else results.push({ platform: p, ok: false, detail: explain(r?.error ?? r?.message ?? general) });
  }
  if (!res.ok) console.error("Upload-Post", res.status, raw.slice(0, 1000));
  return results;
}

export function summarize(results: Result[]): { status: "publicado" | "error"; result: string } {
  const allOk = results.length > 0 && results.every((r) => r.ok);
  return {
    status: allOk ? "publicado" : "error",
    result: results.map((r) => `${r.platform}: ${r.ok ? "✓" : "✗"} ${r.detail}`).join("\n"),
  };
}
