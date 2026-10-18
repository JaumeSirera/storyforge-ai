import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAnyAuth } from "@/lib/require-auth";
import {
  SOCIAL_NETWORK_IDS,
  type SocialQueueItem,
  type SocialStoryFull,
  type SocialStorySummary,
} from "./social-shared";

type Ctx = { accessToken?: string; authMode?: "cloud" | "own"; supabase?: unknown; userId?: string };

/** Llamada a la API propia; la API comprueba que eres administrador. */
async function api<T>(
  context: Ctx,
  path: string,
  method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
  body?: unknown,
) {
  if (context.authMode !== "own") throw new Error("Esta sección requiere una cuenta de Xandralyze.");
  const { externalRequest } = await import("./external-data.server");
  return externalRequest<T>({ accessToken: String(context.accessToken ?? ""), method, path, body });
}

const Link = z.object({ label: z.string().max(200).default(""), url: z.string().trim().max(1000) });
const Media = z.object({ path: z.string().min(3).max(500), kind: z.enum(["imagen", "video"]), name: z.string().max(300) });
const Networks = z.array(z.enum(SOCIAL_NETWORK_IDS)).max(7);
const Id = z.string().uuid();

type SocialSettings = { has_key: boolean; profile: string; facebook_page_id: string };

export const getSocialSettings = createServerFn({ method: "GET" })
  .middleware([requireAnyAuth])
  .handler(async ({ context }) => api<SocialSettings>(context, "/social/settings"));

export const saveSocialSettings = createServerFn({ method: "POST" })
  .middleware([requireAnyAuth])
  .inputValidator(
    z.object({
      key: z.string().trim().max(500).optional(),
      profile: z.string().trim().max(200).optional(),
      facebookPageId: z.string().trim().max(100).optional(),
    }),
  )
  .handler(async ({ data, context }) =>
    api<SocialSettings>(context, "/social/settings", "POST", {
      ...(data.key !== undefined ? { key: data.key } : {}),
      ...(data.profile !== undefined ? { profile: data.profile } : {}),
      ...(data.facebookPageId !== undefined ? { facebook_page_id: data.facebookPageId } : {}),
    }),
  );

export const listSocialStories = createServerFn({ method: "GET" })
  .middleware([requireAnyAuth])
  .handler(async ({ context }) => api<SocialStorySummary[]>(context, "/social/stories"));

export const getSocialStory = createServerFn({ method: "GET" })
  .middleware([requireAnyAuth])
  .inputValidator(z.object({ id: Id }))
  .handler(async ({ data, context }) => api<SocialStoryFull>(context, `/social/stories/${data.id}`));

export const listSocialQueue = createServerFn({ method: "GET" })
  .middleware([requireAnyAuth])
  .handler(async ({ context }) => api<SocialQueueItem[]>(context, "/social/queue"));

const SYSTEM_PROMPT = `Eres un editor experto en contenido para redes sociales.
Recibes material de origen y debes DIVIDIRLO y REESCRIBIRLO en capítulos publicables, sin añadir información nueva.
Reglas de fidelidad:
- Usa ÚNICAMENTE hechos, datos, nombres, fechas y cifras que aparezcan en el material.
- PROHIBIDO inventar, suponer o rellenar huecos. Si el material no da para más capítulos, devuelve menos.
- Reparte el material en orden, de principio a fin y sin repetir.
Formato:
- Escribe en español. Cada capítulo: 400-700 caracteres, tono cercano, se entiende solo y mantiene el hilo.
- El gancho final se apoya en lo que realmente viene después.
- Incluye 2-4 hashtags sacados de los temas del material.`;

const str = z.preprocess((v) => (v == null ? "" : String(v)), z.string());
const ChaptersSchema = z.object({
  titulo_serie: str.default(""),
  capitulos: z.array(z.object({ titulo: str.default(""), cuerpo: str.default("") }).passthrough()),
});

