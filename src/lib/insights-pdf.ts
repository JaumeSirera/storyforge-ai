import { jsPDF } from "jspdf";
import { ROLE_GUIDES, type SessionInsights } from "./insights.functions";
import { formatSec, type SessionMetrics } from "./analyze-metrics";

export interface InsightsPdfData {
  sessionTitle: string;
  areaLabel?: string | null;
  generatedAt?: string | null;
  insights: SessionInsights;
  metrics?: SessionMetrics | null;
  speakerName?: (key: string) => string;
}


/** Informe Insights descargable: hechos observables e hipótesis trazables. */
export function generateInsightsPdf(data: InsightsPdfData): jsPDF {
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
    ensure(48);
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

  const body = (text: string, opts?: { size?: number; color?: number; indent?: number; bold?: boolean }) => {
    const size = opts?.size ?? 10;
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(opts?.color ?? 60);
    const indent = opts?.indent ?? 0;
    const lines = doc.splitTextToSize(text, CW - indent) as string[];
    for (const line of lines) {
      ensure(size + 6);
      doc.text(line, M + indent, y);
      y += size + 4;
    }
  };

  // Header
  doc.setFillColor(37, 62, 122);
  doc.rect(0, 0, W, 128, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  const titleLines = doc.splitTextToSize(data.sessionTitle, CW) as string[];
  doc.text(titleLines.slice(0, 2), M, 54);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Informe Insights · Playnalyze", M, 54 + titleLines.slice(0, 2).length * 22);
  doc.setFontSize(9);
  const roleLabel = data.insights.role ? ROLE_GUIDES[data.insights.role]?.label : null;
  const meta = [
    roleLabel ? `Informe para: ${roleLabel}` : null,
    data.areaLabel ? `Área: ${data.areaLabel}` : null,
    data.generatedAt ? `Generado: ${new Date(data.generatedAt).toLocaleString("es-ES")}` : null,
  ]
    .filter(Boolean)
    .join("   ·   ");
  if (meta) doc.text(meta, M, 112);

  y = 152;
  doc.setTextColor(60);

  const ins = data.insights;
  if (ins.headline) body(ins.headline, { size: 12, color: 30, bold: true });

  heading("Resumen");
  body(ins.summary || "—");

  if (data.metrics) {
    heading("Métricas objetivas");
    const m = data.metrics;
    body(
      `Duración analizada: ${formatSec(m.spanSec)}   ·   Turnos: ${m.totalTurns}   ·   Interrupciones: ${m.totalInterruptions}   ·   Equilibrio de participación: ${Math.round(
        m.participationBalance * 100,
      )}%   ·   Silencios largos: ${m.silences.length}`,
    );
    y += 4;
    for (const s of m.speakers) {
      const name = data.speakerName?.(s.key) ?? s.key;
      body(
        `•  ${name}: ${s.talkSharePct}% del tiempo (${formatSec(s.talkTimeSec)}), ${s.turns} turnos, interrumpe ${s.interruptionsMade}, es interrumpido ${s.interruptionsReceived}`,
        { indent: 6 },
      );
    }
  }

  if (ins.observations?.length) {
    heading("Hechos observables");
    ins.observations.forEach((o, i) => {
      body(`${i + 1}. ${o.fact}`, { color: 30 });
      body(`Evidencia: ${o.evidence}`, { size: 9, color: 120, indent: 12 });
      y += 4;
    });
  }

  if (ins.hypotheses?.length) {
    heading("Hipótesis de trabajo");
    body(
      "Interpretaciones no concluyentes. Requieren validación del profesional; no constituyen diagnóstico.",
      { size: 9, color: 130 },
    );
    y += 6;
    ins.hypotheses.forEach((h, i) => {
      body(`${i + 1}. ${h.hypothesis}  [confianza ${h.confidence}]`, { color: 30 });
      body(`Base observable: ${h.basis}`, { size: 9, color: 120, indent: 12 });
      y += 4;
    });
  }

  if (ins.participants?.length) {
    heading("Comportamientos por participante");
    ins.participants.forEach((p) => {
      body(`${p.name} — ${p.role}`, { color: 30, bold: true });
      p.behaviours.forEach((b) => body(`•  ${b}`, { indent: 10 }));
      y += 4;
    });
  }

  if (ins.roleSections?.length) {
    ins.roleSections.forEach((sec) => {
      heading(sec.title);
      sec.points.forEach((pt) => body(`•  ${pt}`, { indent: 6 }));
    });
  }

  if (ins.recommendations?.length) {
    heading("Recomendaciones");
    ins.recommendations.forEach((r) => body(`•  ${r}`, { indent: 6 }));
  }

  if (ins.followUpQuestions?.length) {
    heading("Preguntas de seguimiento");
    ins.followUpQuestions.forEach((q) => body(`•  ${q}`, { indent: 6 }));
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("Playnalyze · Insights: hechos observables e hipótesis trazables", M, H - 28);
    doc.text(`Página ${p} de ${pages}`, W - M, H - 28, { align: "right" });
  }

  return doc;
}

function slug(s: string) {
  return (
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 48) || "sesion"
  );
}

export function downloadInsightsPdf(data: InsightsPdfData) {
  generateInsightsPdf(data).save(`insights-${slug(data.sessionTitle)}.pdf`);
}
