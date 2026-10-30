/**
 * Publicación de capítulos con Upload-Post (upload-post.com). Server-only.
 * Los archivos adjuntos se envían como archivo dentro de la petición (no como
 * enlace): el cortafuegos del hosting bloquea las descargas automáticas que
 * Upload-Post haría desde nuestro servidor.
 */
import { composePost, type SocialChapter, type SocialMedia } from "./social-shared";
import { uploadResults, type PublishResult, type UploadResponse } from "./social-publish-results";
export { summarize } from "./social-publish-results";

type Result = PublishResult;
export type PublishCreds = { key: string | null; profile: string; facebook_page_id?: string };

const API = "https://api.upload-post.com/api";

type MediaFile = { file: File; kind: SocialMedia["kind"] };

function guessMime(name: string, kind: SocialMedia["kind"], given: string): string {
  if (given && given !== "application/octet-stream") return given;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", m4v: "video/mp4",
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
  };
  return map[ext] ?? (kind === "video" ? "video/mp4" : "image/jpeg");
}

async function mediaFiles(media: SocialMedia[]): Promise<MediaFile[]> {
  if (!media.length) return [];
  const { externalStorage } = await import("./external-storage.server");
  const out: MediaFile[] = [];
  for (const m of media) {
    const { data, error } = await externalStorage.from("videos").download(m.path);
    if (error || !data) throw new Error(`No se pudo preparar el archivo «${m.name}» para publicar.`);
    const name = m.name || m.path.split("/").pop() || (m.kind === "video" ? "video.mp4" : "imagen.jpg");
    const type = guessMime(m.path || name, m.kind, data.type);
    out.push({ file: new File([await data.arrayBuffer()], name, { type }), kind: m.kind });
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

type FbPage = { id?: string; name?: string };

/**
 * Facebook solo publica en páginas. Si no hay ID guardado ni página fijada en
 * Upload-Post, usamos la única página disponible o pedimos elegir una.
 */
async function resolveFacebookPage(apiKey: string, profile: string, typed: string): Promise<{ id?: string; error?: string }> {
  if (typed.trim()) return { id: typed.trim() };
  try {
    const res = await fetch(`${API}/uploadposts/users/facebook-page?profile_username=${encodeURIComponent(profile)}`, {
      headers: { Authorization: `Apikey ${apiKey}`, Accept: "application/json" },
    });
    if (!res.ok) return {}; // No bloqueamos: Upload-Post usará su comportamiento por defecto.
    const json = (await res.json()) as { pages?: FbPage[]; selected_page_id?: string | null };
    if (json.selected_page_id) return {};
    const pages = (json.pages ?? []).filter((p) => p.id);
    if (pages.length === 1) return { id: pages[0]?.id };
    if (!pages.length)
      return { error: "La cuenta de Facebook enlazada en Upload-Post no gestiona ninguna página. Facebook solo permite publicar en páginas, no en perfiles personales." };
    return { error: `Hay varias páginas de Facebook. Copia el ID de la que quieras en «Redes» → «ID de página de Facebook»: ${pages.map((p) => `${p.name ?? "Página"} (${p.id})`).join(", ")}.` };
  } catch {
    return {};
  }
}

export async function publishSocial(
  inputCreds: PublishCreds,
  chapter: Pick<SocialChapter, "body" | "links" | "media"> & { title?: string },
  platforms: string[],
): Promise<Result[]> {
  let creds = inputCreds;
  const apiKey = (creds.key ?? "").trim();

  const typedProfile = (creds.profile ?? "").trim();
  if (!apiKey) throw new Error("Falta la clave de Upload-Post. Añádela en la pestaña «Redes».");
  if (!platforms.length) throw new Error("Esta serie no tiene ninguna red activada.");
  const { user: profile, known } = await resolveProfile(apiKey, typedProfile);
  if (!profile) throw new Error("Falta el nombre del perfil de Upload-Post. Añádelo en la pestaña «Redes».");

  const media = await mediaFiles(chapter.media ?? []);
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
  if (send.includes("facebook")) {
    const page = await resolveFacebookPage(apiKey, profile, creds.facebook_page_id ?? "");
    if (page.error) {
      results.push({ platform: "facebook", ok: false, detail: page.error });
      send.splice(send.indexOf("facebook"), 1);
    } else if (page.id) creds = { ...creds, facebook_page_id: page.id };
  }
  if (!send.length) return results;

  const text = composePost(chapter.body, chapter.links ?? []);
  const form = new FormData();
  const requestId = crypto.randomUUID();
  form.append("request_id", requestId);
  form.append("async_upload", "true");
  form.append("user", profile);
  for (const p of send) form.append("platform[]", p);
  form.append("title", text);
  if (creds.facebook_page_id?.trim() && send.includes("facebook")) form.append("facebook_page_id", creds.facebook_page_id.trim());

  let endpoint = "upload_text";
  if (video) {
    endpoint = "upload";
    form.append("video", video.file, video.file.name);
    form.append("description", text);
    // Upload-Post sube a Facebook como Reel (solo vertical 9:16 y ≤ 90 s) si no
    // se indica; los vídeos del estudio son horizontales, así que va como vídeo normal.
    if (send.includes("facebook")) form.append("facebook_media_type", "VIDEO");

    if (send.includes("youtube")) {
      // YouTube admite como máximo 100 caracteres en el título.
      const plain = (chapter.title || chapter.body || "Vídeo").replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
      const yt = Array.from(plain);
      form.append("youtube_title", yt.length > 100 ? yt.slice(0, 99).join("").trimEnd() + "…" : plain);
      form.append("youtube_description", text.slice(0, 5000));
    }
  } else if (photos.length) {
    endpoint = "upload_photos";
    for (const ph of photos) form.append("photos[]", ph.file, ph.file.name);
    form.append("description", text);
  }

  let res: Response;
  try {
    res = await fetch(`${API}/${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Apikey ${apiKey}`, Accept: "application/json" },
    body: form,
    });
  } catch {
    // A lost response does not mean that the provider rejected the upload.
    return [...results, ...send.map((platform) => ({ platform, ok: false, pending: true, requestId, detail: "Respuesta interrumpida; consulta el estado antes de volver a enviar." }))];
  }
  const raw = await res.text();
  let json: UploadResponse = {};
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
  results.push(...uploadResults({ ...json, message: json.message || general }, send, res.ok, res.ok ? requestId : undefined)
    .map((r) => ({ ...r, detail: r.ok || r.pending ? r.detail : explain(r.detail) })));
  if (!res.ok) console.error("Upload-Post HTTP", res.status);
  return results;
}

/** Read an existing job only; never submit another publication. */
export async function checkSocialPublication(creds: PublishCreds, previous: Result[]): Promise<Result[]> {
  const key = creds.key?.trim();
  if (!key) throw new Error("Falta la clave de Upload-Post.");
  const ids = [...new Set(previous.filter((r) => r.pending && r.requestId).map((r) => r.requestId))];
  const updated = [...previous];
  for (const id of ids) {
    if (!id) continue;
    const platforms = previous.filter((r) => r.pending && r.requestId === id).map((r) => r.platform);
    try {
      const res = await fetch(`${API}/uploadposts/status?request_id=${encodeURIComponent(id)}`, {
        headers: { Authorization: `Apikey ${key}`, Accept: "application/json" },
      });
      // A not-yet-visible job or a transient outage must not invite a duplicate upload.
      if (!res.ok) continue;
      const parsed = uploadResults(await res.json() as UploadResponse, platforms, true, id);
      for (const r of parsed) {
        const i = updated.findIndex((old) => old.platform === r.platform && old.requestId === id);
        if (i >= 0) updated[i] = r;
      }
    } catch { /* Retain the previous unconfirmed state and retry later. */ }
  }
  return updated;
}
