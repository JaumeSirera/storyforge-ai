import { jsPDF } from "jspdf";
import { formatSec } from "./analyze-metrics";
import type { ScenesComparison } from "./compare-scenes.functions";

export type ComparisonPdfData = ScenesComparison & {
  focus?: string | null;
  /** Empieza el informe con una página de conclusiones y recomendaciones clave. */
  executiveSummary?: boolean;
};

/** Exporta la comparativa de sesiones: patrones, evidencias por sesión, diferencias y recomendaciones. */
export function generateComparisonPdf(data: ComparisonPdfData): jsPDF {

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
    y += 16;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(20);
    const lines = doc.splitTextToSize(text, CW) as string[];
    for (const line of lines) {
      ensure(20);
      doc.text(line, M, y);
      y += 16;
    }
    doc.setDrawColor(215);
    doc.line(M, y - 8, W - M, y - 8);
    y += 6;
  };

  const body = (
    text: string,
    opts?: { size?: number; color?: number; indent?: number; bold?: boolean },
  ) => {
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

  // Cabecera
  doc.setFillColor(37, 62, 122);
  doc.rect(0, 0, W, 128, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  const titleLines = doc.splitTextToSize(
    `${data.sessionA.title}  vs.  ${data.sessionB.title}`,
    CW,
  ) as string[];
  doc.text(titleLines.slice(0, 2), M, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(
    data.executiveSummary
      ? "Comparativa de sesiones · Resumen ejecutivo · Xandralyze"
      : "Comparativa de sesiones · Xandralyze",
    M,
    50 + titleLines.slice(0, 2).length * 20,
  );

  doc.setFontSize(9);
  const meta = [
    `Sesión A: ${data.sessionA.sceneCount} escenas`,
    `Sesión B: ${data.sessionB.sceneCount} escenas`,
    `Generado: ${new Date(data.generatedAt).toLocaleString("es-ES")}`,
  ].join("   ·   ");
  doc.text(meta, M, 112);

  y = 152;
  doc.setTextColor(60);

  heading(data.headline);
  const trim = (t: string, max: number) =>
    t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
  body(data.executiveSummary ? trim(data.summary, 620) : data.summary, { color: 30 });
  if (data.focus) body(`Foco solicitado: ${data.focus}`, { size: 9, color: 120 });

  // Resumen ejecutivo: conclusiones y recomendaciones clave en 1 página
  if (data.executiveSummary) {
    const topPatterns = [...data.patterns]
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 4);

    heading("Conclusiones clave");
    topPatterns.forEach((p, i) => {
      const a = p.sessionAEvidence[0];
      const b = p.sessionBEvidence[0];
      body(`${i + 1}.  ${trim(p.pattern, 120)}  ·  similitud ${p.similarity}/5  ·  ${p.kind}`, {
        size: 9.5,
        color: 30,
        bold: true,
      });
      if (a && b)
        body(
          `A ${formatSec(a.startSec)}–${formatSec(a.endSec)} «${trim(a.sceneTitle, 40)}»   ·   B ${formatSec(
            b.startSec,
          )}–${formatSec(b.endSec)} «${trim(b.sceneTitle, 40)}»`,
          { size: 8.5, color: 120, indent: 12 },
        );
      y += 2;
    });

    if (data.differences.length) {
      heading("Diferencias destacadas");
      data.differences.slice(0, 3).forEach((d) => {
        body(`•  ${trim(d.aspect, 110)}`, { size: 9.5, color: 30, indent: 4 });
      });
    }

    heading("Recomendaciones clave");
    data.recommendations.slice(0, 5).forEach((r, i) => {
      body(`${i + 1}.  ${trim(r, 180)}`, { size: 9.5, color: 30, indent: 4 });
    });

    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("El detalle con todas las evidencias temporales continúa en las páginas siguientes.", M, H - 46);

    doc.addPage();
    y = M + 8;
    doc.setTextColor(60);
    heading("Detalle de patrones y evidencias");
  }

  // Patrones

  data.patterns.forEach((p, i) => {
    heading(`Patrón ${i + 1} · ${p.pattern}`);
    body(`Tipo de momento: ${p.kind}  ·  Similitud ${p.similarity}/5`, { size: 9, color: 120 });

    const side = (label: string, items: typeof p.sessionAEvidence) => {
      y += 4;
      body(label, { size: 10, bold: true, color: 30 });
      items.forEach((e) => {
        body(`[${formatSec(e.startSec)} – ${formatSec(e.endSec)}] ${e.sceneTitle}`, {
          size: 9,
          color: 120,
          indent: 4,
        });
        body(e.observation, { size: 9.5, color: 60, indent: 14 });
        y += 2;
      });
    };
    side(`Evidencias · ${data.sessionA.title}`, p.sessionAEvidence);
    side(`Evidencias · ${data.sessionB.title}`, p.sessionBEvidence);
    y += 8;
  });

  // Diferencias
  if (data.differences.length) {
    heading("Diferencias observables");
    data.differences.forEach((d) => {
      body(d.aspect, { size: 10, bold: true, color: 30 });
      body(`${data.sessionA.title}: ${d.sessionA}`, { size: 9.5, indent: 8 });
      body(`${data.sessionB.title}: ${d.sessionB}`, { size: 9.5, indent: 8 });
      y += 4;
    });
  }

  // Recomendaciones
  if (data.recommendations.length) {
    heading("Recomendaciones");
    data.recommendations.forEach((r) => body(`•  ${r}`, { indent: 8 }));
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("Xandralyze · Comparativa de sesiones: hechos observables con marca de tiempo", M, H - 28);
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
      .slice(0, 32) || "sesion"
  );
}

export function downloadComparisonPdf(data: ComparisonPdfData) {
  generateComparisonPdf(data).save(
    `comparativa${data.executiveSummary ? "-ejecutiva" : ""}-${slug(data.sessionA.title)}-vs-${slug(
      data.sessionB.title,
    )}.pdf`,
  );
}

