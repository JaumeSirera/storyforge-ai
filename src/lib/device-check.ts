/** Utilidades puras para la prueba previa de cámara, micrófono y conexión. */

export type CheckVerdict = "buena" | "justa" | "mala";

/** Velocidad de subida (Mbit/s) a partir de bytes enviados y milisegundos. */
export function mbps(bytes: number, ms: number): number {
  if (!ms || ms <= 0) return 0;
  return Math.round(((bytes * 8) / (ms / 1000) / 1_000_000) * 10) / 10;
}

/** Una grabación HD de cámara necesita ~2 Mbit/s de subida; por debajo de 0,8 se corta. */
export function uploadVerdict(uploadMbps: number): CheckVerdict {
  if (uploadMbps >= 2) return "buena";
  if (uploadMbps >= 0.8) return "justa";
  return "mala";
}

/** Latencia: hasta 300 ms va bien; más de 800 ms es mala para la sincronización en directo. */
export function latencyVerdict(ms: number): CheckVerdict {
  if (ms <= 300) return "buena";
  if (ms <= 800) return "justa";
  return "mala";
}

/** Nivel del micrófono (0-1, RMS): por debajo de 0,02 casi no se oye. */
export function micVerdict(peakLevel: number): CheckVerdict {
  if (peakLevel >= 0.05) return "buena";
  if (peakLevel >= 0.02) return "justa";
  return "mala";
}

export const VERDICT_LABEL: Record<CheckVerdict, string> = {
  buena: "Bien",
  justa: "Justa",
  mala: "Problema",
};
