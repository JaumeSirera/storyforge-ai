/** Registro de auditoría del examen tal y como lo ve el propietario. */
export interface ExamAuditEntry {
  id: string;
  candidateId: string;
  candidateName: string;
  event: string;
  ip: string | null;
  userAgent: string | null;
  clientVersion: string | null;
  detail: Record<string, unknown>;
  createdAt: string;
}

export const EXAM_AUDIT_EVENT_LABELS: Record<string, string> = {
  exam_started: "Examen comenzado",
  exam_submitted: "Examen finalizado",
  exam_auto_submitted: "Entrega automática (tiempo agotado)",
  exam_resubmit_attempt: "Intento de reenvío",
  exam_submit_rejected_time: "Entrega rechazada (fuera de plazo)",
};

export function examAuditLabel(event: string) {
  return EXAM_AUDIT_EVENT_LABELS[event] ?? event;
}

/** Resumen legible del navegador a partir del user-agent. */
export function browserSummary(userAgent: string | null): string {
  if (!userAgent) return "Desconocido";
  const ua = userAgent;
  const browser =
    /Edg\//.test(ua) ? "Edge"
    : /OPR\//.test(ua) ? "Opera"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Firefox\//.test(ua) ? "Firefox"
    : /Safari\//.test(ua) ? "Safari"
    : "Otro";
  const os =
    /Windows/.test(ua) ? "Windows"
    : /Android/.test(ua) ? "Android"
    : /iPhone|iPad|iOS/.test(ua) ? "iOS"
    : /Mac OS X/.test(ua) ? "macOS"
    : /Linux/.test(ua) ? "Linux"
    : "";
  return os ? `${browser} · ${os}` : browser;
}
