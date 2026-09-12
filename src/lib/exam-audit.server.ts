import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { assessDb, assessAdminDb } from "./assessments-repo.server";

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

    const supabaseAdmin = await assessAdminDb();
    await supabaseAdmin.from("exam_audit_log").insert({
      owner_id: params.ownerId,
      assessment_id: params.assessmentId,
      candidate_id: params.candidateId,
      event: params.event,
      ip,
      user_agent: userAgent ? userAgent.slice(0, 500) : null,
      client_version: params.clientVersion ? params.clientVersion.slice(0, 80) : null,
      detail: (params.detail ?? {}) as never,
    });
  } catch {
    /* auditoría best-effort */
  }
}

/** Lista el log de auditoría de una evaluación (solo su propietario). */
export async function listExamAuditHandler(
  data: { assessmentId: string; candidateId?: string | null },
  context: any,
) {
  const { data: assessment, error: aErr } = await assessDb(context)
    .from("assessments")
    .select("id")
    .eq("id", data.assessmentId)
    .eq("owner_id", context.userId)
    .maybeSingle();
  if (aErr) throw new Error(aErr.message);
  if (!assessment)
    throw new Error("Solo el propietario de la evaluación puede consultar el log de auditoría.");

  let query = assessDb(context)
    .from("exam_audit_log")
    .select("id, candidate_id, event, ip, user_agent, client_version, detail, created_at")
    .eq("assessment_id", data.assessmentId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (data.candidateId) query = query.eq("candidate_id", data.candidateId);

  const { data: rows, error } = await query;
  if (error) throw new Error(error.message);

  const { data: candidates } = await assessDb(context)
    .from("assessment_candidates")
    .select("id, name")
    .eq("assessment_id", data.assessmentId);
  const names = new Map<string, string>((candidates ?? []).map((c: any) => [c.id, c.name]));

  return {
    entries: (rows ?? []).map((r: any) => ({
      id: r.id,
      candidateId: r.candidate_id,
      candidateName: names.get(r.candidate_id) ?? "Aspirante eliminado",
      event: r.event,
      ip: r.ip ?? null,
      userAgent: r.user_agent ?? null,
      clientVersion: r.client_version ?? null,
      detail: (r.detail ?? {}) as Record<string, unknown>,
      createdAt: r.created_at,
    })),
  };
}
