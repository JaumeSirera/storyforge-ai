import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runWithTextModelFallback } from "./ai-gateway.server";
import { loadUserKeys } from "./user-keys.functions";
import { formatSec, type SessionMetrics } from "./analyze-metrics";
import {
  SCENE_COLUMNS,
  SCENE_KINDS,
  ScenesGenSchema,
  buildFallbackScenes,
  mapScenes,
  normalizeScenes,
  type SessionScenes,
} from "./scenes.helpers";

export type { SessionScene, SessionScenes } from "./scenes.helpers";

/** Lee las escenas guardadas de la sesión. */
export const getSessionScenes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ captureSessionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("capture_analyses")
      .select(SCENE_COLUMNS)
      .eq("capture_session_id", data.captureSessionId)
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return mapScenes(row);
  });

/** Detecta los momentos más relevantes y construye la "película resumen" de la sesión. */
export const generateSessionScenes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        captureSessionId: z.string().uuid(),
        focus: z.string().trim().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const [analysisRes, sessionRes, participantsRes, segmentsRes] = await Promise.all([
      context.supabase
        .from("capture_analyses")
        .select(SCENE_COLUMNS)
        .eq("capture_session_id", data.captureSessionId)
        .eq("owner_id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("capture_sessions")
        .select("id, title, mode, area_key")
        .eq("id", data.captureSessionId)
        .eq("owner_id", context.userId)
        .single(),
      context.supabase
        .from("capture_participants")
        .select("id, name, role")
        .eq("capture_session_id", data.captureSessionId)
        .eq("owner_id", context.userId),
      context.supabase
        .from("capture_transcript_segments")
        .select("participant_id, speaker_label, start_sec, end_sec, text")
        .eq("capture_session_id", data.captureSessionId)
        .eq("owner_id", context.userId)
        .order("start_sec", { ascending: true })
        .limit(1500),
    ]);

    if (analysisRes.error) throw new Error(analysisRes.error.message);
    if (sessionRes.error) throw new Error(sessionRes.error.message);
    if (segmentsRes.error) throw new Error(segmentsRes.error.message);

    const segments = segmentsRes.data ?? [];
    const metrics = (analysisRes.data?.metrics ?? null) as SessionMetrics | null;
    if (segments.length === 0) {
      throw new Error("Primero transcribe la sesión en Analyze para detectar escenas.");
    }

    const participants = participantsRes.data ?? [];
    const nameOf = (key: string | null | undefined) => {
      if (!key) return "Hablante sin identificar";
      const p = participants.find((x) => x.id === key);
      return p ? p.name : key;
    };

    const transcript = segments
      .map(
        (s: any) =>
          `[${Math.round(Number(s.start_sec))}s–${Math.round(Number(s.end_sec))}s | ${formatSec(
            Number(s.start_sec),
          )}] ${nameOf(s.participant_id ?? s.speaker_label)}: ${s.text}`,
      )
      .join("\n")
      .slice(0, 60000);

    const spanSec =
      metrics?.spanSec ?? Math.max(...segments.map((s: any) => Number(s.end_sec) || 0), 0);

    const silences = (metrics?.silences ?? [])
      .slice(0, 30)
      .map((s) => `${Math.round(s.startSec)}s–${Math.round(s.endSec)}s (${Math.round(s.durationSec)}s)`);

    const userKeys = await loadUserKeys(context.supabase, context.userId);

    let result: Awaited<ReturnType<typeof generateText>> | null = null;
    let provider: "openai" | "gemini" | "lovable" = "lovable";
    let nativeId = "none";
    try {
      const attempt = await runWithTextModelFallback(
        userKeys,
        undefined,
        async ({ model }) =>
          await generateText({
        model,
        experimental_output: Output.object({ schema: ScenesGenSchema }),
        system: `Eres un copiloto experto que selecciona los momentos más significativos de una sesión grabada para que un profesional (selección, formación, terapia, mediación) los revise sin ver la grabación completa.
Reglas estrictas:
- Selecciona entre 4 y 10 escenas, ordenadas cronológicamente y sin solapes innecesarios.
- Cada escena debe tener inicio y fin en SEGUNDOS reales tomados de las marcas de la transcripción, con una duración de 15 a 120 segundos.
- "kind" debe ser exactamente uno de: ${SCENE_KINDS.join(", ")}.
- "relevance" es un número entero de 1 a 5. "observations" y "speakers" son listas de textos (nunca nulas).
- Describe SOLO comportamientos observables: turnos, tiempos, solapamientos, silencios, frases citadas literalmente.
- PROHIBIDO: diagnósticos clínicos, etiquetas de personalidad, juicios morales, inferencias sobre salud, ideología, origen u orientación, o conclusiones sobre el estado psicológico.
- Idioma: español. Devuelve SIEMPRE el JSON completo y válido.`,
        prompt: `Sesión: ${sessionRes.data.title}
Modo: ${sessionRes.data.mode} · Área: ${sessionRes.data.area_key ?? "general"}
Duración aproximada: ${Math.round(spanSec)} s
Participantes: ${participants.map((p) => `${p.name} (${p.role})`).join(", ") || "sin identificar"}
${data.focus ? `Foco solicitado por el profesional: ${data.focus}` : ""}
${silences.length ? `Silencios detectados: ${silences.join(", ")}` : ""}

Transcripción con segundos exactos:
${transcript}

Selecciona los momentos más relevantes y devuélvelos como escenas de la "película resumen".`,
          }),
        { label: "scenes", maxAttempts: 3 },
      );
      result = attempt.value;
      provider = attempt.used.provider;
      nativeId = attempt.used.nativeId;
    } catch (err: any) {
      console.error("[scenes] generación fallida", err?.message ?? err);
      result = null;
    }

    const raw =
      (result?.experimental_output as z.infer<typeof ScenesGenSchema> | undefined)?.scenes ?? [];
    const normalizedScenes = normalizeScenes(raw, spanSec);
    const scenes =
      normalizedScenes.length > 0
        ? normalizedScenes
        : buildFallbackScenes(segments, spanSec, nameOf);
    if (scenes.length === 0) {
      throw new Error(
        "No hay suficiente transcripción para construir escenas. Vuelve a transcribir la sesión en Analizar.",
      );
    }


    const generatedAt = new Date().toISOString();
    const { error: saveErr } = await context.supabase.from("capture_analyses").upsert(
      {
        capture_session_id: data.captureSessionId,
        owner_id: context.userId,
        scenes: scenes as any,
        scenes_generated_at: generatedAt,
      },
      { onConflict: "capture_session_id" },
    );
    if (saveErr) throw new Error(saveErr.message);

    try {
      const usage = result?.usage as
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
      console.error("[scenes] usage:", e);
    }

    return { scenes, generatedAt } satisfies SessionScenes;
  });

/** Borra las escenas guardadas de la sesión. */
export const deleteSessionScenes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ captureSessionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("capture_analyses")
      .update({ scenes: [], scenes_generated_at: null })
      .eq("capture_session_id", data.captureSessionId)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
