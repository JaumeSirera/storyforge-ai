import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";

/** Eventos auditables del examen del aspirante. */
export type ExamAuditEvent =
  | "exam_started"
  | "exam_submitted"
  | "exam_auto_submitted"
  | "exam_resubmit_attempt"
  | "exam_submit_rejected_time";

/**
 * Registra un evento de auditoría del examen (fecha/hora, IP, navegador y
 * versión del cliente). Nunca lanza: la auditoría no debe romper la entrega.
 */
export async function logExamAudit(params: {
  ownerId: string;
  assessmentId: string;
  candidateId: string;
  event: ExamAuditEvent;
  clientVersion?: string | null;
  detail?: Record<string, unknown>;
}) {
  try {
    let ip: string | null = null;
    let userAgent: string | null = null;
    try {
      ip = getRequestIP({ xForwardedFor: true }) ?? null;
      userAgent = getRequestHeader("user-agent") ?? null;
    } catch {
      /* fuera de contexto de petición */
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("exam_audit_log").insert({
      owner_id: params.ownerId,
      assessment_id: params.assessmentId,
      candidate_id: params.candidateId,
      event: params.event,
      ip,
      user_agent: userAgent ? userAgent.slice(0, 500) : null,
      client_version: params.clientVersion ? params.clientVersion.slice(0, 80) : null,
      detail: params.detail ?? {},
    });
  } catch {
    /* auditoría best-effort */
  }
}
