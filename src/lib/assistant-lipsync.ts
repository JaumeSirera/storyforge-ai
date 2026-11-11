/**
 * Movimiento de labios del asistente a partir del sonido real de su voz.
 *
 * No se pega ninguna boca de otra imagen: el lienzo deforma en directo la
 * propia cara del bucle de espera: bajan el labio de abajo y, algo más tarde,
 * la barbilla; sube un poco el de arriba; el ancho cambia con el sonido y la
 * cabeza asiente levemente. Así la boca tiene siempre su tamaño,
 * color y luz exactos, sin sombras ni bordes. Aquí se calcula cuánto se abre
 * (0 cerrada … 1 lo máximo, que son solo unos pocos píxeles).
 */

/** Forma de la boca en el bucle de espera (píxeles de la imagen 480x382). */
export const MOUTH_SHAPE = {
  /** Línea entre los labios: y = a·x² + b·x + c. */
  seam: [-5.93049720e-3, 2.78804272, -107.588235] as const,
  centerX: 250.5,
  /** Mitad del ancho de la abertura: el ancho real de su boca.
   */
  halfWidth: 31,
  /** Apertura máxima entre los labios, en píxeles (boca bien abierta). */
  maxOpenPx: 9,
  /** La mandíbula (barbilla) baja esta fracción de lo que baja el labio, algo más tarde. */
  jawRatio: 0.55,
  /** Cuánto varía el ancho de la boca según el sonido (±, fracción del ancho). */
  widthVar: 0.06,
  /** Leve asentimiento de la cabeza al hablar, en píxeles como mucho. */
  nodPx: 1.2,
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
  return articulate(env);
}

/**
 * Marca las sílabas: dentro de una frase seguida la boca se cierra un poco
 * entre sílabas en vez de quedarse abierta a la par (eso la hacía rígida).
 */
function articulate(env: Float32Array, radius = 5): Float32Array {
  const out = new Float32Array(env.length);
  for (let i = 0; i < env.length; i++) {
    const v = env[i];
    if (v === 0) continue;
    let lo = v;
    let hi = v;
    for (let j = Math.max(0, i - radius); j <= Math.min(env.length - 1, i + radius); j++) {
      if (env[j] < lo) lo = env[j];
      if (env[j] > hi) hi = env[j];
    }
    const range = hi - lo;
    const c = range < 0.15 ? 1 : (v - lo) / range;
    out[i] = v * (0.55 + 0.45 * c);
  }
  return out;
}

/**
 * Timbre de la voz (0 grave/redondo … 1 agudo/«s»), `fps` valores por segundo.
 * Con sonidos agudos (i, e, s) la boca se estira un poco; con o, u se redondea.
 */
export function brightnessFromSamples(samples: Float32Array, sampleRate: number, fps = ENVELOPE_FPS): Float32Array {
  const win = Math.max(1, Math.round(sampleRate / fps));
  const n = Math.ceil(samples.length / win);
  const zcr = new Float32Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    const a = i * win;
    const b = Math.min(samples.length, a + win);
    let s = 0;
    let z = 0;
    for (let j = a; j < b; j++) {
      s += samples[j] * samples[j];
      if (j > a && (samples[j] >= 0) !== (samples[j - 1] >= 0)) z++;
    }
    if (Math.sqrt(s / Math.max(1, b - a)) >= SILENCE_RMS) zcr[i] = z / Math.max(1, b - a);
  }
  const voiced = Array.from(zcr).filter((v) => v >= 0).sort((x, y) => x - y);
  const out = new Float32Array(n).fill(0.5);
  if (voiced.length < 3) return out;
  const lo = voiced[Math.floor((voiced.length - 1) * 0.2)];
  const hi = voiced[Math.floor((voiced.length - 1) * 0.8)];
  const span = Math.max(1e-6, hi - lo);
  for (let i = 0; i < n; i++) if (zcr[i] >= 0) out[i] = Math.min(1, Math.max(0, (zcr[i] - lo) / span));
  const sm = new Float32Array(n);
  for (let i = 0; i < n; i++) sm[i] = (out[Math.max(0, i - 1)] + out[i] * 2 + out[Math.min(n - 1, i + 1)]) / 4;
  return sm;
}

/** Ancho de la boca en el segundo `t` (−1 redonda … 1 estirada). */
export function wideAt(shape: Float32Array | null, t: number, fps = ENVELOPE_FPS): number {
  if (!shape) return 0;
  const i = Math.floor(t * fps);
  if (i < 0 || i >= shape.length) return 0;
  return (shape[i] - 0.5) * 2;
}

/** Para la voz del navegador: forma variada por sílaba, sin saltos. */
export function syntheticWide(ms: number): number {
  return 0.7 * Math.sin(ms / 230) * Math.cos(ms / 410);
}

/** Cuánto se abre la boca (0–1) para un volumen dado. Voz baja apenas la abre. */
export function opennessFromEnergy(e: number): number {
  if (e < 0.1) return 0;
  const t = Math.min(1, (e - 0.1) / 0.8);
  return 0.12 + 0.88 * t * t * (3 - 2 * t);
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
export function createOpenSmoother(attackMs = 45, releaseMs = 95) {
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

/**
 * Cara que habla: bucle grabado del propio saludo (sin sonido) que se funde
 * encima de la espera mientras suena la voz, para que hable como en el saludo.
 * Las pausas cortas entre palabras no lo apagan; una pausa larga, sí.
 */
export const TALK_LOOP = "/assistant/hablando-alfa.mp4";
export const TALK_HOLD_MS = 450;
export function talkFaceOn(lastVoiceAt: number, now: number, hold = TALK_HOLD_MS): boolean {
  return lastVoiceAt > 0 && now - lastVoiceAt < hold;
}
