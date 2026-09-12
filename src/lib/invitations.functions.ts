import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { xdb, xAdminDb } from "./assessments-repo.server";

function newToken(len = 24) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

/** Owner lists their invitations for a simulation. */
export const listInvitations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ simulationId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await xdb(context)
      .from("simulation_invitations" as any)
      .select("*")
      .eq("simulation_id", data.simulationId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Owner creates an invitation link. */
export const createInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        simulationId: z.string().uuid(),
        note: z.string().trim().max(200).optional(),
        expiresInDays: z.number().int().min(1).max(365).optional(),
        maxUses: z.number().int().min(1).max(10000).optional(),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    // Verify ownership through RLS by inserting; but also compute expiry
    const expiresAt = data.expiresInDays
      ? new Date(Date.now() + data.expiresInDays * 86400_000).toISOString()
      : null;
    const token = newToken(28);
    const { data: row, error } = await xdb(context)
      .from("simulation_invitations" as any)
      .insert({
        simulation_id: data.simulationId,
        token,
        note: data.note || null,
        expires_at: expiresAt,
        max_uses: data.maxUses ?? null,
        created_by: context.userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/** Owner revokes an invitation. */
export const revokeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await xdb(context)
      .from("simulation_invitations" as any)
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Owner deletes an invitation permanently. */
export const deleteInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await xdb(context)
      .from("simulation_invitations" as any)
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Public: validate a token and return a safe subset of the simulation. */
export const validateInvitation = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) => z.object({ token: z.string().min(8).max(128) }).parse(v))
  .handler(async ({ data }) => {
    const supabaseAdmin = await xAdminDb();
    const { data: inv, error } = await supabaseAdmin
      .from("simulation_invitations" as any)
      .select("*")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!inv) throw new Error("Invitación no encontrada");
    const now = Date.now();
    if ((inv as any).revoked_at) throw new Error("Invitación revocada");
    if ((inv as any).expires_at && new Date((inv as any).expires_at).getTime() < now) {
      throw new Error("Invitación caducada");
    }
    if (
      (inv as any).max_uses != null &&
      (inv as any).uses_count >= (inv as any).max_uses
    ) {
      throw new Error("Invitación agotada");
    }

    const { data: sim, error: sErr } = await supabaseAdmin
      .from("simulations")
      .select("id, title, objective, topic, duration_min, cover_image_url, candidate_fields, status")
      .eq("id", (inv as any).simulation_id)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!sim) throw new Error("Simulación no disponible");
    if ((sim as any).status !== "published") {
      throw new Error("La simulación aún no está publicada por el creador");
    }
    return { simulation: sim, invitationId: (inv as any).id };
  });

/** Auth candidate starts a session via invitation token. */
const StartInvitedInput = z.object({
  token: z.string().min(8).max(128),
  candidateName: z.string().trim().min(1).max(200),
  candidateEmail: z.string().trim().email().max(255),
  fieldsData: z.record(z.string(), z.string().max(2000)).default({}),
});

export const startInvitedSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => StartInvitedInput.parse(v))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await xAdminDb();
    const { data: inv, error } = await supabaseAdmin
      .from("simulation_invitations" as any)
      .select("*")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!inv) throw new Error("Invitación no válida");
    const now = Date.now();
    if ((inv as any).revoked_at) throw new Error("Invitación revocada");
    if ((inv as any).expires_at && new Date((inv as any).expires_at).getTime() < now) {
      throw new Error("Invitación caducada");
    }
    if (
      (inv as any).max_uses != null &&
      (inv as any).uses_count >= (inv as any).max_uses
    ) {
      throw new Error("Invitación agotada");
    }

    const { data: sim, error: sErr } = await supabaseAdmin
      .from("simulations")
      .select("id, story, status")
      .eq("id", (inv as any).simulation_id)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!sim) throw new Error("Simulación no encontrada");
    if ((sim as any).status !== "published") {
      throw new Error("La simulación aún no está publicada");
    }
    const startId = ((sim as any).story as { startNodeId?: string })?.startNodeId;
    if (!startId) throw new Error("La simulación no tiene nodo inicial");

    const { data: sess, error: insErr } = await supabaseAdmin
      .from("sessions")
      .insert({
        simulation_id: (inv as any).simulation_id,
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
    if (insErr) throw new Error(insErr.message);

    await supabaseAdmin
      .from("simulation_invitations" as any)
      .update({ uses_count: ((inv as any).uses_count ?? 0) + 1 })
      .eq("id", (inv as any).id);

    return { id: sess.id };
  });
