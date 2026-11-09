/** Registro de integridad del examen online (antitrampas). Módulo puro, usable en cliente y servidor. */
export interface ExamIntegrity {
  /** Veces que el aspirante salió de la pestaña o de la ventana del examen. */
  tabSwitches: number;
  /** Segundos totales fuera del examen. */
  hiddenSeconds: number;
  /** Intentos de pegar texto (bloqueados). */
  pasteBlocked: number;
  /** Intentos de copiar o cortar (bloqueados). */
  copyBlocked: number;
  /** Veces que salió de la pantalla completa. */
  fullscreenExits: number;
  /** Si el examen se hizo en pantalla completa. */
  fullscreenUsed: boolean;
  /** Veces que apareció de golpe un bloque de texto (40 caracteres o más en una sola pulsación). */
  textBursts: number;
  /** Caracteres escritos tecleando. */
  typedChars: number;
  /** Segundos escribiendo activamente (pausas de más de 5 s no cuentan). */
  typingActiveSec: number;
}

export const emptyIntegrity = (): ExamIntegrity => ({
  tabSwitches: 0, hiddenSeconds: 0, pasteBlocked: 0, copyBlocked: 0, fullscreenExits: 0, fullscreenUsed: false,
  textBursts: 0, typedChars: 0, typingActiveSec: 0,
});

/** Un bloque de texto que aparece de una vez a partir de este tamaño cuenta como «texto de golpe». */
export const BURST_CHARS = 40;
/** Velocidad inusual: más de 500 caracteres por minuto con al menos 200 caracteres escritos. */
export const FAST_TYPING_CPM = 500;
export const FAST_TYPING_MIN_CHARS = 200;

export function typingCpm(i: ExamIntegrity): number {
  if (i.typingActiveSec <= 0) return 0;
  return Math.round((i.typedChars / i.typingActiveSec) * 60);
}

export function isFastTyping(i: ExamIntegrity): boolean {
  return i.typedChars >= FAST_TYPING_MIN_CHARS && typingCpm(i) > FAST_TYPING_CPM;
}

export type IntegrityLevel = "sin_incidencias" | "revisar" | "alto";

/**
 * Nivel de alerta: sin incidencias si todo es 0; alto con 5 o más incidencias
 * o 2 minutos o más fuera del examen; en otro caso, revisar. Cada bloque de
 * texto de golpe cuenta como incidencia y la escritura inusualmente rápida, como una.
 */
export function integrityLevel(i: ExamIntegrity): IntegrityLevel {
  const incidents =
    i.tabSwitches + i.pasteBlocked + i.copyBlocked + i.fullscreenExits + i.textBursts + (isFastTyping(i) ? 1 : 0);
  if (incidents === 0 && i.hiddenSeconds === 0) return "sin_incidencias";
  if (incidents >= 5 || i.hiddenSeconds >= 120) return "alto";
  return "revisar";
}

export const INTEGRITY_LEVEL_LABELS: Record<IntegrityLevel, string> = {
  sin_incidencias: "Sin incidencias",
  revisar: "Revisar",
  alto: "Riesgo alto",
};

export function normalizeIntegrity(raw: unknown): ExamIntegrity {
  const r = (raw ?? {}) as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.min(Math.round(v), 100000) : 0);
  return {
    tabSwitches: n(r.tabSwitches), hiddenSeconds: n(r.hiddenSeconds), pasteBlocked: n(r.pasteBlocked),
    copyBlocked: n(r.copyBlocked), fullscreenExits: n(r.fullscreenExits), fullscreenUsed: r.fullscreenUsed === true,
    textBursts: n(r.textBursts), typedChars: n(r.typedChars), typingActiveSec: n(r.typingActiveSec),
  };
}

export function integritySummary(i: ExamIntegrity): string {
  const parts = [
    `${i.tabSwitches} salida(s) del examen`,
    `${i.hiddenSeconds} s fuera`,
    `${i.pasteBlocked} pegado(s) bloqueado(s)`,
    `${i.copyBlocked} copia(s) bloqueada(s)`,
    i.fullscreenUsed ? `${i.fullscreenExits} salida(s) de pantalla completa` : "sin pantalla completa",
    `${i.textBursts} bloque(s) de texto de golpe`,
    `${typingCpm(i)} caracteres/min${isFastTyping(i) ? " (inusual)" : ""}`,
  ];
  return parts.join(" · ");
}