/** Extrae el JSON de la respuesta de la IA, aunque venga con texto o ```json alrededor. */
export function parseChapters(text: string): z.infer<typeof ChaptersSchema> {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("La IA no devolvió capítulos en el formato esperado.");
  let raw: any = JSON.parse(cleaned.slice(start, end + 1));
  // Acepta nombres alternativos que a veces usan los modelos.
  if (!raw.capitulos) raw.capitulos = raw.chapters ?? raw.capítulos ?? [];
  if (!raw.titulo_serie) raw.titulo_serie = raw.title ?? raw.titulo ?? "";
  raw.capitulos = (raw.capitulos as any[]).map((c) => ({
    titulo: c?.titulo ?? c?.title ?? "",
    cuerpo: c?.cuerpo ?? c?.body ?? c?.texto ?? c?.contenido ?? "",
  }));
  return ChaptersSchema.parse(raw);
}

/** Genera una serie con la IA del usuario y la guarda. */
export const generateSocialStory = createServerFn({ method: "POST" })
  .middleware([requireAnyAuth])
  .inputValidator(
    z.object({
      sourceText: z.string().trim().min(80, "El material debe tener al menos 80 caracteres").max(200000),
      chapterCount: z.number().int().min(1).max(30),
      title: z.string().trim().max(300).default(""),
      tone: z.string().trim().max(200).default(""),
      networks: Networks.default([]),
      everyDays: z.number().int().min(1).max(90).default(7),
    }),
  )
  .handler(async ({ data, context }) => {
    // Comprobación de admin antes de gastar IA.
    await api(context, "/social/settings");
    const { generateText } = await import("ai");
    const { runWithTextModelFallback } = await import("./ai-gateway.server");
    const { loadUserKeys } = await import("./user-keys.functions");
    const { xdb } = await import("./assessments-repo.server");
    const keys = await loadUserKeys(xdb(context as never), String(context.userId));

    const prompt = [
      data.title ? `Título propuesto: ${data.title}` : "",
      data.tone ? `Tono deseado: ${data.tone}` : "",
      `Número de capítulos deseado: ${data.chapterCount} (usa menos si el material no da para más).`,
      "Trabaja SOLO con este material:",
      "--- INICIO ---",
      data.sourceText.slice(0, 24000),
      "--- FIN ---",
      "Responde ÚNICAMENTE con un objeto JSON válido, sin texto antes ni después, con esta forma exacta:",
      '{"titulo_serie": "texto", "capitulos": [{"titulo": "texto", "cuerpo": "texto"}]}',
    ]
      .filter(Boolean)
      .join("\n");

    const { value } = await runWithTextModelFallback(
      keys,
      undefined,
      async ({ model }) => {
        const r = await generateText({ model, system: SYSTEM_PROMPT, prompt });
        return parseChapters(r.text);
      },
      { label: "social-story" },
    );

    const chapters = value.capitulos
      .map((c, i) => ({ title: c.titulo.trim() || `Capítulo ${i + 1}`, body: c.cuerpo.trim() }))
      .filter((c) => c.body.length > 0);
    if (!chapters.length) throw new Error("La IA no devolvió capítulos. Prueba con más material.");

    return api<SocialStoryFull>(context, "/social/stories", "POST", {
      title: (data.title || value.titulo_serie || "Nueva serie").trim(),
      source_text: data.sourceText,
      networks: data.networks,
      every_days: data.everyDays,
      chapters,
    });
  });

export const updateSocialStory = createServerFn({ method: "POST" })
  .middleware([requireAnyAuth])
  .inputValidator(
    z.object({
      id: Id,
      title: z.string().trim().min(1).max(300).optional(),
      networks: Networks.optional(),
      everyDays: z.number().int().min(1).max(90).optional(),
    }),
  )
  .handler(async ({ data, context }) =>
    api<SocialStoryFull>(context, `/social/stories/${data.id}`, "PATCH", {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.networks !== undefined ? { networks: data.networks } : {}),
      ...(data.everyDays !== undefined ? { every_days: data.everyDays } : {}),
    }),
  );

export const deleteSocialStory = createServerFn({ method: "POST" })
  .middleware([requireAnyAuth])
  .inputValidator(z.object({ id: Id }))
  .handler(async ({ data, context }) => api<{ deleted: boolean }>(context, `/social/stories/${data.id}`, "DELETE"));

