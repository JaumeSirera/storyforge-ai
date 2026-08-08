import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Historial de envíos del informe de una sesión (solo el propietario de la simulación). */
export const listReportEmailLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ sessionId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("report_email_log")
      .select("id, recipient, subject, status, attempts, error_message, auto, created_at, updated_at")
      .eq("session_id", data.sessionId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const LogInput = z.object({
  sessionId: z.string().uuid(),
  recipient: z.string().trim().email().max(255),
  subject: z.string().trim().max(300).optional(),
  status: z.enum(["pending", "sent", "failed"]),
  errorMessage: z.string().trim().max(500).optional(),
  auto: z.boolean().default(false),
});

/** Registra (o actualiza sumando un reintento) un envío del informe por email. */
export const logReportEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => LogInput.parse(v))
  .handler(async ({ data, context }) => {
    const { data: sess, error: sErr } = await context.supabase
      .from("sessions")
      .select("id, simulation_id, simulation:simulations(owner_id)")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!sess) throw new Error("Sesión no encontrada");
    if ((sess as any).simulation?.owner_id !== context.userId) {
      throw new Error("Solo el propietario de la simulación puede registrar envíos");
    }

    const { data: existing } = await context.supabase
      .from("report_email_log")
      .select("id, attempts")
      .eq("session_id", data.sessionId)
      .eq("recipient", data.recipient)
      .in("status", ["pending", "failed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const { error } = await context.supabase
        .from("report_email_log")
        .update({
          status: data.status,
          subject: data.subject ?? null,
          error_message: data.errorMessage ?? null,
          attempts: (existing.attempts ?? 0) + (data.status === "pending" ? 0 : 1),
        } as any)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { id: existing.id };
    }

    const { data: row, error } = await context.supabase
      .from("report_email_log")
      .insert({
        session_id: data.sessionId,
        simulation_id: sess.simulation_id,
        owner_id: context.userId,
        recipient: data.recipient,
        subject: data.subject ?? null,
        status: data.status,
        error_message: data.errorMessage ?? null,
        attempts: data.status === "pending" ? 0 : 1,
        auto: data.auto,
      } as any)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

/**
 * Al finalizar la simulación, si el propietario activó el envío automático,
 * deja el informe en cola de envío para el candidato.
 */
export const queueAutoReportEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ sessionId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { data: sess, error } = await context.supabase
      .from("sessions")
      .select("id, user_id, simulation_id, candidate_email, completed_at, simulation:simulations(owner_id, title)")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!sess) return { queued: false, reason: "not_found" as const };

    const ownerId = (sess as any).simulation?.owner_id as string | undefined;
    if (sess.user_id !== context.userId && ownerId !== context.userId) {
      return { queued: false, reason: "forbidden" as const };
    }
    if (!sess.completed_at) return { queued: false, reason: "not_completed" as const };
    const to = (sess.candidate_email ?? "").trim();
    if (!to || !ownerId) return { queued: false, reason: "no_recipient" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cfg } = await supabaseAdmin
      .from("email_settings")
      .select("auto_send_on_complete, subject_template")
      .eq("user_id", ownerId)
      .maybeSingle();
    if (!(cfg as any)?.auto_send_on_complete) return { queued: false, reason: "disabled" as const };

    const { data: already } = await supabaseAdmin
      .from("report_email_log")
      .select("id")
      .eq("session_id", data.sessionId)
      .eq("recipient", to)
      .limit(1)
      .maybeSingle();
    if (already) return { queued: false, reason: "already" as const };

    const subject = ((cfg as any)?.subject_template ?? "Tu informe de la simulación {{simulacion}}")
      .replaceAll("{{simulacion}}", (sess as any).simulation?.title ?? "la simulación");

    const { error: insErr } = await supabaseAdmin.from("report_email_log").insert({
      session_id: data.sessionId,
      simulation_id: sess.simulation_id,
      owner_id: ownerId,
      recipient: to,
      subject,
      status: "pending",
      attempts: 0,
      auto: true,
    } as any);
    if (insErr) throw new Error(insErr.message);
    return { queued: true as const };
  });
