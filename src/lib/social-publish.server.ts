/**
 * Publicación de capítulos con Ayrshare. Server-only.
 * Los archivos adjuntos se pasan a Ayrshare como enlaces firmados de larga
 * duración del almacén propio.
 */
import { composePost, type SocialChapter, type SocialMedia } from "./social-shared";

type Result = { platform: string; ok: boolean; detail: string };

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

export async function publishWithAyrshare(
  apiKey: string,
  chapter: Pick<SocialChapter, "body" | "links" | "media">,
  platforms: string[],
): Promise<Result[]> {
  if (!apiKey) throw new Error("Falta la clave de Ayrshare. Añádela en la pestaña «Redes».");
  if (!platforms.length) throw new Error("Esta serie no tiene ninguna red activada.");

  const media = await mediaUrls(chapter.media ?? []);
  const results: Result[] = [];
  const send: string[] = [];
  for (const p of platforms) {
    if ((p === "instagram" || p === "youtube") && media.length === 0) {
      results.push({ platform: p, ok: false, detail: "Necesita al menos una imagen o vídeo." });
    } else if (p === "tiktok" && media.length === 0) {
      results.push({ platform: p, ok: false, detail: "TikTok necesita un vídeo o al menos una imagen." });
    } else send.push(p);
  }
  if (!send.length) return results;

  const ordered = [...media].sort((a, b) => (a.kind === "video" ? -1 : 0) - (b.kind === "video" ? -1 : 0));
  const body: Record<string, unknown> = { post: composePost(chapter.body, chapter.links ?? []), platforms: send };
  if (ordered.length) {
    body["mediaUrls"] = ordered.map((m) => m.url);
    if (ordered.some((m) => m.kind === "video")) body["isVideo"] = true;
  }

  const res = await fetch("https://api.ayrshare.com/api/post", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as {
    message?: string;
    postIds?: { platform: string; id?: string; status?: string; postUrl?: string }[];
    errors?: { platform?: string; message?: string }[];
  };
  for (const p of send) {
    const ok = json.postIds?.find((x) => x.platform === p && x.status !== "error");
    const err = json.errors?.find((x) => x.platform === p);
    results.push(
      ok
        ? { platform: p, ok: true, detail: ok.postUrl ?? ok.id ?? "publicado" }
        : { platform: p, ok: false, detail: err?.message ?? json.message ?? `HTTP ${res.status}` },
    );
  }
  return results;
}

export function summarize(results: Result[]): { status: "publicado" | "error"; result: string } {
  const allOk = results.length > 0 && results.every((r) => r.ok);
  return {
    status: allOk ? "publicado" : "error",
    result: results.map((r) => `${r.platform}: ${r.ok ? "✓" : "✗"} ${r.detail}`).join("\n"),
  };
}