export const addSocialChapter = createServerFn({ method: "POST" })
  .middleware([requireAnyAuth])
  .inputValidator(z.object({ storyId: Id }))
  .handler(async ({ data, context }) =>
    api<SocialStoryFull>(context, `/social/stories/${data.storyId}/chapters`, "POST", {
      title: "Nuevo capítulo",
      body: "",
    }),
  );

export const updateSocialChapter = createServerFn({ method: "POST" })
  .middleware([requireAnyAuth])
  .inputValidator(
    z.object({
      id: Id,
      title: z.string().max(300).optional(),
      body: z.string().max(20000).optional(),
      links: z.array(Link).max(10).optional(),
      media: z.array(Media).max(10).optional(),
      scheduledAt: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    if (data.media?.some((m) => !m.path.startsWith(`${context.userId}/`))) throw new Error("Archivo no válido");
    return api<SocialStoryFull>(context, `/social/chapters/${data.id}`, "PATCH", {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.body !== undefined ? { body: data.body } : {}),
      ...(data.links !== undefined ? { links: data.links } : {}),
      ...(data.media !== undefined ? { media: data.media } : {}),
      ...(data.scheduledAt !== undefined ? { scheduled_at: data.scheduledAt } : {}),
    });
  });

export const deleteSocialChapter = createServerFn({ method: "POST" })
  .middleware([requireAnyAuth])
  .inputValidator(z.object({ id: Id }))
  .handler(async ({ data, context }) => api<SocialStoryFull>(context, `/social/chapters/${data.id}`, "DELETE"));

/** Programa todos los capítulos no publicados desde una fecha con la frecuencia de la serie. */
export const scheduleSocialStory = createServerFn({ method: "POST" })
  .middleware([requireAnyAuth])
  .inputValidator(z.object({ id: Id, startAt: z.string().min(10), everyDays: z.number().int().min(1).max(90) }))
  .handler(async ({ data, context }) => {
    const { buildSchedule } = await import("./social-shared");
    await api(context, `/social/stories/${data.id}`, "PATCH", { every_days: data.everyDays });
    const full = await api<SocialStoryFull>(context, `/social/stories/${data.id}`);
    const pending = full.chapters.filter((c) => c.status !== "publicado");
    const dates = buildSchedule(pending.length, data.startAt, data.everyDays);
    let last = full;
    for (let i = 0; i < pending.length; i++) {
      last = await api<SocialStoryFull>(context, `/social/chapters/${pending[i]!.id}`, "PATCH", {
        scheduled_at: dates[i],
        status: "programado",
      });
    }
    return last;
  });

/** Publica ya un capítulo con Ayrshare en las redes activas de su serie. */
export const publishSocialChapterNow = createServerFn({ method: "POST" })
  .middleware([requireAnyAuth])
  .inputValidator(z.object({ storyId: Id, chapterId: Id }))
  .handler(async ({ data, context }) => {
    const full = await api<SocialStoryFull>(context, `/social/stories/${data.storyId}`);
    const chapter = full.chapters.find((c) => c.id === data.chapterId);
    if (!chapter) throw new Error("Capítulo no encontrado");
    const creds = await api<{ key: string | null; profile: string; facebook_page_id?: string }>(context, "/social/settings/key");
    const { publishSocial, summarize } = await import("./social-publish.server");
    const results = await publishSocial(creds, chapter, full.story.networks);
    const s = summarize(results);
    const updated = await api<SocialStoryFull>(context, `/social/chapters/${chapter.id}`, "PATCH", s);
    return { story: updated, ...s };
  });

/** Enlace temporal para ver un archivo adjunto. */
export const socialMediaUrl = createServerFn({ method: "POST" })
  .middleware([requireAnyAuth])
  .inputValidator(z.object({ path: z.string().min(3).max(500) }))
  .handler(async ({ data, context }) => {
    if (!data.path.startsWith(`${context.userId}/`)) throw new Error("Archivo no válido");
    const { externalStorage } = await import("./external-storage.server");
    const { data: signed } = await externalStorage.from("videos").createSignedUrl(data.path, 3600);
    const url = signed?.signedUrl ?? "";
    const i = url.indexOf("/api/v1/file/");
    return { url: i >= 0 ? `/api/file/${url.slice(i + 13)}` : url };
  });
