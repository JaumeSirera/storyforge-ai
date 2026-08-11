import { z } from "zod";

/** Motor de Escenas Inteligentes: momentos relevantes detectados sobre la transcripción. */
export const SceneSchema = z.object({
  title: z.string().describe("Título corto y descriptivo del momento, sin juicios de valor"),
  startSec: z.number().min(0).describe("Segundo de inicio del fragmento"),
  endSec: z.number().min(0).describe("Segundo de fin del fragmento"),
  kind: z.enum([
    "decision",
    "desacuerdo",
    "colaboracion",
    "liderazgo",
    "interrupciones",
    "silencio",
    "cambio_de_tema",
    "aportacion_clave",
  ]),
  relevance: z.number().min(1).max(5),
  why: z.string(),
  observations: z.array(z.string()).min(1),
  speakers: z.array(z.string()).default([]),
});

export const ScenesSchema = z.object({ scenes: z.array(SceneSchema).min(1).max(12) });

export const SCENE_KINDS = [
  "decision",
  "desacuerdo",
  "colaboracion",
  "liderazgo",
  "interrupciones",
  "silencio",
  "cambio_de_tema",
  "aportacion_clave",
] as const;

export const ScenesGenSchema = z.object({
  scenes: z.array(
    z.object({
      title: z.string(),
      startSec: z.number(),
      endSec: z.number(),
      kind: z.string(),
      relevance: z.number(),
      why: z.string(),
      observations: z.array(z.string()),
      speakers: z.array(z.string()),
    }),
  ),
});

export type SessionScene = z.infer<typeof SceneSchema>;
export type SessionScenes = { scenes: SessionScene[]; generatedAt: string | null };

export const SCENE_COLUMNS = "scenes, scenes_generated_at, metrics";

export function mapScenes(row: unknown): SessionScenes {
  const value = row as { scenes?: unknown; scenes_generated_at?: string | null } | null;
  const raw = Array.isArray(value?.scenes) ? (value.scenes as SessionScene[]) : [];
  return { scenes: raw, generatedAt: value?.scenes_generated_at ?? null };
}

type GeneratedScene = z.infer<typeof ScenesGenSchema>["scenes"][number];

export function normalizeScenes(raw: GeneratedScene[], spanSec: number): SessionScene[] {
  return raw
    .map((scene) => {
      const start = Math.max(0, Math.min(Number(scene.startSec) || 0, spanSec));
      const endRaw = Number(scene.endSec) || start + 15;
      const end = Math.max(start + 3, Math.min(endRaw, spanSec || endRaw));
      const kind = (SCENE_KINDS as readonly string[]).includes(scene.kind)
        ? (scene.kind as SessionScene["kind"])
        : "aportacion_clave";

      return {
        title: scene.title || "Momento relevante",
        why: scene.why || "Fragmento seleccionado a partir de la transcripción de la sesión.",
        kind,
        relevance: Math.min(5, Math.max(1, Math.round(Number(scene.relevance) || 3))),
        observations: (scene.observations ?? []).filter(Boolean),
        speakers: (scene.speakers ?? []).filter(Boolean),
        startSec: Math.round(start),
        endSec: Math.round(end),
      } satisfies SessionScene;
    })
    .filter((scene) => scene.endSec > scene.startSec)
    .sort((a, b) => a.startSec - b.startSec)
    .slice(0, 12);
}

type TranscriptSegment = {
  participant_id?: string | null;
  speaker_label?: string | null;
  start_sec?: number | string | null;
  end_sec?: number | string | null;
  text?: string | null;
};

/** Produces reviewable, evidence-based clips when the model returns an empty list. */
export function buildFallbackScenes(
  segments: TranscriptSegment[],
  spanSec: number,
  nameOf: (key: string | null | undefined) => string,
): SessionScene[] {
  if (segments.length === 0) return [];

  const targetCount = Math.min(4, Math.max(1, Math.ceil(segments.length / 8)));
  const bucketSize = Math.max(1, Math.ceil(segments.length / targetCount));

  const scenes: SessionScene[] = [];
  for (let index = 0; index < targetCount; index += 1) {
    const bucket = segments.slice(index * bucketSize, (index + 1) * bucketSize);
    if (bucket.length === 0) continue;
    const first = bucket[0];
    const last = bucket[bucket.length - 1];
    const startSec = Math.max(0, Math.round(Number(first.start_sec) || 0));
    const rawEnd = Math.round(Number(last.end_sec) || startSec + 15);
    const endSec = Math.max(startSec + 3, Math.min(rawEnd, spanSec || rawEnd));
    const speakers = [...new Set(bucket.map((item) => nameOf(item.participant_id ?? item.speaker_label)))];
    const observations = bucket
      .filter((item) => item.text?.trim())
      .slice(0, 3)
      .map((item) => `${nameOf(item.participant_id ?? item.speaker_label)}: “${item.text?.trim()}”`);

    scenes.push({
      title: `Fragmento relevante ${index + 1}`,
      startSec,
      endSec,
      kind: "aportacion_clave",
      relevance: 3,
      why: "Fragmento representativo seleccionado por su posición en la conversación para facilitar la revisión profesional.",
      observations: observations.length > 0 ? observations : ["Intervención registrada en este tramo de la sesión."],
      speakers,
    });
  }
  return scenes;
}