import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output } from "ai";
import { requireAnyAuth } from "@/lib/require-auth";
import { runWithTextModelFallback } from "./ai-gateway.server";
import { loadUserKeys } from "./user-keys.functions";
import { formatSec, type SessionMetrics } from "./analyze-metrics";
import type { SessionScene } from "./scenes.functions";
import { xdb, xAdminDb } from "./assessments-repo.server";

/** Comparativa de escenas entre dos sesiones: patrones similares con evidencia temporal en ambas. */
export const ScenesComparisonSchema = z.object({
  headline: z.string().describe("Titular de una frase con el patrón compartido más relevante"),
  summary: z.string().describe("Resumen de 3-5 frases, solo hechos observables en ambas sesiones"),
  patterns: z
    .array(
      z.object({
        pattern: z.string().describe("Patrón de comportamiento observado en las dos sesiones"),
        kind: z.string().describe("Tipo de momento asociado (decisión, desacuerdo, silencio, ...)"),
        similarity: z.number().min(1).max(5).describe("Grado de similitud observada (1 baja, 5 alta)"),
        sessionAEvidence: z
          .array(
            z.object({
              sceneTitle: z.string(),
              startSec: z.number().min(0),
              endSec: z.number().min(0),
              observation: z.string().describe("Hecho observable citado con tiempos o frases"),
            }),
          )
          .min(1),
        sessionBEvidence: z
          .array(
            z.object({
              sceneTitle: z.string(),
              startSec: z.number().min(0),
              endSec: z.number().min(0),
              observation: z.string().describe("Hecho observable citado con tiempos o frases"),
            }),
          )
          .min(1),
      }),
    )
    .min(1)
    .max(10),
  differences: z
    .array(
      z.object({
        aspect: z.string().describe("Aspecto observable que difiere entre sesiones"),
        sessionA: z.string(),
        sessionB: z.string(),
      }),
    )
    .default([]),
  recommendations: z.array(z.string()).min(1).describe("Siguientes pasos para el profesional"),
});

export type ScenesComparison = z.infer<typeof ScenesComparisonSchema> & {
  generatedAt: string;
  sessionA: { id: string; title: string; sceneCount: number };
  sessionB: { id: string; title: string; sceneCount: number };
};

