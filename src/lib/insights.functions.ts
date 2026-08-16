import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveUserTextModel } from "./ai-gateway.server";
import { loadUserKeys } from "./user-keys.functions";
import { formatSec, type SessionMetrics, type InteractionNetwork } from "./analyze-metrics";

/** Roles profesionales para los que se adapta el lenguaje y las secciones del informe. */
export const REPORT_ROLES = ["entrevistador", "terapeuta", "coordinador"] as const;
export type ReportRole = (typeof REPORT_ROLES)[number];

export const ROLE_GUIDES: Record<
  ReportRole,
  { label: string; audience: string; language: string; sections: string[] }
> = {
  entrevistador: {
    label: "Entrevistador / selección",
    audience:
      "responsable de selección que debe decidir sobre la idoneidad de una persona para un puesto",
    language:
      "Lenguaje de evaluación por competencias: evidencias conductuales, indicadores, ejemplos STAR. Nunca rasgos de personalidad ni datos sensibles.",
    sections: [
      "Competencias observadas con evidencia",
      "Señales a verificar en la siguiente entrevista",
      "Encaje con el rol: qué apoya y qué queda por comprobar",
    ],
  },
  terapeuta: {
    label: "Terapeuta / acompañamiento",
    audience: "profesional de acompañamiento psicológico o coaching que trabaja con la persona o el grupo",
    language:
      "Lenguaje descriptivo, no patologizante, centrado en patrones de interacción y recursos observados. Sin diagnósticos, etiquetas clínicas ni inferencias de salud.",
    sections: [
      "Patrones de interacción observados",
      "Recursos y estrategias que la persona o el grupo ya utiliza",
      "Temas a explorar en la próxima sesión",
    ],
  },
  coordinador: {
    label: "Coordinador / dinámica de equipo",
    audience: "responsable de equipo o formación que necesita mejorar la dinámica del grupo",
    language:
      "Lenguaje operativo de equipo: reparto de la palabra, toma de decisiones, gestión de desacuerdos, acuerdos de funcionamiento.",
    sections: [
      "Reparto de la palabra y de la iniciativa",
      "Cómo se toman las decisiones y se gestionan los desacuerdos",
      "Acuerdos de funcionamiento propuestos para la próxima reunión",
    ],
  },
};

/** Informe Insights: hechos observables + hipótesis trazables (copiloto experto, nunca diagnóstico). */
export const InsightsSchema = z.object({
  headline: z.string().describe("Titular de una frase con la dinámica principal observada"),
  summary: z.string().describe("Resumen ejecutivo de 3-5 frases, solo hechos observables"),
  observations: z
    .array(
      z.object({
        fact: z.string().describe("Hecho observable, medible en la transcripción"),
        evidence: z.string().describe("Evidencia con minutos exactos o cifras concretas"),
      }),
    )
    .min(2),
  hypotheses: z
    .array(
      z.object({
        hypothesis: z.string().describe("Hipótesis de trabajo, redactada como posibilidad"),
        basis: z.string().describe("En qué evidencia observable se apoya"),
        confidence: z.enum(["baja", "media", "alta"]),
      }),
    )
    .min(1),
  participants: z
    .array(
      z.object({
        name: z.string(),
        role: z.string().describe("Rol funcional observado en la conversación"),
        behaviours: z.array(z.string()).min(1),
      }),
    )
    .default([]),
  roleSections: z
    .array(
      z.object({
        title: z.string().describe("Título de la sección propia del rol profesional solicitado"),
        points: z.array(z.string()).min(1).describe("Puntos concretos con evidencia observable"),
      }),
    )
    .default([])
    .describe("Secciones específicas del rol profesional para el que se redacta el informe"),
  recommendations: z.array(z.string()).min(1).describe("Siguientes pasos para el profesional"),
  followUpQuestions: z
    .array(z.string())
    .default([])
    .describe("Preguntas que el profesional podría explorar en la siguiente sesión"),
});

export type SessionInsights = z.infer<typeof InsightsSchema> & {
  generatedAt: string | null;
  role?: ReportRole | null;
};


const INSIGHT_COLUMNS = "insights, insights_generated_at, metrics, interactions, status";

function mapInsights(row: any): SessionInsights | null {
  const raw = row?.insights;
  if (!raw || typeof raw !== "object" || Object.keys(raw).length === 0) return null;
  return { ...(raw as z.infer<typeof InsightsSchema>), generatedAt: row.insights_generated_at ?? null };
}

/** Lee el informe Insights guardado de la sesión. */
export const getSessionInsights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ captureSessionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("capture_analyses")
      .select(INSIGHT_COLUMNS)
      .eq("capture_session_id", data.captureSessionId)
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { insights: mapInsights(row) };
  });

