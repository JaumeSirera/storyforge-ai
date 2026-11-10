import { describe, expect, it } from "vitest";
import { MOUTH_SPRITE, createMouthPicker, envelopeFromSamples, levelAt, levelFromEnergy } from "./assistant-lipsync";

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
    expect(levelAt(env, 0.5)).toBe(0);
  });

  it("abre la boca cuando suena la voz y la cierra en la pausa", () => {
    // 0–0.5 s voz fuerte, 0.5–1 s silencio, 1–1.5 s voz fuerte
    const env = envelopeFromSamples(concat(tone(0.5, 0.5), tone(0.5, 0), tone(0.5, 0.5)), RATE);
    expect(levelAt(env, 0.25)).toBe(3);
    expect(levelAt(env, 0.75)).toBe(0);
    expect(levelAt(env, 1.25)).toBe(3);
  });

  it("voz más baja abre menos la boca", () => {
    expect(levelFromEnergy(0.05)).toBe(0);
    expect(levelFromEnergy(0.3)).toBe(1);
    expect(levelFromEnergy(0.6)).toBe(2);
    expect(levelFromEnergy(0.9)).toBe(3);
  });

  it("elige una boca del grupo de su nivel", () => {
    const pick = createMouthPicker(() => 0.5);
    expect(MOUTH_SPRITE.bins[0]).toContain(pick(0, 0));
    expect(MOUTH_SPRITE.bins[3]).toContain(pick(3, 100));
  });
});
