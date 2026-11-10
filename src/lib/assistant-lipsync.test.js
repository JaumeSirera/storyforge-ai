import { describe, expect, it } from "vitest";
import { MOUTH_SHAPE, createOpenSmoother, envelopeFromSamples, opennessAt, opennessFromEnergy } from "./assistant-lipsync";

const RATE = 8000;
function tone(seconds, amp) {
  const s = new Float32Array(Math.round(seconds * RATE));
  for (let i = 0; i < s.length; i++) s[i] = amp * Math.sin((2 * Math.PI * 220 * i) / RATE);
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

  it("la boca abierta del todo se abre algo más que una rendija, sin exagerar", () => {
    expect(MOUTH_SHAPE.maxOpenPx).toBeGreaterThan(5);
    expect(MOUTH_SHAPE.maxOpenPx).toBeLessThanOrEqual(7);
  });

  it("al abrirse la boca encoge: la abertura es más estrecha que la boca real", () => {
    expect(MOUTH_SHAPE.halfWidth).toBeGreaterThanOrEqual(24);
    expect(MOUTH_SHAPE.halfWidth).toBeLessThanOrEqual(28);
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
});
