import { expect, test } from "bun:test";
import { examGrade, examLevel, examSamples } from "./public-demo-exam";

test("la nota es la suma de la rúbrica sobre 10", () => {
  expect(examGrade(examSamples[0])).toBe(9);
  expect(examGrade(examSamples[1])).toBe(3.5);
});

test("niveles de calificación", () => {
  expect(examLevel(9)).toBe("Sobresaliente");
  expect(examLevel(4.9)).toBe("Insuficiente");
  expect(examLevel(5)).toBe("Suficiente");
});
