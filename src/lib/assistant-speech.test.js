import { describe, expect, it } from "vitest";
import { splitForSpeech } from "./assistant-speech";

const ANSWER =
  "Ve a Exámenes y pulsa «Nueva evaluación». Sube las fotos de los exámenes desde tu ordenador. La aplicación lee la letra, aplica tu rúbrica y te propone una nota con evidencias. Revisa cada comentario antes de enviarlo al alumno, porque siempre tienes la última palabra.";

describe("voz de la asistente por partes", () => {
  it("empieza con una sola frase corta para hablar enseguida", () => {
    const parts = splitForSpeech(ANSWER);
    expect(parts[0]).toBe("Ve a Exámenes y pulsa «Nueva evaluación».");
    expect(parts[0].length).toBeLessThanOrEqual(120);
  });

  it("no pierde ni cambia ninguna palabra", () => {
    expect(splitForSpeech(ANSWER).join(" ")).toBe(ANSWER);
  });

  it("ninguna parte supera el tamaño máximo", () => {
    const long = ("Esta es una frase bastante larga, con varias comas, que sigue y sigue sin punto " ).repeat(8);
    for (const p of splitForSpeech(long)) expect(p.length).toBeLessThanOrEqual(280);
    expect(splitForSpeech(long)[0].length).toBeLessThanOrEqual(120);
  });

  it("un texto corto queda en una sola parte", () => {
    expect(splitForSpeech("Hola.")).toEqual(["Hola."]);
    expect(splitForSpeech("   ")).toEqual([]);
  });
});
