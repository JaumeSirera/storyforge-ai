/**
 * Preferencias del recuadro (PIP) de una sesión: esquina, tamaño, visibilidad,
 * fuente de audio y ajuste fino de sincronía. Se comparten entre el reproductor
 * y la exportación de vídeo combinado para que el archivo descargado respete el
 * layout que el usuario ve en pantalla.
 */

export type Corner = "br" | "bl" | "tr" | "tl";
export type PipSize = "sm" | "md" | "lg";
export type AudioSource = "main" | "pip";

export type PipPrefs = {
  corner: Corner;
  size: PipSize;
  on: boolean;
  audio?: AudioSource;
  trimMs?: number;
};

export const DEFAULT_PIP_PREFS: PipPrefs = {
  corner: "br",
  size: "md",
  on: true,
  audio: "main",
  trimMs: 0,
};

export function prefsStorageKey(key?: string) {
  return `playnalyze:pip:${key ?? "default"}`;
}

export function loadPipPrefs(key?: string): Partial<PipPrefs> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(prefsStorageKey(key));
    return raw ? (JSON.parse(raw) as Partial<PipPrefs>) : {};
  } catch {
    return {};
  }
}

export function savePipPrefs(key: string | undefined, prefs: PipPrefs) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(prefsStorageKey(key), JSON.stringify(prefs));
  } catch {
    /* ignorar */
  }
}

/** Anchura relativa del recuadro respecto al lienzo, por tamaño. */
export const PIP_WIDTH_RATIO: Record<PipSize, number> = {
  sm: 0.17,
  md: 0.26,
  lg: 0.34,
};

/**
 * Traduce esquina + tamaño a un rectángulo en píxeles dentro de un lienzo W×H,
 * usando el mismo margen relativo que el reproductor.
 */
export function pipRect(
  corner: Corner,
  size: PipSize,
  W: number,
  H: number,
  aspect = 16 / 9,
) {
  const margin = Math.round(W * 0.019); // ~24 px en 1280
  const w = Math.round(W * PIP_WIDTH_RATIO[size]);
  const h = Math.round(w / aspect);
  const x = corner === "bl" || corner === "tl" ? margin : W - w - margin;
  const y = corner === "tl" || corner === "tr" ? margin : H - h - margin;
  return { x, y, w, h };
}
