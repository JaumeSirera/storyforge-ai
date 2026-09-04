import { EmailAPIError } from "@lovable.dev/email-js";
import { sendTemplateEmail } from "./email-templates/send-email";

const SITE_URL = "https://xandralyze.com";
const TEMPLATE_NAME = "exam-invitation";

export interface InviteEmailRow {
  id: string;
  candidateId: string;
  recipient: string;
  status: "pending" | "sent" | "failed" | "suppressed";
  attempts: number;
  errorMessage: string | null;
  lastAttemptAt: string | null;
  updatedAt: string;
}

export function mapInviteEmail(row: any): InviteEmailRow {
  return {
    id: row.id,
    candidateId: row.candidate_id,
    recipient: row.recipient,
    status: row.status,
    attempts: row.attempts ?? 0,
    errorMessage: row.error_message ?? null,
    lastAttemptAt: row.last_attempt_at ?? null,
    updatedAt: row.updated_at,
  };
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat("es-ES", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "Europe/Madrid",
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

/** Envía una invitación individual a un aspirante (una acción → un destinatario). */
async function sendInvitation(
  admin: any,
  args: {
    recipient: string;
    idempotencyKey: string;
    templateData: Record<string, unknown>;
  },
): Promise<{ status: "sent" | "failed" | "suppressed"; error: string | null }> {
  const normalized = args.recipient.toLowerCase();

  const logSend = async (status: string, errorMessage?: string) => {
    const { error } = await admin.from("email_send_log").insert({
      template_name: TEMPLATE_NAME,
      recipient_email: normalized,
      status,
      ...(errorMessage ? { error_message: errorMessage.slice(0, 500) } : {}),
    });
    if (error) {
      console.error("Failed to write email_send_log", {
        code: error.code,
        message: error.message,
      });
    }
  };

  try {
    const result = await sendTemplateEmail(TEMPLATE_NAME, normalized, {
      templateData: args.templateData,
      idempotencyKey: args.idempotencyKey,
    });

    if (!result.sent) {
      await logSend("suppressed");
      return { status: "suppressed", error: "El destinatario se dio de baja de los emails." };
    }

    await logSend("sent");
    return { status: "sent", error: null };
  } catch (e) {
    const message =
      e instanceof EmailAPIError
        ? `${e.code}: ${e.message}`
        : e instanceof Error
          ? e.message
          : "Error desconocido";
    await logSend("failed", message);
    return { status: "failed", error: message.slice(0, 400) };
  }
}

/** Historial de envíos de invitación de una evaluación. */
export async function listInviteEmailsHandler(data: { assessmentId: string }, context: any) {
  const { data: rows, error } = await context.supabase
    .from("candidate_invite_emails")
    .select("id, candidate_id, recipient, status, attempts, error_message, last_attempt_at, updated_at")
    .eq("assessment_id", data.assessmentId);
  if (error) throw new Error(error.message);
  return { logs: (rows ?? []).map(mapInviteEmail) };
}

/**
 * Envía (o reintenta) la invitación por email a los aspirantes indicados,
 * o a todos los inscritos con email cuando no se indica ninguno.
 */
export async function sendInviteEmailsHandler(
  data: { assessmentId: string; candidateIds?: string[]; onlyPendingOrFailed?: boolean },
  context: any,
) {
  const { data: assessment, error: aErr } = await context.supabase
    .from("assessments")
    .select("id, title, instructions, time_limit_min")
    .eq("id", data.assessmentId)
    .eq("owner_id", context.userId)
    .single();
  if (aErr || !assessment) {
    throw new Error("Solo el propietario de la evaluación puede enviar las invitaciones.");
  }

  let query = context.supabase
    .from("assessment_candidates")
    .select("id, name, email, token, expires_at")
    .eq("assessment_id", data.assessmentId);
  if (data.candidateIds?.length) query = query.in("id", data.candidateIds);
  const { data: candidates, error: cErr } = await query;
  if (cErr) throw new Error(cErr.message);

  const withEmail = (candidates ?? []).filter((c: any) => (c.email ?? "").includes("@"));
  const skippedNoEmail = (candidates ?? []).length - withEmail.length;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: existingLogs } = await supabaseAdmin
    .from("candidate_invite_emails")
    .select("candidate_id, status, attempts")
    .eq("assessment_id", data.assessmentId);
  const logByCandidate = new Map(
    (existingLogs ?? []).map((r: any) => [r.candidate_id as string, r]),
  );

  let sent = 0;
  let failed = 0;
  let suppressed = 0;
  let skipped = skippedNoEmail;

  for (const c of withEmail) {
    const prev = logByCandidate.get(c.id);
    if (data.onlyPendingOrFailed && prev && prev.status === "sent") {
      skipped++;
      continue;
    }

    const attempts = (prev?.attempts ?? 0) + 1;
    const result = await sendInvitation(supabaseAdmin, {
      recipient: c.email,
      idempotencyKey: `exam-invite-${c.id}-${attempts}`,
      templateData: {
        candidateName: c.name,
        assessmentTitle: assessment.title,
        examLink: `${SITE_URL}/exam/${c.token}`,
        expiresAt: formatDate(c.expires_at),
        timeLimitMin: (assessment as any).time_limit_min ?? null,
        instructions: (assessment as any).instructions ?? null,
      },
    });

    if (result.status === "sent") sent++;
    else if (result.status === "suppressed") suppressed++;
    else failed++;

    await supabaseAdmin.from("candidate_invite_emails").upsert(
      {
        assessment_id: data.assessmentId,
        candidate_id: c.id,
        owner_id: context.userId,
        recipient: c.email.toLowerCase(),
        status: result.status,
        attempts,
        error_message: result.error,
        last_attempt_at: new Date().toISOString(),
      } as any,
      { onConflict: "candidate_id" },
    );
  }

  return { sent, failed, suppressed, skipped };
}
