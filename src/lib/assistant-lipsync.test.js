import { describe, expect, it } from "vitest";
import {
  MOUTH_SHAPE,
  brightnessFromSamples,
  createOpenSmoother,
  envelopeFromSamples,
  opennessAt,
  opennessFromEnergy,
  wideAt,
} from "./assistant-lipsync";

const RATE = 8000;
function tone(seconds, amp) {
  const s = new Float32Array(Math.round(seconds * RATE));
  for (let i = 0; i < s.length; i++) s[i] = amp * Math.sin((2 * Math.PI * 220 * i) / RATE);
  return s;
}
function toneHz(seconds, amp, hz) {
  const s = new Float32Array(Math.round(seconds * RATE));
  for (let i = 0; i < s.length; i++) s[i] = amp * Math.sin((2 * Math.PI * hz * i) / RATE);
  return s;
}
function concat(...parts) {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

describe("labios del asistente", () => {
  it("con silencio la boca queda cerrada", () => {
    const env = envelopeFromSamples(new Float32Array(RATE), RATE);
    expect(Array.from(env).every((v) => v === 0)).toBe(true);
    expect(opennessAt(env, 0.5)).toBe(0);
  });

  it("abre la boca cuando suena la voz y la cierra en la pausa", () => {
    const env = envelopeFromSamples(concat(tone(0.5, 0.5), tone(0.5, 0), tone(0.5, 0.5)), RATE);
    expect(opennessAt(env, 0.25)).toBe(1);
    expect(opennessAt(env, 0.75)).toBe(0);
    expect(opennessAt(env, 1.25)).toBe(1);
  });

  it("voz más baja abre menos la boca", () => {
    expect(opennessFromEnergy(0.05)).toBe(0);
    expect(opennessFromEnergy(0.3)).toBeLessThan(opennessFromEnergy(0.6));
    expect(opennessFromEnergy(0.6)).toBeLessThan(opennessFromEnergy(0.95));
  });

  it("la boca abierta del todo se abre bien, como al principio", () => {
    expect(MOUTH_SHAPE.maxOpenPx).toBeGreaterThanOrEqual(8);
    expect(MOUTH_SHAPE.maxOpenPx).toBeLessThanOrEqual(10);
  });

  it("la abertura ocupa el ancho real de su boca, sin encoger", () => {
    expect(MOUTH_SHAPE.halfWidth).toBe(31);
  });

  it("la boca no salta: de cerrada a abierta tarda varios fotogramas", () => {
    const smooth = createOpenSmoother();
    smooth(0, 0);
    const after1 = smooth(1, 16);
    expect(after1).toBeLessThan(0.4);
    let v = after1;
    for (let t = 32; t <= 400; t += 16) v = smooth(1, t);
    expect(v).toBeGreaterThan(0.95);
  });

  it("entre sílabas seguidas la boca se cierra un poco, no se queda abierta fija", () => {
    // Sílabas: fuerte, más suave, fuerte… sin silencio entre medias.
    const env = envelopeFromSamples(concat(tone(0.12, 0.5), tone(0.12, 0.2), tone(0.12, 0.5)), RATE);
    const strong = opennessAt(env, 0.06);
    const weak = opennessAt(env, 0.18);
    expect(strong).toBe(1);
    expect(weak).toBeLessThan(0.45);
  });

  it("sonidos agudos estiran la boca y los graves la redondean", () => {
    const shape = brightnessFromSamples(concat(toneHz(0.4, 0.4, 150), toneHz(0.4, 0.4, 600), toneHz(0.4, 0.4, 2000)), RATE);
    expect(wideAt(shape, 0.2)).toBeLessThan(0);
    expect(wideAt(shape, 1.0)).toBeGreaterThan(0);
    expect(wideAt(null, 0.2)).toBe(0);
  });

  it("la barbilla baja menos que el labio y el ancho varía poco", () => {
    expect(MOUTH_SHAPE.jawRatio).toBeGreaterThan(0.3);
    expect(MOUTH_SHAPE.jawRatio).toBeLessThan(0.8);
    expect(MOUTH_SHAPE.widthVar).toBeLessThanOrEqual(0.08);
  });
});

describe("cara que habla", () => {
  it("sigue hablando en pausas cortas y se apaga tras una pausa larga", async () => {
    const { talkFaceOn } = await import("./assistant-lipsync");
    expect(talkFaceOn(1000, 1300)).toBe(true);
    expect(talkFaceOn(1000, 1500)).toBe(false);
    expect(talkFaceOn(0, 100)).toBe(false);
  });
});
