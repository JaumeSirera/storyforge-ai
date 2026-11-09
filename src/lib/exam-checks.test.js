import { expect, test } from "bun:test";
import { seededShuffle, shuffleExamQuestions } from "./exam-shuffle";
import { answerSimilarity, findSimilarPairs, parseAnswers } from "./exam-similarity";
import { emptyIntegrity, integrityLevel, isFastTyping } from "./exam-integrity";

test("el orden aleatorio es estable por aspirante y distinto entre aspirantes", () => {
  const items = Array.from({ length: 10 }, (_, i) => i);
  expect(seededShuffle(items, "tokenA")).toEqual(seededShuffle(items, "tokenA"));
  expect(seededShuffle(items, "tokenA")).not.toEqual(seededShuffle(items, "tokenB"));
  expect([...seededShuffle(items, "tokenA")].sort((a, b) => a - b)).toEqual(items);
});

test("baraja también las opciones sin perder ninguna", () => {
  const qs = [{ id: "q1", options: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }] }];
  const out = shuffleExamQuestions(qs, "x");
  expect(out[0].options.map((o) => o.id).sort()).toEqual(["a", "b", "c", "d"]);
});

const sub = (answers) =>
  answers.map((a, i) => `Pregunta ${i + 1}: Explica el tema\nRespuesta: ${a}`).join("\n\n");

test("lee las respuestas del texto de entrega", () => {
  const m = parseAnswers(sub(["uno dos", "(sin responder)"]));
  expect(m.get(1)).toBe("uno dos");
  expect(m.has(2)).toBe(false);
});

test("detecta dos respuestas copiadas y no las distintas", () => {
  const copia = "La revolución industrial cambió la forma de producir porque introdujo máquinas de vapor en las fábricas textiles";
  const distinta = "El clima mediterráneo tiene veranos secos y calurosos con inviernos suaves y lluvias en otoño y primavera";
  expect(answerSimilarity(copia, copia + " inglesas")).toBeGreaterThanOrEqual(0.5);
  expect(answerSimilarity(copia, distinta)).toBe(0);
  const pairs = findSimilarPairs([
    { id: "1", name: "Ana", text: sub([copia]) },
    { id: "2", name: "Luis", text: sub([copia]) },
    { id: "3", name: "Eva", text: sub([distinta]) },
  ]);
  expect(pairs.length).toBe(1);
  expect(pairs[0].a.name).toBe("Ana");
  expect(pairs[0].b.name).toBe("Luis");
});

test("respuestas de menos de 8 palabras no se comparan", () => {
  expect(answerSimilarity("sí es correcto", "sí es correcto")).toBe(0);
});

test("ritmo de escritura: más de 500 car/min con 200 caracteres es inusual", () => {
  expect(isFastTyping({ ...emptyIntegrity(), typedChars: 300, typingActiveSec: 30 })).toBe(true); // 600/min
  expect(isFastTyping({ ...emptyIntegrity(), typedChars: 300, typingActiveSec: 90 })).toBe(false); // 200/min
  expect(isFastTyping({ ...emptyIntegrity(), typedChars: 150, typingActiveSec: 5 })).toBe(false);
});

test("los bloques de texto de golpe cuentan como incidencias", () => {
  expect(integrityLevel({ ...emptyIntegrity(), textBursts: 1 })).toBe("revisar");
  expect(integrityLevel({ ...emptyIntegrity(), textBursts: 5 })).toBe("alto");
});
