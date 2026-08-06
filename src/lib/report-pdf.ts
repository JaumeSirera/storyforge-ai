import { jsPDF } from "jspdf";

export interface ReportAnswer {
  nodeTitle?: string;
  question?: string;
  choiceLabel?: string;
  points?: number;
  feedback?: string;
}

export interface ReportPdfData {
  simulation: { title: string; objective?: string | null };
  candidate: { name?: string | null; email?: string | null };
  session: {
    id: string;
    startedAt?: string | null;
    completedAt?: string | null;
    adminFeedback?: string | null;
  };
  report: {
    finalScore: number;
    stars: number;
    outcome: string;
    summary: string;
    strengths?: string[];
    improvements?: string[];
    achievements?: string[];
    competencyScores?: Record<string, number>;
  };
  answers: ReportAnswer[];
  criteriaLabels?: Record<string, string>;
  /** Marca de empresa opcional: logo en base64 (data URL). */
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

/** Build a full evaluation report PDF for a gamified session. */
export function generateReportPdf(data: ReportPdfData): jsPDF {
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
    ensure(46);
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

  // ---- Header band
  const logo = data.branding?.logoDataUrl || null;
  const BAND = logo ? 176 : 132;
  const TOP = logo ? 96 : 56;
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
  const titleLines = doc.splitTextToSize(data.simulation.title, CW - 140) as string[];
  doc.text(titleLines.slice(0, 2), M, TOP);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Informe final de simulación", M, TOP + titleLines.slice(0, 2).length * 22);

  const outcome = OUTCOME_LABEL[data.report.outcome] ?? data.report.outcome?.toUpperCase() ?? "—";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text(String(data.report.finalScore ?? 0), W - M, BAND - 80, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("PUNTOS", W - M, BAND - 66, { align: "right" });
  const stars = Math.max(0, Math.min(5, data.report.stars ?? 0));
  doc.setFontSize(11);
  doc.text(`${"*".repeat(stars)}${"-".repeat(5 - stars)}  (${stars}/5)`, W - M, BAND - 46, {
    align: "right",
  });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(outcome, W - M, BAND - 24, { align: "right" });

  y = BAND + 24;

  doc.setTextColor(60);

  // ---- Meta
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const metaLeft = [
    `Participante: ${data.candidate.name || "(sin nombre)"}`,
    `Email: ${data.candidate.email || "—"}`,
  ];
  const metaRight = [
    `Inicio: ${dateStr(data.session.startedAt)}`,
    `Finalización: ${dateStr(data.session.completedAt)}`,
  ];
  metaLeft.forEach((t, i) => doc.text(t, M, y + i * 14, { maxWidth: CW / 2 - 10 }));
  metaRight.forEach((t, i) => doc.text(t, M + CW / 2, y + i * 14, { maxWidth: CW / 2 }));
  y += metaLeft.length * 14 + 4;
  doc.setTextColor(120);
  doc.setFontSize(8);
  doc.text(`Sesión: ${data.session.id}`, M, y);
  y += 6;

  if (data.simulation.objective) {
    heading("Objetivo de la simulación");
    body(data.simulation.objective);
  }

  heading("Conclusiones");
  body(data.report.summary || "—");

  if (data.report.strengths?.length) {
    heading("Fortalezas");
    data.report.strengths.forEach((s) => body(`•  ${s}`, { indent: 6 }));
  }
  if (data.report.improvements?.length) {
    heading("Áreas de mejora");
    data.report.improvements.forEach((s) => body(`•  ${s}`, { indent: 6 }));
  }

  const comps = Object.entries(data.report.competencyScores ?? {});
  if (comps.length) {
    heading("Perfil competencial");
    for (const [key, value] of comps) {
      const label = data.criteriaLabels?.[key] ?? key;
      const pct = Math.max(0, Math.min(100, 50 + Number(value ?? 0)));
      ensure(30);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(60);
      doc.text(label, M, y, { maxWidth: CW - 70 });
      doc.text(`${Number(value) >= 0 ? "+" : ""}${value}`, W - M, y, { align: "right" });
      y += 6;
      doc.setFillColor(232, 234, 240);
      doc.rect(M, y, CW, 7, "F");
      doc.setFillColor(37, 62, 122);
      doc.rect(M, y, (CW * pct) / 100, 7, "F");
      y += 20;
    }
  }

  if (data.report.achievements?.length) {
    heading("Logros desbloqueados");
    body(data.report.achievements.join("  ·  "));
  }

  heading("Preguntas y respuestas");
  if (!data.answers.length) {
    body("No se registraron respuestas en esta sesión.");
  } else {
    data.answers.forEach((a, i) => {
      ensure(70);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(`${i + 1}. ${a.nodeTitle ?? "Escena"}`, M, y);
      y += 14;
      body(`Pregunta: ${a.question ?? "—"}`, { size: 10, color: 30 });
      const pts = typeof a.points === "number" ? ` (${a.points >= 0 ? "+" : ""}${a.points} pts)` : "";
      body(`Respuesta: ${a.choiceLabel ?? "—"}${pts}`, { size: 10, color: 60 });
      if (a.feedback) body(`Feedback: ${a.feedback}`, { size: 9, color: 120 });
      y += 8;
    });
  }

  if (data.session.adminFeedback) {
    heading("Feedback del evaluador");
    body(data.session.adminFeedback);
  }

  // ---- Footer on all pages
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("Informe generado automáticamente por PlayGame", M, H - 28);
    doc.text(`Página ${p} de ${pages}`, W - M, H - 28, { align: "right" });
  }

  return doc;
}

function slug(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 48) || "simulacion";
}

export function downloadReportPdf(data: ReportPdfData) {
  const doc = generateReportPdf(data);
  const who = data.candidate.name || data.candidate.email || "participante";
  doc.save(`informe-${slug(data.simulation.title)}-${slug(who)}.pdf`);
}
