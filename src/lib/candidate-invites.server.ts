import * as React from "react";
import { render } from "@react-email/render";
import { TEMPLATES } from "./email-templates/registry";

const SITE_NAME = "Xandralyze";
const SITE_URL = "https://xandralyze.com";
const SENDER_DOMAIN = "notify.xandralyze.com";
const FROM_DOMAIN = "xandralyze.com";
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

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
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

/** Encola una invitación individual para un aspirante (una acción → un destinatario). */
async function enqueueInvitation(
  admin: any,
  args: {
    recipient: string;
    messageId: string;
    idempotencyKey: string;
    templateData: Record<string, unknown>;
  },
) {
  const normalized = args.recipient.toLowerCase();

  const { data: suppressed, error: supErr } = await admin
    .from("suppressed_emails")
    .select("id")
    .eq("email", normalized)
    .maybeSingle();
  if (supErr) throw new Error("No se ha podido comprobar la lista de bajas.");
  if (suppressed) {
    await admin.from("email_send_log").insert({
      message_id: args.messageId,
      template_name: TEMPLATE_NAME,
      recipient_email: normalized,
      status: "suppressed",
    });
    return { status: "suppressed" as const, error: "El destinatario se dio de baja de los emails." };
  }

  const { data: existing } = await admin
    .from("email_unsubscribe_tokens")
    .select("token, used_at")
    .eq("email", normalized)
    .maybeSingle();

  let unsubscribeToken: string;
  if (existing?.token && !existing.used_at) {
    unsubscribeToken = existing.token;
  } else {
    unsubscribeToken = randomToken();
    await admin
      .from("email_unsubscribe_tokens")
      .upsert({ token: unsubscribeToken, email: normalized }, { onConflict: "email", ignoreDuplicates: true });
    const { data: stored } = await admin
      .from("email_unsubscribe_tokens")
      .select("token")
      .eq("email", normalized)
      .maybeSingle();
    if (!stored?.token) throw new Error("No se ha podido preparar el enlace de baja.");
    unsubscribeToken = stored.token;
  }

  const entry = TEMPLATES[TEMPLATE_NAME]!;
  const element = React.createElement(entry.component, args.templateData as any);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  const subject =
    typeof entry.subject === "function" ? entry.subject(args.templateData as any) : entry.subject;

  await admin.from("email_send_log").insert({
    message_id: args.messageId,
    template_name: TEMPLATE_NAME,
    recipient_email: normalized,
    status: "pending",
  });

  const { error: qErr } = await admin.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      message_id: args.messageId,
      to: normalized,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text,
      purpose: "transactional",
      label: TEMPLATE_NAME,
      idempotency_key: args.idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  });

  if (qErr) {
    await admin.from("email_send_log").insert({
      message_id: args.messageId,
      template_name: TEMPLATE_NAME,
      recipient_email: normalized,
      status: "failed",
      error_message: qErr.message?.slice(0, 500) ?? "Failed to enqueue email",
    });
    return { status: "failed" as const, error: "No se ha podido poner el email en la cola de envío." };
  }

  return { status: "sent" as const, error: null };
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
    const messageId = crypto.randomUUID();
    let result: { status: "sent" | "failed" | "suppressed"; error: string | null };
    try {
      result = await enqueueInvitation(supabaseAdmin, {
        recipient: c.email,
        messageId,
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
    } catch (e) {
      result = {
        status: "failed",
        error: e instanceof Error ? e.message.slice(0, 400) : "Error desconocido",
      };
    }

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
        message_id: messageId,
        error_message: result.error,
        last_attempt_at: new Date().toISOString(),
      } as any,
      { onConflict: "candidate_id" },
    );
  }

  return { sent, failed, suppressed, skipped };
}
