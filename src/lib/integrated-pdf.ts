import { jsPDF } from "jspdf";
import type { IntegratedReport } from "./integrated-report.server";
import { formatSec } from "./analyze-metrics";

export interface IntegratedPdfData {
  report: IntegratedReport;
  branding?: { logoDataUrl?: string | null; companyName?: string | null };
}

const OUTCOME_LABEL: Record<string, string> = {
  apto: "APTO",
  apto_con_reservas: "APTO CON RESERVAS",
  no_apto: "NO APTO",
};

function dateStr(v?: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("es-ES");
}

function slug(s: string) {
  return (
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 48) || "informe"
  );
}

/**
 * Informe integrado: qué decidió el candidato (simulación) y cómo lo hizo
 * (grabación), alineado por marca de tiempo.
 */
export function generateIntegratedPdf(data: IntegratedPdfData): jsPDF {
  const r = data.report;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  const CW = W - M * 2;
  let y = 0;

  const ensure = (needed: number) => {
    if (y + needed > H - 60) {
      doc.addPage();
      y = M + 8;
    }
  };

  const heading = (text: string) => {
    ensure(50);
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

  const body = (text: string, opts?: { size?: number; color?: number; indent?: number }) => {
    const size = opts?.size ?? 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(opts?.color ?? 60);
    const x = M + (opts?.indent ?? 0);
    const lines = doc.splitTextToSize(text, CW - (opts?.indent ?? 0)) as string[];
    for (const line of lines) {
      ensure(size + 6);
      doc.text(line, x, y);
      y += size + 4;
    }
  };

  // ---------- Portada / banda superior
  const logo = data.branding?.logoDataUrl || null;
  const BAND = logo ? 176 : 138;
  const TOP = logo ? 96 : 58;
  doc.setFillColor(37, 62, 122);
  doc.rect(0, 0, W, BAND, "F");
  if (logo) {
    try {
      const fmt = logo.includes("image/jpeg") || logo.includes("image/jpg") ? "JPEG" : "PNG";
      doc.addImage(logo, fmt, M, 20, 0, 40);
    } catch {
      /* logo no válido: se ignora */
    }
  }
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  const titleLines = doc.splitTextToSize(r.simulation.title, CW - 150) as string[];
  doc.text(titleLines.slice(0, 2), M, TOP);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Informe integrado · decisiones + comportamiento", M, TOP + titleLines.slice(0, 2).length * 22);

  const rep = (r.gameSession.report ?? {}) as any;
  const outcome = OUTCOME_LABEL[rep.outcome] ?? String(rep.outcome ?? "").toUpperCase() ?? "";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text(String(r.gameSession.score ?? 0), W - M, BAND - 82, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("PUNTOS", W - M, BAND - 68, { align: "right" });
  const stars = Math.max(0, Math.min(5, r.gameSession.stars ?? 0));
  doc.setFontSize(11);
  doc.text(`${"*".repeat(stars)}${"-".repeat(5 - stars)}  (${stars}/5)`, W - M, BAND - 48, {
    align: "right",
  });
  if (outcome) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(outcome, W - M, BAND - 26, { align: "right" });
  }

  y = BAND + 24;
  doc.setTextColor(60);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const left = [
    `Participante: ${r.candidate.name || "(sin nombre)"}`,
    `Email: ${r.candidate.email || "—"}`,
    `Simulación: ${dateStr(r.gameSession.startedAt)}`,
  ];
  const right = [
    `Grabación: ${r.capture ? r.capture.title : "no disponible"}`,
    `Inicio grabación: ${dateStr(r.capture?.startedAt ?? null)}`,
    `Vínculo: ${r.capture ? (r.capture.linkedExplicitly ? "confirmado" : "inferido por horario") : "—"}`,
  ];
  left.forEach((t, i) => doc.text(t, M, y + i * 14, { maxWidth: CW / 2 - 10 }));
  right.forEach((t, i) => doc.text(t, M + CW / 2, y + i * 14, { maxWidth: CW / 2 }));
  y += left.length * 14 + 2;

  // ---------- 1. Resumen ejecutivo
  heading("1. Resumen ejecutivo");
  body(rep.summary || "Sin resumen de la simulación.", { color: 40 });
  if (r.insights?.headline) {
    y += 4;
    body(`Dinámica observada: ${r.insights.headline}`, { color: 40 });
  }
  if (r.insights?.summary) body(r.insights.summary);
  if (r.metrics) {
    y += 4;
    const m = r.metrics;
    body(
      `Métricas de la grabación: ${formatSec(m.totalSpeechSec)} de habla sobre ${formatSec(m.spanSec)} · ${m.totalTurns} turnos · ${m.totalInterruptions} interrupciones · reparto ${Math.round((m.participationBalance ?? 0) * 100)}%`,
      { size: 9, color: 110 },
    );
  }
  const topFacts = (r.insights?.observations ?? []).slice(0, 3);
  if (topFacts.length) {
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30);
    ensure(20);
    doc.text("Hallazgos de comportamiento", M, y);
    y += 14;
    topFacts.forEach((o) => {
      body(`•  ${o.fact}`, { indent: 6, color: 50 });
      body(`Evidencia: ${o.evidence}`, { indent: 18, size: 9, color: 120 });
    });
  }

  // ---------- 2. Perfil competencial combinado
  heading("2. Perfil competencial combinado");
  if (!r.competencies.length) {
    body("La simulación no registró puntuaciones por competencia.");
  } else {
    for (const c of r.competencies) {
      const pct = Math.max(0, Math.min(100, 50 + Number(c.decisionScore ?? 0)));
      ensure(52);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(60);
      doc.text(c.label, M, y, { maxWidth: CW - 70 });
      doc.text(`${c.decisionScore >= 0 ? "+" : ""}${c.decisionScore}`, W - M, y, { align: "right" });
      y += 6;
      doc.setFillColor(232, 234, 240);
      doc.rect(M, y, CW, 7, "F");
      doc.setFillColor(37, 62, 122);
      doc.rect(M, y, (CW * pct) / 100, 7, "F");
      y += 16;
      if (c.evidence) body(`Evidencia observable: ${c.evidence}`, { size: 9, color: 120, indent: 6 });
      y += 6;
    }
  }

  // ---------- 3. Línea temporal cruzada
  heading("3. Línea temporal cruzada (decisión ↔ grabación)");
  if (!r.timeline.length) {
    body("No se registraron decisiones en esta sesión.");
  } else {
    r.timeline.forEach((t) => {
      ensure(80);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(120);
      const stamp = t.offsetSec != null ? ` · grabación ${formatSec(t.offsetSec)}` : "";
      doc.text(`${t.index}. ${t.nodeTitle}${stamp}`, M, y);
      y += 14;
      body(`Pregunta: ${t.question || "—"}`, { size: 10, color: 30 });
      body(`Respuesta: ${t.choiceLabel || "—"} (${t.points >= 0 ? "+" : ""}${t.points} pts)`, {
        size: 10,
        color: 60,
      });
      if (t.feedback) body(`Feedback: ${t.feedback}`, { size: 9, color: 120 });
      if (t.quotes.length) {
        body("Qué ocurría en la grabación:", { size: 9, color: 90, indent: 6 });
        t.quotes.forEach((q) =>
          body(`[${formatSec(q.startSec)}] ${q.speaker}: ${q.text}`, {
            size: 9,
            color: 110,
            indent: 16,
          }),
        );
      }
      y += 8;
    });
  }

  // ---------- 4. Conclusiones y recomendaciones
  heading("4. Conclusiones y recomendaciones");
  if (rep.strengths?.length) {
    body("Fortalezas", { size: 10, color: 30 });
    (rep.strengths as string[]).forEach((s) => body(`•  ${s}`, { indent: 6 }));
    y += 4;
  }
  if (rep.improvements?.length) {
    body("Áreas de mejora", { size: 10, color: 30 });
    (rep.improvements as string[]).forEach((s) => body(`•  ${s}`, { indent: 6 }));
    y += 4;
  }
  if (r.insights?.hypotheses?.length) {
    body("Hipótesis de trabajo (no diagnósticas)", { size: 10, color: 30 });
    r.insights.hypotheses.forEach((h) => {
      body(`•  ${h.hypothesis} — confianza ${h.confidence}`, { indent: 6 });
      body(`Base: ${h.basis}`, { indent: 18, size: 9, color: 120 });
    });
    y += 4;
  }
  if (r.insights?.recommendations?.length) {
    body("Plan de desarrollo sugerido", { size: 10, color: 30 });
    r.insights.recommendations.forEach((s) => body(`•  ${s}`, { indent: 6 }));
  }
  if (r.gameSession.adminFeedback) {
    heading("Feedback del evaluador");
    body(r.gameSession.adminFeedback);
  }

  // ---------- Pie
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("Xandralyze · Informe integrado (decisiones + comportamiento observable)", M, H - 28);
    doc.text(`Página ${p} de ${pages}`, W - M, H - 28, { align: "right" });
  }

  return doc;
}

export function integratedPdfFilename(data: IntegratedPdfData) {
  const who = data.report.candidate.name || data.report.candidate.email || "participante";
  return `informe-integrado-${slug(data.report.simulation.title)}-${slug(who)}.pdf`;
}

export function downloadIntegratedPdf(data: IntegratedPdfData) {
  generateIntegratedPdf(data).save(integratedPdfFilename(data));
}
