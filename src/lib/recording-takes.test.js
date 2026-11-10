import { describe, expect, it } from "vitest";
import { buildTakes, cameraParts } from "./recording-takes";

const T0 = Date.parse("2026-11-10T10:00:00Z");
const at = (min, sec = 0) => new Date(T0 + min * 60_000 + sec * 1000).toISOString();
const rec = (id, kind, createdAt, syncOffsetMs, durationSec) => ({ id, kind, createdAt, syncOffsetMs, durationSec, participantId: null });

describe("tomas de grabación", () => {
  it("una entrevista de 20 minutos queda en una sola toma con las 4 partes de cámara", () => {
    const takes = buildTakes([
      rec("c1", "camera", at(5), 0, 300),
      rec("c2", "camera", at(10), 300_000, 300),
      rec("c3", "camera", at(15), 600_000, 300),
      rec("c4", "camera", at(20, 5), 900_000, 300),
      rec("s", "screen", at(20, 20), 0, 1200),
    ]);
    expect(takes).toHaveLength(1);
    expect(cameraParts(takes[0]).map((t) => t.id)).toEqual(["c1", "c2", "c3", "c4"]);
    expect(takes[0].tracks[0].id).toBe("s");
  });

  it("dos grabaciones seguidas no se mezclan", () => {
    const takes = buildTakes([
      rec("a-cam", "camera", at(3), 0, 180),
      rec("a-scr", "screen", at(3, 5), 0, 180),
      rec("b-cam", "camera", at(6), 0, 170),
      rec("b-scr", "screen", at(6, 5), 0, 170),
    ]);
    expect(takes).toHaveLength(2);
    expect(takes.map((t) => t.tracks.map((x) => x.id).sort())).toEqual([["b-cam", "b-scr"], ["a-cam", "a-scr"]]);
  });

  it("una grabación corta sigue agrupando pantalla y cámara", () => {
    const takes = buildTakes([rec("c", "camera", at(2), 0, 120), rec("s", "screen", at(2, 3), 0, 120)]);
    expect(takes).toHaveLength(1);
    expect(takes[0].tracks.map((t) => t.kind)).toEqual(["screen", "camera"]);
  });
});
