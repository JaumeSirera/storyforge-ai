import { describe, expect, it } from "bun:test";
import { latencyVerdict, mbps, micVerdict, uploadVerdict } from "./device-check.ts";

describe("prueba previa de grabación", () => {
  it("calcula Mbit/s de subida", () => {
    // 1 MB en 1 segundo = 8 Mbit/s
    expect(mbps(1_000_000, 1000)).toBe(8);
    expect(mbps(1_000_000, 0)).toBe(0);
  });

  it("la subida necesita 2 Mbit/s para ir bien y 0,8 para ser justa", () => {
    expect(uploadVerdict(2)).toBe("buena");
    expect(uploadVerdict(1.5)).toBe("justa");
    expect(uploadVerdict(0.5)).toBe("mala");
  });

  it("latencia buena hasta 300 ms y mala por encima de 800 ms", () => {
    expect(latencyVerdict(300)).toBe("buena");
    expect(latencyVerdict(500)).toBe("justa");
    expect(latencyVerdict(900)).toBe("mala");
  });

  it("micrófono silencioso se marca como problema", () => {
    expect(micVerdict(0.01)).toBe("mala");
    expect(micVerdict(0.03)).toBe("justa");
    expect(micVerdict(0.2)).toBe("buena");
  });
});
