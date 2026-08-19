import { jsPDF } from "jspdf";
import { formatSec } from "./analyze-metrics";
import type { SessionScene } from "./scenes.functions";

export interface ScenesPdfSegment {
  startSec: number;
  endSec: number;
  speaker: string;
  text: string;
}

export interface ScenesPdfScene {
  scene: SessionScene;
  segments: ScenesPdfSegment[];
  annotation?: { note?: string; tags?: string[] } | null;
}

export interface ScenesPdfData {
  sessionTitle: string;
  areaLabel?: string | null;
  generatedAt?: string | null;
  kindLabel?: (kind: SessionScene["kind"]) => string;
  scenes: ScenesPdfScene[];
}

/** Exporta la "película resumen": escenas, timestamps, intervenciones y observaciones. */
export function generateScenesPdf(data: ScenesPdfData): jsPDF {
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
  doc.setFontSize(20);
  const titleLines = doc.splitTextToSize(data.sessionTitle, CW) as string[];
  doc.text(titleLines.slice(0, 2), M, 54);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Película resumen · Xandralyze", M, 54 + titleLines.slice(0, 2).length * 22);
  doc.setFontSize(9);
  const meta = [
    data.areaLabel ? `Área: ${data.areaLabel}` : null,
    `Escenas: ${data.scenes.length}`,
    data.generatedAt ? `Generado: ${new Date(data.generatedAt).toLocaleString("es-ES")}` : null,
  ]
    .filter(Boolean)
    .join("   ·   ");
  if (meta) doc.text(meta, M, 112);

  y = 152;
  doc.setTextColor(60);

  // Índice de escenas
  heading("Índice de escenas");
  data.scenes.forEach(({ scene }, i) => {
    const kind = data.kindLabel?.(scene.kind) ?? scene.kind;
    body(
      `${i + 1}. ${formatSec(scene.startSec)} → ${formatSec(scene.endSec)}  ·  ${scene.title}  ·  ${kind}  ·  relevancia ${scene.relevance}/5`,
      { size: 9, color: 80 },
    );
  });

  // Detalle
  data.scenes.forEach(({ scene, segments, annotation }, i) => {
    heading(`Escena ${i + 1} · ${scene.title}`);
    const kind = data.kindLabel?.(scene.kind) ?? scene.kind;
    body(
      `${formatSec(scene.startSec)} → ${formatSec(scene.endSec)}  (${Math.max(0, scene.endSec - scene.startSec)} s)  ·  ${kind}  ·  relevancia ${scene.relevance}/5`,
      { size: 9, color: 120 },
    );
    if (scene.speakers?.length) body(`Intervienen: ${scene.speakers.join(", ")}`, { size: 9, color: 120 });
    y += 4;
    if (scene.why) body(`Por qué es relevante: ${scene.why}`, { color: 30 });

    if (scene.observations?.length) {
      y += 4;
      body("Observaciones objetivas", { size: 10, bold: true, color: 30 });
      scene.observations.forEach((o) => body(`•  ${o}`, { indent: 8 }));
    }

    if (segments.length) {
      y += 6;
      body("Intervenciones", { size: 10, bold: true, color: 30 });
      segments.forEach((s) => {
        body(`[${formatSec(s.startSec)} – ${formatSec(s.endSec)}] ${s.speaker}`, {
          size: 9,
          color: 120,
          indent: 4,
        });
        body(s.text, { size: 9.5, color: 60, indent: 14 });
        y += 2;
      });
    }

    if (annotation && (annotation.note || annotation.tags?.length)) {
      y += 6;
      body("Anotaciones del profesional", { size: 10, bold: true, color: 30 });
      if (annotation.tags?.length) body(`Etiquetas: ${annotation.tags.join("  ·  ")}`, { size: 9, color: 120, indent: 4 });
      if (annotation.note) body(annotation.note, { size: 9.5, indent: 4 });
    }

    y += 8;
  });

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("Xandralyze · Película resumen: momentos observables con marca de tiempo", M, H - 28);
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

export function downloadScenesPdf(data: ScenesPdfData) {
  generateScenesPdf(data).save(`pelicula-resumen-${slug(data.sessionTitle)}.pdf`);
}