/** Sesiones del usuario que ya tienen escenas generadas (candidatas a comparar). */
export const listComparableSessions = createServerFn({ method: "GET" })
  .middleware([requireAnyAuth])
  .handler(async ({ context }) => {
    const { data, error } = await xdb(context)
      .from("capture_analyses")
      .select("capture_session_id, scenes, scenes_generated_at, capture_sessions(title, created_at)")
      .eq("owner_id", context.userId)
      .not("scenes_generated_at", "is", null)
      .order("scenes_generated_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? [])
      .map((row: any) => ({
        id: row.capture_session_id as string,
        title: (row.capture_sessions?.title as string) ?? "Sesión sin título",
        sceneCount: Array.isArray(row.scenes) ? row.scenes.length : 0,
        generatedAt: (row.scenes_generated_at as string) ?? null,
      }))
      .filter((s) => s.sceneCount > 0);
  });

/** Compara las escenas de dos sesiones y destaca patrones de comportamiento similares. */
export const compareSessionScenes = createServerFn({ method: "POST" })
  .middleware([requireAnyAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        sessionAId: z.string().uuid(),
        sessionBId: z.string().uuid(),
        focus: z.string().trim().max(500).optional(),
      })
      .refine((v) => v.sessionAId !== v.sessionBId, {
        message: "Selecciona dos sesiones distintas para comparar.",
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<ScenesComparison> => {
    const loadSide = async (sessionId: string) => {
      const [analysisRes, sessionRes, participantsRes, annotationsRes] = await Promise.all([
        xdb(context)
          .from("capture_analyses")
          .select("scenes, metrics")
          .eq("capture_session_id", sessionId)
          .eq("owner_id", context.userId)
          .maybeSingle(),
        xdb(context)
          .from("capture_sessions")
          .select("id, title, mode, area_key")
          .eq("id", sessionId)
          .eq("owner_id", context.userId)
          .single(),
        xdb(context)
          .from("capture_participants")
          .select("id, name, role")
          .eq("capture_session_id", sessionId)
          .eq("owner_id", context.userId),
        xdb(context)
          .from("capture_scene_annotations")
          .select("scene_title, start_sec, end_sec, note, tags")
          .eq("capture_session_id", sessionId)
          .eq("owner_id", context.userId)
          .limit(60),
      ]);
      if (analysisRes.error) throw new Error(analysisRes.error.message);
      if (sessionRes.error) throw new Error(sessionRes.error.message);

      const scenes = (Array.isArray(analysisRes.data?.scenes)
        ? analysisRes.data?.scenes
        : []) as SessionScene[];
      if (scenes.length === 0) {
        throw new Error(
          `La sesión «${sessionRes.data.title}» todavía no tiene escenas. Genera la película resumen antes de comparar.`,
        );
      }
      const metrics = (analysisRes.data?.metrics ?? null) as SessionMetrics | null;
      const participants = participantsRes.data ?? [];
      return {
        session: sessionRes.data,
        scenes,
        metrics,
        participants,
        annotations: annotationsRes.data ?? [],
      };
    };

    const [a, b] = await Promise.all([loadSide(data.sessionAId), loadSide(data.sessionBId)]);

    const describe = (side: Awaited<ReturnType<typeof loadSide>>, label: string) => {
      const speakers = (side.metrics?.speakers ?? [])
        .map(
          (s) =>
            `${s.participantId ?? s.speakerLabel ?? "?"}: ${s.turns} turnos, ${Math.round(
              s.talkTimeSec,
            )}s (${Math.round(s.talkSharePct)}%), interrumpe ${s.interruptionsMade}, interrumpido ${
              s.interruptionsReceived
            }`,
        )
        .join(" | ");
      const scenes = side.scenes
        .map(
          (s, i) =>
            `#${i + 1} [${s.startSec}s–${s.endSec}s | ${formatSec(s.startSec)}] «${s.title}» (${
              s.kind
            }, relevancia ${s.relevance})
  Por qué: ${s.why}
  Observaciones: ${s.observations.join(" · ")}
  Intervienen: ${s.speakers.join(", ") || "sin identificar"}`,
        )
        .join("\n");
      const notes = side.annotations
        .map(
          (n: any) =>
            `[${Math.round(Number(n.start_sec))}s–${Math.round(Number(n.end_sec))}s] ${
              n.scene_title ?? ""
            }: ${n.note} ${Array.isArray(n.tags) && n.tags.length ? `(${n.tags.join(", ")})` : ""}`,
        )
        .join("\n");
      return `SESIÓN ${label}: ${side.session.title}
Modo: ${side.session.mode} · Área: ${side.session.area_key ?? "general"}
Participantes: ${side.participants.map((p: any) => `${p.name} (${p.role})`).join(", ") || "sin identificar"}
Duración aprox.: ${Math.round(side.metrics?.spanSec ?? 0)} s${speakers ? `\nMétricas por hablante: ${speakers}` : ""}
Escenas:
${scenes}${notes ? `\nAnotaciones del profesional:\n${notes}` : ""}`;
    };

    const userKeys = await loadUserKeys(xdb(context), context.userId);
    const attempt = await runWithTextModelFallback(
      userKeys,
      undefined,
      async ({ model }) =>
        await generateText({
      model,
      experimental_output: Output.object({ schema: ScenesComparisonSchema }),
      system: `Eres un copiloto experto que compara dos sesiones grabadas para un profesional (selección, formación, terapia, mediación).
Reglas estrictas:
- Detecta patrones de comportamiento que aparezcan en AMBAS sesiones; cada patrón debe citar al menos una escena de cada sesión con sus segundos reales.
- Usa SOLO segundos y títulos de escena que existan en los datos aportados; no inventes tiempos.
- Describe únicamente comportamientos observables: turnos, tiempos, solapamientos, silencios, frases citadas.
- PROHIBIDO: diagnósticos clínicos, etiquetas de personalidad, juicios morales, inferencias sobre salud, ideología, origen u orientación.
- Idioma: español. Devuelve SIEMPRE el JSON completo.`,
      prompt: `${describe(a, "A")}

${describe(b, "B")}
${data.focus ? `\nFoco solicitado por el profesional: ${data.focus}` : ""}

Compara ambas sesiones: patrones de comportamiento similares con evidencia temporal en cada una, diferencias observables y recomendaciones.`,
        }),
      { label: "compare-scenes", maxAttempts: 3 },
    );
    const result = attempt.value;
    const provider = attempt.used.provider;
    const nativeId = attempt.used.nativeId;

    const out = result.experimental_output;
    const clamp = (scenes: SessionScene[], span: number) => (v: number) =>
      Math.max(0, Math.round(Math.min(v, span || Math.max(...scenes.map((s) => s.endSec), v))));
    const clampA = clamp(a.scenes, a.metrics?.spanSec ?? 0);
    const clampB = clamp(b.scenes, b.metrics?.spanSec ?? 0);

    const comparison: ScenesComparison = {
      ...out,
      patterns: out.patterns.map((p) => ({
        ...p,
        sessionAEvidence: p.sessionAEvidence.map((e) => ({
          ...e,
          startSec: clampA(e.startSec),
          endSec: Math.max(clampA(e.startSec) + 1, clampA(e.endSec)),
        })),
        sessionBEvidence: p.sessionBEvidence.map((e) => ({
          ...e,
          startSec: clampB(e.startSec),
          endSec: Math.max(clampB(e.startSec) + 1, clampB(e.endSec)),
        })),
      })),
      generatedAt: new Date().toISOString(),
      sessionA: { id: a.session.id, title: a.session.title, sceneCount: a.scenes.length },
      sessionB: { id: b.session.id, title: b.session.title, sceneCount: b.scenes.length },
    };

    try {
      const usage = result.usage as
        | { inputTokens?: number; outputTokens?: number; promptTokens?: number; completionTokens?: number }
        | undefined;
      const { recordUsage, userPaysPlatform } = await import("./usage.server");
      await recordUsage({
        userId: context.userId,
        action: "text",
        provider,
        model: nativeId,
        inputTokens: usage?.inputTokens ?? usage?.promptTokens ?? 0,
        outputTokens: usage?.outputTokens ?? usage?.completionTokens ?? 0,
        paysPlatform: await userPaysPlatform(context.userId),
      });
    } catch (e) {
      console.error("[compare-scenes] usage:", e);
    }

    return comparison;
  });
