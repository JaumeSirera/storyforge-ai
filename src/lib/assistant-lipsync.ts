/**
 * Movimiento de labios del asistente a partir del sonido real de su voz.
 *
 * `public/assistant/bocas.jpg` es una hoja con 14 posiciones de boca sacadas
 * del vídeo «hablando» (misma postura de cabeza, cada celda apilada: imagen
 * arriba y máscara abajo). Según el volumen de la voz en cada instante se
 * elige una boca cerrada, entreabierta, media o abierta.
 */

export type MouthLevel = 0 | 1 | 2 | 3;

export const MOUTH_SPRITE = {
  src: "/assistant/bocas.jpg",
  cols: 4,
  rows: 4,
  /** Índices de celda por nivel: 0 cerrada … 3 abierta. */
  bins: [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8, 9],
    [10, 11, 12, 13],
  ] as const,
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

export function levelFromEnergy(e: number): MouthLevel {
  if (e < 0.1) return 0;
  if (e < 0.4) return 1;
  if (e < 0.72) return 2;
  return 3;
}

/** Nivel de boca en el segundo `t` del audio. */
export function levelAt(env: Float32Array, t: number, fps = ENVELOPE_FPS): MouthLevel {
  const i = Math.floor(t * fps);
  if (i < 0 || i >= env.length) return 0;
  return levelFromEnergy(env[i]);
}

/** Para la voz del navegador (sin audio que analizar): sílabas simuladas. */
export function syntheticLevel(ms: number): MouthLevel {
  const pattern: MouthLevel[] = [1, 3, 2, 0, 2, 3, 1, 2, 0, 3, 2, 1];
  return pattern[Math.floor(ms / 95) % pattern.length];
}

/** Elige la celda de la hoja y la mantiene un mínimo para evitar parpadeos. */
export function createMouthPicker(random: () => number = Math.random) {
  let level: MouthLevel | -1 = -1;
  let cell = 0;
  let since = 0;
  return (next: MouthLevel, now: number): number => {
    const hold = next === level ? 140 : 55;
    if (now - since < hold) return cell;
    const bin = MOUTH_SPRITE.bins[next];
    let pick = bin[Math.floor(random() * bin.length) % bin.length];
    if (pick === cell && bin.length > 1) pick = bin[(bin.indexOf(pick as never) + 1) % bin.length];
    level = next;
    cell = pick;
    since = now;
    return cell;
  };
}
