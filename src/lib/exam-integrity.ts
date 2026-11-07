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
}

export const emptyIntegrity = (): ExamIntegrity => ({
  tabSwitches: 0, hiddenSeconds: 0, pasteBlocked: 0, copyBlocked: 0, fullscreenExits: 0, fullscreenUsed: false,
});

export type IntegrityLevel = "sin_incidencias" | "revisar" | "alto";

/**
 * Nivel de alerta: sin incidencias si todo es 0; alto con 5 o más incidencias
 * o 2 minutos o más fuera del examen; en otro caso, revisar.
 */
export function integrityLevel(i: ExamIntegrity): IntegrityLevel {
  const incidents = i.tabSwitches + i.pasteBlocked + i.copyBlocked + i.fullscreenExits;
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
  };
}

export function integritySummary(i: ExamIntegrity): string {
  const parts = [
    `${i.tabSwitches} salida(s) del examen`,
    `${i.hiddenSeconds} s fuera`,
    `${i.pasteBlocked} pegado(s) bloqueado(s)`,
    `${i.copyBlocked} copia(s) bloqueada(s)`,
    i.fullscreenUsed ? `${i.fullscreenExits} salida(s) de pantalla completa` : "sin pantalla completa",
  ];
  return parts.join(" · ");
}
