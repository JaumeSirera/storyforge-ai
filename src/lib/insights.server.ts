import { streamText } from "ai";
import { formatSec, type InteractionNetwork, type SessionMetrics } from "./analyze-metrics";
import { resolveUserTextModel } from "./ai-gateway.server";
import { InsightsSchema, ROLE_GUIDES, type ReportRole, type SessionInsights } from "./insights-shared";
import { loadUserKeys } from "./user-keys.functions";

const INSIGHT_COLUMNS = "insights, insights_generated_at, metrics, interactions, status";

function mapInsights(row: any): SessionInsights | null {
  const raw = row?.insights;
  if (!raw || typeof raw !== "object" || Object.keys(raw).length === 0) return null;
  const parsed = InsightsSchema.safeParse(raw);
  if (!parsed.success) return null;
  return {
    ...parsed.data,
    role: raw.role ?? null,
    generatedAt: row.insights_generated_at ?? null,
  };
}

function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("La IA no devolvió un informe JSON reconocible.");
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    throw new Error("La IA devolvió un informe incompleto. Vuelve a intentarlo.");
  }
}

function stringsFrom(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === "string") return item;
    if (!item || typeof item !== "object") return "";
    return Object.entries(item as Record<string, unknown>)
      .map(([key, entry]) => `${key}: ${String(entry ?? "")}`)
      .join(" · ");
  }).filter(Boolean);
}

function normalizeInsights(value: unknown) {
  const raw = value && typeof value === "object" ? value as Record<string, any> : {};
  const rawSections = raw.roleSections ?? raw.secciones_rol ?? {};
  const roleSections = Array.isArray(rawSections)
    ? rawSections.map((section: any) => ({
        title: String(section?.title ?? section?.titulo ?? ""),
        points: stringsFrom(section?.points ?? section?.puntos),
      }))
    : Object.entries(rawSections as Record<string, unknown>).map(([title, points]) => ({
        title,
        points: stringsFrom(points),
      }));

  return InsightsSchema.parse({
    headline: raw.headline ?? raw.titular ?? "",
    summary: raw.summary ?? raw.resumen ?? "",
    observations: (raw.observations ?? raw.observaciones ?? []).map((item: any) => ({
      fact: item?.fact ?? item?.hecho ?? item?.description ?? item?.descripcion ?? "",
      evidence: item?.evidence ?? item?.evidencia ?? "",
    })),
    hypotheses: (raw.hypotheses ?? raw.hipotesis ?? []).map((item: any) => ({
      hypothesis: item?.hypothesis ?? item?.hipotesis ?? item?.hipotesis_trabajo ?? "",
      basis: item?.basis ?? item?.base ?? item?.base_observable ?? "",
      confidence: item?.confidence ?? item?.confianza ?? item?.nivel_confianza ?? "media",
    })),
    participants: (raw.participants ?? raw.participantes ?? raw.comportamientos_por_participante ?? []).map((item: any) => ({
      name: item?.name ?? item?.nombre ?? "",
      role: item?.role ?? item?.rol ?? "",
      behaviours: stringsFrom(item?.behaviours ?? item?.comportamientos),
    })),
    roleSections,
    recommendations: stringsFrom(raw.recommendations ?? raw.recomendaciones),
    followUpQuestions: stringsFrom(raw.followUpQuestions ?? raw.preguntas_de_seguimiento),
  });
}

