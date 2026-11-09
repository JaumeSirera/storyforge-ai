import { expect, test } from "bun:test";
import {
  averageDecisionSeconds,
  formatSeconds,
  isPracticeSession,
  visibleCandidateFields,
  voiceAnswerCount,
} from "./simulation-insights";

test("una sesión de práctica se reconoce por su marca", () => {
  expect(isPracticeSession({ __practice: "1" })).toBe(true);
  expect(isPracticeSession({ empresa: "Acme" })).toBe(false);
  expect(isPracticeSession(null)).toBe(false);
});

test("la marca de práctica no se muestra como dato del candidato", () => {
  expect(visibleCandidateFields({ __practice: "1", empresa: "Acme" })).toEqual({ empresa: "Acme" });
});

test("tiempo medio por decisión, sin contar los saltos automáticos", () => {
  const answers = [
    { kind: "question", responseMs: 4000 },
    { kind: "comment", responseMs: 8000 },
    { kind: "goto", responseMs: 100000 },
    { kind: "question" },
  ];
  expect(averageDecisionSeconds(answers)).toBe(6);
  expect(averageDecisionSeconds([])).toBe(null);
});

test("cuenta las respuestas por voz", () => {
  expect(voiceAnswerCount([{ viaVoice: true }, {}, { viaVoice: true }])).toBe(2);
});

test("formato de segundos", () => {
  expect(formatSeconds(null)).toBe("—");
  expect(formatSeconds(75)).toBe("1 min 15 s");
});