/** Genera el informe Insights a partir de las métricas y la transcripción guardadas. */
export const generateSessionInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        captureSessionId: z.string().uuid(),
        focus: z.string().trim().max(500).optional(),
        role: z.enum(REPORT_ROLES).default("entrevistador"),

      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const [analysisRes, sessionRes, participantsRes, segmentsRes] = await Promise.all([
      context.supabase
        .from("capture_analyses")
        .select(INSIGHT_COLUMNS)
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
        .limit(1200),
    ]);

    if (analysisRes.error) throw new Error(analysisRes.error.message);
    if (sessionRes.error) throw new Error(sessionRes.error.message);
    if (segmentsRes.error) throw new Error(segmentsRes.error.message);

    const metrics = (analysisRes.data?.metrics ?? null) as SessionMetrics | null;
    const interactions = (analysisRes.data?.interactions ?? null) as InteractionNetwork | null;
    const segments = segmentsRes.data ?? [];
    if (!metrics || segments.length === 0) {
      throw new Error("Primero transcribe la sesión en Analyze para poder generar Insights.");
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
          `[${formatSec(Number(s.start_sec))}–${formatSec(Number(s.end_sec))}] ${nameOf(
            s.participant_id ?? s.speaker_label,
          )}: ${s.text}`,
      )
      .join("\n")
      .slice(0, 60000);

    const metricsBrief = {
      duracionSec: metrics.spanSec,
      turnosTotales: metrics.totalTurns,
      interrupcionesTotales: metrics.totalInterruptions,
      equilibrioParticipacion: metrics.participationBalance,
      silenciosLargos: metrics.silences.length,
      hablantes: metrics.speakers.map((s) => ({
        nombre: nameOf(s.participantId ?? s.speakerLabel),
        turnos: s.turns,
        tiempoHablandoSec: s.talkTimeSec,
        porcentaje: s.talkSharePct,
        interrumpe: s.interruptionsMade,
        esInterrumpido: s.interruptionsReceived,
        iniciaTema: s.topicStarts,
      })),
      redInteraccion: (interactions?.edges ?? [])
        .slice(0, 25)
        .map((e) => `${nameOf(e.from)} responde a ${nameOf(e.to)} (${e.count} veces)`),
    };

    const userKeys = await loadUserKeys(context.supabase, context.userId);
    const { model, provider, nativeId } = resolveUserTextModel(userKeys);

    const result = await generateText({
      model,
      experimental_output: Output.object({ schema: InsightsSchema }),
      system: `Eres un copiloto experto en análisis de interacción humana para profesionales (selección, formación, terapia, mediación).
Reglas estrictas:
- Describe SOLO hechos observables y trazables (minutos, turnos, tiempos, interrupciones, silencios, frases citadas).
- Las interpretaciones se presentan como HIPÓTESIS de trabajo, con su base observable y un nivel de confianza.
- PROHIBIDO: diagnósticos clínicos, etiquetas de personalidad, juicios morales, inferencias sobre salud, ideología, origen u orientación.
- Idioma: español. Devuelve SIEMPRE el JSON completo.`,
      prompt: `Sesión: ${sessionRes.data.title}
Modo: ${sessionRes.data.mode} · Área: ${sessionRes.data.area_key ?? "general"}
Participantes: ${participants.map((p) => `${p.name} (${p.role})`).join(", ") || "sin identificar"}
${data.focus ? `Foco solicitado por el profesional: ${data.focus}` : ""}

Métricas objetivas:
${JSON.stringify(metricsBrief, null, 2)}

Transcripción con marcas de tiempo:
${transcript}

Genera el informe Insights: titular, resumen, observaciones con evidencia temporal, hipótesis trazables con nivel de confianza, comportamientos por participante, recomendaciones y preguntas de seguimiento.`,
    });

    const insights = result.experimental_output;
    const generatedAt = new Date().toISOString();

    const { error: saveErr } = await context.supabase.from("capture_analyses").upsert(
      {
        capture_session_id: data.captureSessionId,
        owner_id: context.userId,
        insights: insights as any,
        insights_generated_at: generatedAt,
      },
      { onConflict: "capture_session_id" },
    );
    if (saveErr) throw new Error(saveErr.message);

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
      console.error("[insights] usage:", e);
    }

    return { insights: { ...insights, generatedAt } as SessionInsights };
  });

/** Borra el informe Insights guardado (derecho de supresión). */
export const deleteSessionInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ captureSessionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("capture_analyses")
      .update({ insights: {}, insights_generated_at: null })
      .eq("capture_session_id", data.captureSessionId)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