export async function getSessionInsightsHandler(data: { captureSessionId: string }, context: any) {
  const { data: row, error } = await context.supabase
    .from("capture_analyses")
    .select(INSIGHT_COLUMNS)
    .eq("capture_session_id", data.captureSessionId)
    .eq("owner_id", context.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { insights: mapInsights(row) };
}

export async function generateSessionInsightsHandler(
  data: { captureSessionId: string; focus?: string; role: ReportRole },
  context: any,
) {
  const [analysisRes, sessionRes, participantsRes, segmentsRes] = await Promise.all([
    context.supabase.from("capture_analyses").select(INSIGHT_COLUMNS).eq("capture_session_id", data.captureSessionId).eq("owner_id", context.userId).maybeSingle(),
    context.supabase.from("capture_sessions").select("id, title, mode, area_key").eq("id", data.captureSessionId).eq("owner_id", context.userId).single(),
    context.supabase.from("capture_participants").select("id, name, role").eq("capture_session_id", data.captureSessionId).eq("owner_id", context.userId),
    context.supabase.from("capture_transcript_segments").select("participant_id, speaker_label, start_sec, end_sec, text").eq("capture_session_id", data.captureSessionId).eq("owner_id", context.userId).order("start_sec", { ascending: true }).limit(1200),
  ]);
  if (analysisRes.error) throw new Error(analysisRes.error.message);
  if (sessionRes.error) throw new Error(sessionRes.error.message);
  if (segmentsRes.error) throw new Error(segmentsRes.error.message);

  const metrics = (analysisRes.data?.metrics ?? null) as SessionMetrics | null;
  const interactions = (analysisRes.data?.interactions ?? null) as InteractionNetwork | null;
  const segments = segmentsRes.data ?? [];
  if (!metrics || segments.length === 0) throw new Error("Primero transcribe la sesión en Analyze para poder generar Insights.");

  const participants = participantsRes.data ?? [];
  const nameOf = (key: string | null | undefined) => {
    if (!key) return "Hablante sin identificar";
    return participants.find((participant: any) => participant.id === key)?.name ?? key;
  };
  const transcript = segments.map((segment: any) =>
    `[${formatSec(Number(segment.start_sec))}–${formatSec(Number(segment.end_sec))}] ${nameOf(segment.participant_id ?? segment.speaker_label)}: ${segment.text}`,
  ).join("\n").slice(0, 60000);
  const metricsBrief = {
    duracionSec: metrics.spanSec,
    turnosTotales: metrics.totalTurns,
    interrupcionesTotales: metrics.totalInterruptions,
    equilibrioParticipacion: metrics.participationBalance,
    silenciosLargos: metrics.silences.length,
    hablantes: metrics.speakers.map((speaker) => ({
      nombre: nameOf(speaker.participantId ?? speaker.speakerLabel),
      turnos: speaker.turns,
      tiempoHablandoSec: speaker.talkTimeSec,
      porcentaje: speaker.talkSharePct,
      interrumpe: speaker.interruptionsMade,
      esInterrumpido: speaker.interruptionsReceived,
      iniciaTema: speaker.topicStarts,
    })),
    redInteraccion: (interactions?.edges ?? []).slice(0, 25).map((edge) => `${nameOf(edge.from)} responde a ${nameOf(edge.to)} (${edge.count} veces)`),
  };

  const userKeys = await loadUserKeys(context.supabase, context.userId);
  const { model, provider, nativeId } = resolveUserTextModel(userKeys);
  const guide = ROLE_GUIDES[data.role];
  const system = `Eres un copiloto experto en análisis de interacción humana. Escribes para un ${guide.audience}. ${guide.language}\nDescribe solo hechos observables y presenta las interpretaciones como hipótesis. No hagas diagnósticos ni inferencias sensibles. Responde en español con un único objeto JSON válido, sin markdown.`;
  const prompt = `Sesión: ${sessionRes.data.title}\nModo: ${sessionRes.data.mode} · Área: ${sessionRes.data.area_key ?? "general"}\nParticipantes: ${participants.map((participant: any) => `${participant.name} (${participant.role})`).join(", ") || "sin identificar"}\n${data.focus ? `Foco: ${data.focus}\n` : ""}Métricas:\n${JSON.stringify(metricsBrief)}\n\nTranscripción:\n${transcript}\n\nDevuelve exactamente estas claves JSON en inglés: headline (string), summary (string), observations (array de {fact,evidence}), hypotheses (array de {hypothesis,basis,confidence}), participants (array de {name,role,behaviours}), roleSections (array de {title,points}), recommendations (array de strings), followUpQuestions (array de strings). roleSections debe contener estos títulos: ${guide.sections.join(" | ")}.`;

  const result = streamText({ model, system, prompt });
  const text = await result.text;
  const insights = normalizeInsights(extractJson(text));
  const generatedAt = new Date().toISOString();
  const { error: saveErr } = await context.supabase.from("capture_analyses").upsert({
    capture_session_id: data.captureSessionId,
    owner_id: context.userId,
    insights: { ...insights, role: data.role },
    insights_generated_at: generatedAt,
  }, { onConflict: "capture_session_id" });
  if (saveErr) throw new Error(saveErr.message);

  try {
    const usage = await result.usage;
    const { recordUsage, userPaysPlatform } = await import("./usage.server");
    await recordUsage({
      userId: context.userId,
      action: "text",
      provider,
      model: nativeId,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      paysPlatform: await userPaysPlatform(context.userId),
    });
  } catch (error) {
    console.error("[insights] usage:", error);
  }
  return { insights: { ...insights, role: data.role, generatedAt } as SessionInsights };
}

export async function deleteSessionInsightsHandler(data: { captureSessionId: string }, context: any) {
  const { error } = await context.supabase.from("capture_analyses").update({ insights: {}, insights_generated_at: null }).eq("capture_session_id", data.captureSessionId).eq("owner_id", context.userId);
  if (error) throw new Error(error.message);
  return { ok: true };
}