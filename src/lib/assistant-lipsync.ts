/**
 * Movimiento de labios del asistente a partir del sonido real de su voz.
 *
 * No se pega ninguna boca de otra imagen: el lienzo deforma en directo la
 * propia cara del bucle de espera (baja un poco el labio de abajo y deja ver
 * una rendija oscura entre los labios). Así la boca tiene siempre su tamaño,
 * color y luz exactos, sin sombras ni bordes. Aquí se calcula cuánto se abre
 * (0 cerrada … 1 lo máximo, que son solo unos pocos píxeles).
 */

/** Forma de la boca en el bucle de espera (píxeles de la imagen 480x382). */
export const MOUTH_SHAPE = {
  /** Línea entre los labios: y = a·x² + b·x + c. */
  seam: [-5.93049720e-3, 2.78804272, -107.588235] as const,
  centerX: 250.5,
  halfWidth: 31,
  /** Apertura máxima entre los labios, en píxeles. Pequeña a propósito. */
  maxOpenPx: 3.6,
};

export const ENVELOPE_FPS = 50;
/** Por debajo de este volumen (RMS) se considera silencio. */
const SILENCE_RMS = 0.012;

/** Volumen normalizado (0–1) de la voz, `fps` valores por segundo. */
export function envelopeFromSamples(samples: Float32Array, sampleRate: number, fps = ENVELOPE_FPS): Float32Array {
  const win = Math.max(1, Math.round(sampleRate / fps));
  const n = Math.ceil(samples.length / win);
  const raw = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = i * win;
    const b = Math.min(samples.length, a + win);
    let s = 0;
    for (let j = a; j < b; j++) s += samples[j] * samples[j];
    raw[i] = Math.sqrt(s / Math.max(1, b - a));
  }
  const voiced = Array.from(raw).filter((v) => v >= SILENCE_RMS).sort((x, y) => x - y);
  const env = new Float32Array(n);
  if (voiced.length === 0) return env;
  const peak = voiced[Math.floor((voiced.length - 1) * 0.9)] || voiced[voiced.length - 1];
  for (let i = 0; i < n; i++) {
    // Suavizado ligero (3 muestras) para que la boca no tiemble.
    const v = (raw[Math.max(0, i - 1)] + raw[i] * 2 + raw[Math.min(n - 1, i + 1)]) / 4;
    env[i] = v < SILENCE_RMS ? 0 : Math.min(1, v / peak);
  }
  return env;
}

/** Cuánto se abre la boca (0–1) para un volumen dado. Voz baja apenas la abre. */
export function opennessFromEnergy(e: number): number {
  if (e < 0.1) return 0;
  const t = Math.min(1, (e - 0.1) / 0.8);
  return 0.2 + 0.8 * t * t * (3 - 2 * t);
}

/** Apertura en el segundo `t` del audio. */
export function opennessAt(env: Float32Array, t: number, fps = ENVELOPE_FPS): number {
  const i = Math.floor(t * fps);
  if (i < 0 || i >= env.length) return 0;
  return opennessFromEnergy(env[i]);
}

/** Para la voz del navegador (sin audio que analizar): sílabas suaves simuladas. */
export function syntheticOpenness(ms: number): number {
  const syl = 150; // ~6–7 sílabas por segundo
  const phase = (ms % syl) / syl;
  const k = Math.floor(ms / syl);
  const amp = [0.55, 0.8, 0.4, 0.7, 0.5, 0.85, 0.35, 0.65][k % 8];
  return amp * Math.sin(Math.PI * phase);
}

/** Suaviza la apertura: abre algo rápido y cierra algo más despacio, sin saltos. */
export function createOpenSmoother(attackMs = 60, releaseMs = 110) {
  let v = 0;
  let last = -1;
  return (target: number, now: number): number => {
    const dt = last < 0 ? 16 : Math.min(100, Math.max(0, now - last));
    last = now;
    const tau = target > v ? attackMs : releaseMs;
    v += (target - v) * (1 - Math.exp(-dt / tau));
    if (v < 0.002) v = 0;
    return v;
  };
}
