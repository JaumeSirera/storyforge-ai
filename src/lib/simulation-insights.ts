/** Utilidades puras de simulación: modo práctica, tiempo por decisión y comparación. */

/** Clave guardada en los datos del candidato para marcar una sesión de práctica. */
export const PRACTICE_KEY = "__practice";

export function isPracticeSession(fieldsData: unknown): boolean {
  return Boolean(fieldsData && typeof fieldsData === "object" && (fieldsData as Record<string, unknown>)[PRACTICE_KEY] === "1");
}

/** Quita las claves internas (como la de práctica) antes de mostrar los datos del candidato. */
export function visibleCandidateFields(fieldsData: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries((fieldsData ?? {}) as Record<string, unknown>)) {
    if (!k.startsWith("__")) out[k] = String(v ?? "");
  }
  return out;
}

/** Tiempo de respuesta máximo que se guarda (1 hora), para descartar pestañas olvidadas. */
export const MAX_RESPONSE_MS = 3_600_000;

export interface TimedAnswer {
  nodeTitle?: string;
  question?: string;
  choiceLabel?: string;
  kind?: string;
  responseMs?: number;
  viaVoice?: boolean;
}

/** Decisiones con tiempo medido (las de salto automático no cuentan). */
export function timedDecisions(answers: unknown): TimedAnswer[] {
  if (!Array.isArray(answers)) return [];
  return (answers as TimedAnswer[]).filter(
    (a) => a && a.kind !== "goto" && typeof a.responseMs === "number" && a.responseMs >= 0,
  );
}

/** Tiempo medio por decisión en segundos (redondeado a 1 decimal) o null si no hay datos. */
export function averageDecisionSeconds(answers: unknown): number | null {
  const t = timedDecisions(answers);
  if (!t.length) return null;
  const avg = t.reduce((s, a) => s + (a.responseMs ?? 0), 0) / t.length / 1000;
  return Math.round(avg * 10) / 10;
}

export function voiceAnswerCount(answers: unknown): number {
  return Array.isArray(answers) ? (answers as TimedAnswer[]).filter((a) => a?.viaVoice).length : 0;
}

export function formatSeconds(sec: number | null): string {
  if (sec == null) return "—";
  if (sec < 60) return `${sec.toLocaleString("es-ES")} s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m} min ${s} s`;
}
