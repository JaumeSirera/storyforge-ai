// Cruce entre el informe final de la simulación (decisiones) y el análisis de
// la grabación (comportamiento observable). Solo hechos trazables.
import type { SessionMetrics, InteractionNetwork } from "./analyze-metrics";
import type { SessionInsights } from "./insights-shared";

export interface IntegratedTimelineEntry {
  index: number;
  nodeTitle: string;
  question: string;
  choiceLabel: string;
  points: number;
  feedback: string | null;
  at: string | null;
  /** Segundo de la grabación en el que se tomó la decisión (null si no se puede alinear). */
  offsetSec: number | null;
  /** Intervenciones de la transcripción alrededor de ese momento. */
  quotes: { speaker: string; startSec: number; endSec: number; text: string }[];
}

export interface IntegratedReport {
  simulation: { id: string; title: string; objective: string | null };
  candidate: { name: string | null; email: string | null };
  gameSession: {
    id: string;
    startedAt: string | null;
    completedAt: string | null;
    adminFeedback: string | null;
    score: number;
    stars: number;
    report: any | null;
    competencyScores: Record<string, number>;
  };
  criteriaLabels: Record<string, string>;
  capture: {
    id: string;
    title: string;
    startedAt: string | null;
    endedAt: string | null;
    mode: string;
    linkedExplicitly: boolean;
  } | null;
  metrics: SessionMetrics | null;
  interactions: InteractionNetwork | null;
  insights: SessionInsights | null;
  timeline: IntegratedTimelineEntry[];
  /** Señales por competencia: decisión (puntos) + evidencia observable. */
  competencies: {
    key: string;
    label: string;
    decisionScore: number;
    evidence: string | null;
  }[];
}

const QUOTE_BEFORE_SEC = 20;
const QUOTE_AFTER_SEC = 40;

export function alignAnswersWithRecording(
  answers: any[],
  captureStartedAt: string | null,
  segments: { participant_id: string | null; speaker_label: string | null; start_sec: number; end_sec: number; text: string }[],
  nameOf: (key: string | null | undefined) => string,
): IntegratedTimelineEntry[] {
  const base = captureStartedAt ? new Date(captureStartedAt).getTime() : null;
  return answers.map((a, i) => {
    const at = typeof a?.at === "string" ? a.at : null;
    const offsetSec =
      base && at ? Math.max(0, Math.round((new Date(at).getTime() - base) / 1000)) : null;
    const quotes =
      offsetSec == null
        ? []
        : segments
            .filter(
              (s) =>
                Number(s.end_sec) >= offsetSec - QUOTE_BEFORE_SEC &&
                Number(s.start_sec) <= offsetSec + QUOTE_AFTER_SEC,
            )
            .slice(0, 6)
            .map((s) => ({
              speaker: nameOf(s.participant_id ?? s.speaker_label),
              startSec: Number(s.start_sec),
              endSec: Number(s.end_sec),
              text: String(s.text ?? "").slice(0, 600),
            }));
    return {
      index: i + 1,
      nodeTitle: String(a?.nodeTitle ?? "Escena"),
      question: String(a?.question ?? ""),
      choiceLabel: String(a?.choiceLabel ?? ""),
      points: Number(a?.points ?? 0),
      feedback: a?.feedback ? String(a.feedback) : null,
      at,
      offsetSec,
      quotes,
    };
  });
}

/**
 * Une la puntuación de cada competencia con una evidencia observable de la
 * grabación (comportamientos detectados por participante o hechos observados).
 */
export function buildCompetencySignals(
  competencyScores: Record<string, number>,
  criteriaLabels: Record<string, string>,
  insights: SessionInsights | null,
): IntegratedReport["competencies"] {
  const pool: string[] = [
    ...(insights?.observations ?? []).map((o) => `${o.fact} (${o.evidence})`),
    ...(insights?.participants ?? []).flatMap((p) => p.behaviours.map((b) => `${p.name}: ${b}`)),
  ];
  return Object.entries(competencyScores ?? {}).map(([key, value], i) => ({
    key,
    label: criteriaLabels[key] ?? key,
    decisionScore: Number(value ?? 0),
    evidence: pool.length ? (pool[i % pool.length] ?? null) : null,
  }));
}

/** Elige la grabación más plausible para una sesión de juego. */
export function pickCaptureForSession(
  captures: any[],
  sessionStartedAt: string | null,
  gameSessionId: string,
): { row: any; linkedExplicitly: boolean } | null {
  const explicit = captures.find((c) => c.game_session_id === gameSessionId);
  if (explicit) return { row: explicit, linkedExplicitly: true };
  if (!sessionStartedAt || captures.length === 0) return null;
  const t = new Date(sessionStartedAt).getTime();
  const scored = captures
    .map((c) => {
      const ref = c.started_at ?? c.created_at;
      return { c, dist: ref ? Math.abs(new Date(ref).getTime() - t) : Number.POSITIVE_INFINITY };
    })
    .sort((a, b) => a.dist - b.dist);
  const best = scored[0];
  // Solo se considera la misma actividad si empezaron con menos de 6 h de diferencia.
  if (!best || best.dist > 6 * 3600 * 1000) return null;
  return { row: best.c, linkedExplicitly: false };
}
