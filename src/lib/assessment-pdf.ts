import { jsPDF } from "jspdf";
import {
  VERDICT_LABELS,
  FEEDBACK_TONE_LABELS,
  ANNOTATION_KIND_LABELS,
  gradeLabel,
  type AssessmentEvaluation,
  type AssessmentRecord,
  type SubmissionAnnotation,
  type SubmissionRecord,
} from "./assessments-shared";

export interface AssessmentPdfData {
  assessment: AssessmentRecord;
  submission: SubmissionRecord;
  evaluation: AssessmentEvaluation;
  annotations?: SubmissionAnnotation[];
}

/** Informe de evaluación escrita: nota, rúbrica, competencias y grafismo. */
export function generateAssessmentPdf(data: AssessmentPdfData): jsPDF {
  const { assessment, submission, evaluation, annotations = [] } = data;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  const CW = W - M * 2;
  let y = M;

  const ensure = (needed: number) => {
    if (y + needed > H - 56) {
      doc.addPage();
      y = M;
    }
  };

  const heading = (text: string) => {
    ensure(52);
    y += 18;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(20);
    doc.text(text, M, y);
    y += 8;
    doc.setDrawColor(215);
    doc.line(M, y, W - M, y);
    y += 14;
  };

  const body = (text: string, opts?: { bold?: boolean; size?: number; indent?: number }) => {
    if (!text) return;
    const size = opts?.size ?? 10;
    const indent = opts?.indent ?? 0;
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(45);
    const lines = doc.splitTextToSize(text, CW - indent);
    for (const line of lines) {
      ensure(size + 6);
      doc.text(line, M + indent, y);
      y += size + 4;
    }
  };

  const bullets = (items: string[], indent = 12) => {
    for (const item of items) {
      if (!item) continue;
      body(`• ${item}`, { indent });
    }
  };

  // Portada
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(15);
  doc.text("Informe de evaluación escrita", M, y);
  y += 26;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(90);
  doc.text(assessment.title, M, y);
  y += 16;
  doc.text(
    `Candidato: ${submission.candidateName}${submission.candidateIdentifier ? ` · ${submission.candidateIdentifier}` : ""}`,
    M,
    y,
  );
  y += 16;
  doc.text(
    `Área: ${assessment.areaKey ?? "general"} · Corregido: ${submission.gradedAt ? new Date(submission.gradedAt).toLocaleString() : "—"}`,
    M,
    y,
  );
  y += 22;

  // Nota
  doc.setFillColor(240, 245, 255);
  ensure(72);
  doc.roundedRect(M, y, CW, 62, 8, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(30, 64, 175);
  doc.text(`${evaluation.score.toFixed(2)} / ${evaluation.maxScore}`, M + 16, y + 34);
  doc.setFontSize(11);
  doc.setTextColor(60);
  doc.text(gradeLabel(evaluation.score, evaluation.maxScore), M + 16, y + 52);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `Contenido: ${evaluation.contentScore.toFixed(2)} / ${evaluation.maxScore}   ·   Grafismo: ${evaluation.handwritingScore.toFixed(0)} / 100   ·   Peso grafismo: ${assessment.handwritingWeightPct}%`,
    M + 200,
    y + 34,
  );
  y += 74;

  if (evaluation.headline) {
    heading("Titular");
    body(evaluation.headline, { bold: true, size: 11 });
  }
  if (evaluation.summary) {
    heading("Resumen");
    body(evaluation.summary);
  }

  if (evaluation.answers.length > 0) {
    heading("Corrección y feedback por pregunta");
    body(`Tono del feedback: ${FEEDBACK_TONE_LABELS[assessment.feedbackTone]}`, { size: 9 });
    for (const answer of evaluation.answers) {
      body(
        `${answer.question || answer.questionId} — ${answer.score} / ${answer.maxPoints} puntos · ${VERDICT_LABELS[answer.verdict] ?? ""}`,
        { bold: true },
      );
      body(answer.answerSummary, { indent: 12 });
      if (answer.evidence) body(`Evidencia: “${answer.evidence}”`, { indent: 12, size: 9 });
      if (answer.expectedAnswer)
        body(`Respuesta esperada: ${answer.expectedAnswer}`, { indent: 12, size: 9 });
      if (answer.explanation) body(`¿Por qué?: ${answer.explanation}`, { indent: 12, size: 9 });
      if (answer.feedback) body(`Feedback: ${answer.feedback}`, { indent: 12, size: 9 });
      if (answer.nextStep) body(`Siguiente paso: ${answer.nextStep}`, { indent: 12, size: 9 });
      if (answer.strengths.length) {
        body("Fortalezas:", { bold: true, indent: 12, size: 9 });
        bullets(answer.strengths, 24);
      }
      if (answer.gaps.length) {
        body("A mejorar:", { bold: true, indent: 12, size: 9 });
        bullets(answer.gaps, 24);
      }
      y += 6;
    }
  }

  if (evaluation.criteria.length > 0) {
    heading("Rúbrica");
    for (const criterion of evaluation.criteria) {
      body(`${criterion.name}: ${criterion.score} / ${criterion.maxScore}`, { bold: true });
      body(criterion.justification, { indent: 12 });
    }
  }

  if (evaluation.competencies.length > 0) {
    heading("Perfil competencial");
    for (const competency of evaluation.competencies) {
      body(`${competency.name} — ${competency.level}`, { bold: true });
      body(competency.evidence, { indent: 12 });
    }
  }

  heading("Análisis del grafismo");
  const hw = evaluation.handwriting;
  body(
    `Legibilidad ${hw.legibility}/100 · Estructura ${hw.structure}/100 · Limpieza ${hw.cleanliness}/100 · Espaciado ${hw.spacing}/100 · Consistencia ${hw.consistency}/100`,
  );
  if (hw.corrections) body(`Correcciones y tachones: ${hw.corrections}`);
  if (hw.observations.length) {
    body("Hechos observables:", { bold: true });
    bullets(hw.observations);
  }
  if (hw.hypotheses.length) {
    body("Hipótesis de trabajo (no concluyentes, requieren verificación):", { bold: true });
    for (const hypothesis of hw.hypotheses) {
      body(`• ${hypothesis.hypothesis} (confianza: ${hypothesis.confidence})`, { indent: 12 });
      if (hypothesis.basis) body(`Base observable: ${hypothesis.basis}`, { indent: 24, size: 9 });
    }
  }

  if (evaluation.recommendations.length > 0) {
    heading("Recomendaciones");
    bullets(evaluation.recommendations);
  }
  if (evaluation.conclusion) {
    heading("Conclusión");
    body(evaluation.conclusion);
  }

  if (annotations.length > 0) {
    heading("Marcas y comentarios del evaluador");
    body(
      "Áreas marcadas manualmente sobre las páginas de la entrega. Se han tenido en cuenta en la corrección.",
      { size: 9 },
    );
    annotations.forEach((annotation, index) => {
      body(`${index + 1}. Página ${annotation.pageIndex + 1} — ${ANNOTATION_KIND_LABELS[annotation.kind]}`, {
        bold: true,
      });
      if (annotation.correction) body(`Texto correcto: ${annotation.correction}`, { indent: 12 });
      if (annotation.comment) body(annotation.comment, { indent: 12 });
    });
  }

  if (submission.extractedText) {
    heading("Transcripción de la entrega");
    body(submission.extractedText.slice(0, 12000), { size: 9 });
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(
      "Playnalyze · Informe generado con apoyo de IA. Las hipótesis no son concluyentes y requieren revisión profesional.",
      M,
      H - 28,
    );
    doc.text(`${i}/${pages}`, W - M, H - 28, { align: "right" });
  }

  return doc;
}
