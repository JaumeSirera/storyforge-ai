import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { xdb, xAdminDb } from "./assessments-repo.server";

/** Start a session as a candidate, storing candidate info + custom fields. */
const StartInput = z.object({
  simulationId: z.string().uuid(),
  candidateName: z.string().trim().min(1).max(200),
  candidateEmail: z.string().trim().email().max(255),
  fieldsData: z.record(z.string(), z.string().max(2000)).default({}),
});

export const startCandidateSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => StartInput.parse(v))
  .handler(async ({ data, context }) => {
    // Cualquier participante autenticado puede jugar la simulación, incluso si
    // aún es borrador o no es pública (modo pruebas). Leemos con privilegios de
    // servidor porque RLS oculta los borradores a quien no es propietario.
    const supabaseAdmin = await xAdminDb();
    const { data: sim, error: simErr } = await supabaseAdmin
      .from("simulations")
      .select("id, story")
      .eq("id", data.simulationId)
      .maybeSingle();
    if (simErr) throw new Error(simErr.message);
    if (!sim) throw new Error("Simulación no encontrada");
    const startId = (sim.story as { startNodeId?: string })?.startNodeId;
    if (!startId) throw new Error("La simulación no tiene nodo inicial");

    const { data: sess, error } = await xdb(context)
      .from("sessions")
      .insert({
        simulation_id: data.simulationId,
        user_id: context.userId,
        current_node_id: startId,
        score: 0,
        stars: 0,
        achievements: [],
        answers: [],
        competency_scores: {},
        candidate_name: data.candidateName,
        candidate_email: data.candidateEmail,
        candidate_fields_data: data.fieldsData as any,
      } as any)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: sess.id };
  });

/** Owner: list all sessions run against one of my simulations. */
export const listSimulationSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ simulationId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { data: sim, error: sErr } = await xdb(context)
      .from("simulations")
      .select("id, title, owner_id, candidate_fields")
      .eq("id", data.simulationId)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!sim) throw new Error("Simulación no encontrada");

    const { data: sessions, error } = await xdb(context)
      .from("sessions")
      .select(
        "id, user_id, candidate_name, candidate_email, candidate_fields_data, score, stars, started_at, completed_at, admin_feedback, admin_feedback_at, report, report_email_sent_at, report_email_to",
      )

      .eq("simulation_id", data.simulationId)
      .order("started_at", { ascending: false });
    if (error) throw new Error(error.message);

    // Filter out preview drafts (achievement marker).
    const cleaned = (sessions ?? []).filter((s: any) => {
      const ach = Array.isArray(s.achievements) ? s.achievements : [];
      return !ach.includes("__preview_draft__");
    });

    return { simulation: sim, sessions: cleaned };
  });

/** Owner: get a single session detail (for feedback panel). */
export const getSimulationSessionDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ sessionId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { data: sess, error } = await xdb(context)
      .from("sessions")
      .select("*, simulation:simulations(id, title, owner_id, objective, evaluation_criteria)")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!sess) throw new Error("Sesión no encontrada");
    return sess;
  });

/** Owner submits/updates feedback for a candidate session. RLS allows this via sess_update_owner_of_sim. */
export const submitAdminFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        feedback: z.string().trim().max(5000),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    const { error } = await xdb(context)
      .from("sessions")
      .update({
        admin_feedback: data.feedback || null,
        admin_feedback_at: data.feedback ? new Date().toISOString() : null,
      } as any)
      .eq("id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Registra en la sesión que el informe se ha enviado por correo al candidato. */
export const markReportEmailSent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        to: z.string().trim().email().max(255),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    const { error } = await xdb(context)
      .from("sessions")
      .update({
        report_email_sent_at: new Date().toISOString(),
        report_email_to: data.to,
      } as any)
      .eq("id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Owner updates the list of candidate-info fields asked before playing. */
const FieldSchema = z.object({
  key: z.string().trim().min(1).max(40).regex(/^[a-zA-Z0-9_-]+$/),
  label: z.string().trim().min(1).max(80),
  required: z.boolean().default(false),
});

export const updateCandidateFields = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        simulationId: z.string().uuid(),
        fields: z.array(FieldSchema).max(10),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    const { error } = await xdb(context)
      .from("simulations")
      .update({ candidate_fields: data.fields as any })
      .eq("id", data.simulationId)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Datos mínimos de una simulación para la pantalla previa al juego.
 * Accesible a cualquier usuario autenticado (incluye borradores, para pruebas). */
export const getPlayableSimulation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data }) => {
    const supabaseAdmin = await xAdminDb();
    const { data: sim, error } = await supabaseAdmin
      .from("simulations")
      .select(
        "id, title, objective, topic, duration_min, cover_image_url, candidate_fields, status, is_public",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!sim) throw new Error("Simulación no encontrada");
    return sim;
  });
