import { jsPDF } from "jspdf";
import { CONSENT_SCOPE_LABELS, CONSENT_VERSION } from "./consent-version";

export interface ConsentReceipt {
  sessionTitle: string;
  participantName: string;
  consentText: string;
  /** Alcances con su decisión. */
  scopes: { scope: string; granted: boolean; at?: string | null }[];
  consentVersion?: string;
  retentionDays?: number | null;
  /** Identificador de la sesión de grabación (para trazabilidad). */
  sessionId?: string | null;
  userAgent?: string | null;
}

function fmt(iso?: string | null) {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleString("es-ES", { dateStyle: "long", timeStyle: "medium" });
}

/** Justificante PDF del consentimiento de grabación (para el participante o el anfitrión). */
export function generateConsentPdf(r: ConsentReceipt): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 56;
  const CW = W - M * 2;
  let y = M;

  const line = (text: string, size = 11, bold = false, gap = 6) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, CW) as string[];
    for (const l of lines) {
      if (y > doc.internal.pageSize.getHeight() - M) {
        doc.addPage();
        y = M;
      }
      doc.text(l, M, y);
      y += size * 1.35;
    }
    y += gap;
  };

  line("Justificante de consentimiento de grabación", 18, true, 10);
  line(`Sesión: ${r.sessionTitle}`, 12, true, 2);
  line(`Participante: ${r.participantName || "Sin nombre"}`, 12, false, 2);
  line(`Emitido: ${fmt()}`, 10, false, 2);
  line(`Versión del texto legal: ${r.consentVersion ?? CONSENT_VERSION}`, 10, false, 2);
  if (r.sessionId) line(`Referencia: ${r.sessionId}`, 9, false, 2);
  if (r.retentionDays) line(`Plazo de conservación: ${r.retentionDays} días`, 10, false, 10);

  line("Decisiones", 13, true, 4);
  for (const s of r.scopes) {
    const label = CONSENT_SCOPE_LABELS[s.scope] ?? s.scope;
    line(`${s.granted ? "[SÍ]" : "[NO]"}  ${label}${s.at ? ` · ${fmt(s.at)}` : ""}`, 11, false, 0);
  }
  y += 10;

  line("Texto aceptado", 13, true, 4);
  line(r.consentText, 10, false, 10);

  line(
    "Puedes retirar tu consentimiento y solicitar la eliminación de la grabación en cualquier momento escribiendo al responsable de la sesión. Este documento se genera en tu dispositivo a partir de lo que aceptaste; el registro original queda guardado en la auditoría de consentimientos de la sesión.",
    9,
    false,
    6,
  );
  if (r.userAgent) line(`Dispositivo: ${r.userAgent}`, 8, false, 0);
  return doc;
}

export function downloadConsentPdf(r: ConsentReceipt) {
  const safe = (r.participantName || "participante").replace(/[^\p{L}\p{N}_-]+/gu, "-").slice(0, 40);
  generateConsentPdf(r).save(`consentimiento-${safe}.pdf`);
}
