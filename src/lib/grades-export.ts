// Exportación de las notas de una prueba a una hoja de cálculo (CSV que abre Excel,
// LibreOffice o Google Sheets). Se genera en el navegador con los datos ya cargados.

import { DIMENSION_LABELS, SCORE_DIMENSIONS, gradeLabel } from "./assessments-shared";
import type { AssessmentQuestion, SubmissionRecord } from "./assessments-shared";

type ExportSubmission = Pick<
  SubmissionRecord,
  | "candidateName"
  | "candidateIdentifier"
  | "status"
  | "score"
  | "maxScore"
  | "approvalStatus"
  | "createdAt"
  | "gradedAt"
  | "evaluation"
>;

const STATUS: Record<string, string> = {
  graded: "Corregida",
  grading: "Corrigiendo",
  failed: "Error",
  pending: "Pendiente",
};

const APPROVAL: Record<string, string> = {
  approved: "Aprobada por el docente",
  rejected: "Devuelta para revisión",
  pending: "Sin revisar",
};

/** Número con coma decimal (formato español) y como mucho dos decimales. */
export function decimal(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "";
  return String(Math.round(n * 100) / 100).replace(".", ",");
}

/** Escapa un campo para CSV con «;» y evita que una hoja lo interprete como fórmula. */
export function csvCell(value: string): string {
  let v = value ?? "";
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function defaultDate(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
}

export function buildGradesCsv(
  questions: Pick<AssessmentQuestion, "id" | "maxPoints">[],
  submissions: ExportSubmission[],
  formatDate: (iso: string | null | undefined) => string = defaultDate,
): string {
  const head = [
    "Aspirante",
    "Identificador",
    "Estado",
    "Nota",
    "Puntuación máxima",
    "Nota sobre 10",
    "Calificación",
    "Revisión del docente",
    ...questions.map((q, i) => `P${i + 1} (${decimal(q.maxPoints)})`),
    ...SCORE_DIMENSIONS.map((k) => `${DIMENSION_LABELS[k]} (0-100)`),
    "Fecha de entrega",
    "Fecha de corrección",
    "Resumen",
  ];
  const rows = submissions.map((s) => {
    const graded = s.status === "graded" && s.score !== null;
    const max = s.maxScore ?? null;
    const answers = s.evaluation?.answers ?? [];
    const perQuestion = questions.map((q, i) => {
      if (!graded) return "";
      const a = answers.find((x) => x.questionId && x.questionId === q.id) ?? answers[i];
      return a ? decimal(a.score) : "";
    });
    const dims = SCORE_DIMENSIONS.map((k) => {
      const d = s.evaluation?.breakdown?.find((b) => b.key === k);
      return graded && d ? decimal(d.score) : "";
    });
    return [
      csvCell(s.candidateName ?? ""),
      csvCell(s.candidateIdentifier ?? ""),
      STATUS[s.status] ?? s.status,
      graded ? decimal(s.score) : "",
      decimal(max),
      graded && max ? decimal(((s.score as number) / max) * 10) : "",
      graded && max ? gradeLabel(s.score as number, max) : "",
      APPROVAL[s.approvalStatus] ?? "",
      ...perQuestion,
      ...dims,
      csvCell(formatDate(s.createdAt)),
      csvCell(graded ? formatDate(s.gradedAt) : ""),
      csvCell(graded ? (s.evaluation?.headline || s.evaluation?.summary || "") : ""),
    ].join(";");
  });
  // BOM para que Excel reconozca los acentos (UTF-8).
  return `\ufeff${[head.map(csvCell).join(";"), ...rows].join("\r\n")}\r\n`;
}

/** Nombre de archivo seguro a partir del título de la prueba. */
export function gradesFileName(title: string, now = new Date()) {
  const base =
    (title || "prueba")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()
      .slice(0, 60) || "prueba";
  return `notas-${base}-${now.toISOString().slice(0, 10)}.csv`;
}

export function downloadGradesCsv(
  title: string,
  questions: Pick<AssessmentQuestion, "id" | "maxPoints">[],
  submissions: ExportSubmission[],
) {
  const blob = new Blob([buildGradesCsv(questions, submissions)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = gradesFileName(title);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
