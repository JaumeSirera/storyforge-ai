import { expect, test } from "bun:test";
import { buildGradesCsv, csvCell, gradesFileName } from "./grades-export";
import { formatExamAnswers, ORAL_SPOKEN_NOTE, ORAL_TYPED_NOTE } from "./assessment-candidates-shared";
import { isObjectiveType } from "./assessments-shared";
import { parseAnswers } from "./exam-similarity";

const questions = [
  { id: "q1", maxPoints: 4 },
  { id: "q2", maxPoints: 6 },
];
const graded = {
  candidateName: "Ana López",
  candidateIdentifier: "A-01",
  status: "graded",
  score: 7.5,
  maxScore: 10,
  approvalStatus: "approved",
  createdAt: "2026-11-20T09:00:00Z",
  gradedAt: "2026-11-20T09:05:00Z",
  evaluation: {
    headline: "Buen trabajo",
    summary: "",
    answers: [
      { questionId: "q1", score: 3 },
      { questionId: "q2", score: 4.5 },
    ],
    breakdown: [{ key: "content", score: 80 }],
  },
};
const fmt = (iso) => (iso ? iso.slice(0, 10) : "");

test("exporta una fila por alumno con nota, nota sobre 10 y puntos por pregunta", () => {
  const csv = buildGradesCsv(questions, [graded], fmt);
  const [head, row] = csv.replace(/^\ufeff/, "").trim().split("\r\n");
  const cols = head.split(";");
  const cells = row.split(";");
  const get = (name) => cells[cols.indexOf(name)];
  expect(get("Aspirante")).toBe("Ana López");
  expect(get("Nota")).toBe("7,5");
  expect(get("Nota sobre 10")).toBe("7,5");
  expect(get("Calificación")).toBe("Notable");
  expect(get("P1 (4)")).toBe("3");
  expect(get("P2 (6)")).toBe("4,5");
  expect(get("Revisión del docente")).toBe("Aprobada por el docente");
});

test("una entrega sin corregir no inventa nota", () => {
  const pending = { ...graded, status: "pending", score: null, evaluation: null };
  const csv = buildGradesCsv(questions, [pending], fmt);
  const [head, row] = csv.replace(/^\ufeff/, "").trim().split("\r\n");
  const cols = head.split(";");
  const cells = row.split(";");
  expect(cells[cols.indexOf("Nota")]).toBe("");
  expect(cells[cols.indexOf("Estado")]).toBe("Pendiente");
});

test("la nota sobre 10 se calcula cuando la prueba vale otros puntos", () => {
  const csv = buildGradesCsv(questions, [{ ...graded, score: 15, maxScore: 20 }], fmt);
  const [head, row] = csv.replace(/^\ufeff/, "").trim().split("\r\n");
  expect(row.split(";")[head.split(";").indexOf("Nota sobre 10")]).toBe("7,5");
});

test("protege la hoja de nombres que parecen fórmulas y de separadores", () => {
  expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
  expect(csvCell("Pérez; Juan")).toBe('"Pérez; Juan"');
});

test("el archivo de notas lleva el título sin acentos ni espacios", () => {
  expect(gradesFileName("Examen de Física 2º", new Date("2026-11-20T10:00:00Z"))).toBe(
    "notas-examen-de-fisica-2-2026-11-20.csv",
  );
});

test("las preguntas orales no se corrigen como respuesta cerrada", () => {
  expect(isObjectiveType("oral")).toBe(false);
  expect(isObjectiveType("narrative")).toBe(false);
  expect(isObjectiveType("single_choice")).toBe(true);
});

test("la entrega indica qué respuestas se dieron hablando y sigue siendo legible", () => {
  const qs = [
    { id: "q1", prompt: "Explica la fotosíntesis", type: "oral", maxPoints: 5, options: [] },
    { id: "q2", prompt: "Resume el texto", type: "oral", maxPoints: 5, options: [] },
  ];
  const text = formatExamAnswers(qs, [
    { questionId: "q1", text: "las plantas usan la luz", optionIds: [], spoken: true },
    { questionId: "q2", text: "resumen escrito", optionIds: [], spoken: false },
  ]);
  expect(text).toContain(ORAL_SPOKEN_NOTE);
  expect(text).toContain(ORAL_TYPED_NOTE);
  const parsed = parseAnswers(text);
  expect(parsed.get(1)).toBe("las plantas usan la luz");
  expect(parsed.get(2)).toBe("resumen escrito");
});
