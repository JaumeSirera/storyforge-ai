import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PARTICIPANT_ROLES } from "./capture.functions";

/* ---------------- Anfitrión (propietario de la sesión) ---------------- */

export const listCaptureInvitations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ captureSessionId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("capture_invitations" as any)
      .select("*")
      .eq("capture_session_id", data.captureSessionId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
  });

export const createCaptureInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        captureSessionId: z.string().uuid(),
        participantId: z.string().uuid().nullable().optional(),
        note: z.string().trim().max(200).optional(),
        expiresInDays: z.number().int().min(1).max(365).optional(),
        maxUses: z.number().int().min(1).max(1000).optional(),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    const { data: sess, error: sErr } = await context.supabase
      .from("capture_sessions")
      .select("id")
      .eq("id", data.captureSessionId)
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!sess) throw new Error("Sesión no encontrada");

    const expiresAt = data.expiresInDays
      ? new Date(Date.now() + data.expiresInDays * 86400_000).toISOString()
      : null;

    const { data: row, error } = await context.supabase
      .from("capture_invitations" as any)
      .insert({
        capture_session_id: data.captureSessionId,
        participant_id: data.participantId ?? null,
        owner_id: context.userId,
        token: (await import("./capture-invitations.server")).newCaptureToken(28),
        note: data.note || null,
        expires_at: expiresAt,
        max_uses: data.maxUses ?? null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as any;
  });

export const revokeCaptureInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("capture_invitations" as any)
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCaptureInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("capture_invitations" as any)
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- Participante invitado ---------------- */

/** Público: valida el token y devuelve solo lo necesario para la pantalla de acceso. */
export const validateCaptureInvitation = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) => z.object({ token: z.string().min(8).max(128) }).parse(v))
  .handler(async ({ data }) => {
    const { loadCaptureInvitation } = await import("./capture-invitations.server");
    const { invitation, session } = await loadCaptureInvitation(data.token);
    return {
      invitationId: invitation.id as string,
      assignedParticipantId: (invitation.participant_id ?? null) as string | null,
      note: (invitation.note ?? null) as string | null,
      session: {
        id: session.id as string,
        title: session.title as string,
        mode: session.mode as string,
        captureMode: session.capture_mode as string,
        recordScreen: session.record_screen as boolean,
        consentText: (session.consent_text ?? null) as string | null,
        simulationId: (session.simulation_id ?? null) as string | null,
        retentionDays: session.retention_days as number,
        status: session.status as string,
      },
    };
  });

/** El invitado (autenticado) se une a la sesión: crea/vincula su ficha de participante. */
export const joinCaptureInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        token: z.string().min(8).max(128),
        name: z.string().trim().min(1).max(120),
        role: z.enum(PARTICIPANT_ROLES).optional(),
        consentRecording: z.boolean(),
        consentFaceAnalysis: z.boolean().default(false),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    if (!data.consentRecording) throw new Error("Debes aceptar el consentimiento de grabación");
    const { loadCaptureInvitation } = await import("./capture-invitations.server");
    const { invitation, session } = await loadCaptureInvitation(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // ¿Ya estaba vinculado este usuario?
    const { data: existing } = await supabaseAdmin
      .from("capture_participants")
      .select("id")
      .eq("capture_session_id", session.id)
      .eq("user_id", context.userId)
      .maybeSingle();

    let participantId = (existing as any)?.id as string | undefined;

    if (!participantId && invitation.participant_id) {
      const { data: assigned } = await supabaseAdmin
        .from("capture_participants")
        .select("id, user_id")
        .eq("id", invitation.participant_id)
        .maybeSingle();
      if (assigned && ((assigned as any).user_id == null || (assigned as any).user_id === context.userId)) {
        const { error } = await supabaseAdmin
          .from("capture_participants")
          .update({
            user_id: context.userId,
            joined_at: new Date().toISOString(),
            name: data.name,
            ...(data.role ? { role: data.role } : {}),
          } as any)
          .eq("id", (assigned as any).id);
        if (error) throw new Error(error.message);
        participantId = (assigned as any).id as string;
      }
    }

    if (!participantId) {
      const { data: created, error } = await supabaseAdmin
        .from("capture_participants")
        .insert({
          capture_session_id: session.id,
          owner_id: session.owner_id,
          name: data.name,
          role: data.role ?? "participante",
          is_late: false,
          user_id: context.userId,
          joined_at: new Date().toISOString(),
        } as any)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      participantId = created.id as string;
    }

    await supabaseAdmin.from("capture_consents").insert([
      {
        capture_session_id: session.id,
        participant_id: participantId,
        owner_id: session.owner_id,
        scope: "recording",
        granted: true,
        consent_text: session.consent_text ?? null,
        granted_at: new Date().toISOString(),
      },
      ...(data.consentFaceAnalysis
        ? [
            {
              capture_session_id: session.id,
              participant_id: participantId,
              owner_id: session.owner_id,
              scope: "face_analysis",
              granted: true,
              consent_text: session.consent_text ?? null,
              granted_at: new Date().toISOString(),
            },
          ]
        : []),
    ] as any);

    await supabaseAdmin
      .from("capture_invitations" as any)
      .update({ uses_count: (invitation.uses_count ?? 0) + 1 })
      .eq("id", invitation.id);

    return { participantId, captureSessionId: session.id as string };
  });

/** Estado del invitado al volver al enlace (por si ya se había unido). */
export const getCaptureJoinState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ token: z.string().min(8).max(128) }).parse(v))
  .handler(async ({ data, context }) => {
    const { loadCaptureInvitation } = await import("./capture-invitations.server");
    const { session } = await loadCaptureInvitation(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p } = await supabaseAdmin
      .from("capture_participants")
      .select("id, name, role")
      .eq("capture_session_id", session.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    return {
      captureSessionId: session.id as string,
      participant: (p ?? null) as { id: string; name: string; role: string } | null,
    };
  });

/** El invitado obtiene una URL firmada para subir su grabación al espacio del anfitrión. */
export const createParticipantUploadTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        token: z.string().min(8).max(128),
        kind: z.enum(["camera", "screen", "audio"]),
        ext: z.enum(["webm", "mp4"]).default("webm"),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    const { loadCaptureInvitation, requireLinkedParticipant } = await import("./capture-invitations.server");
    const { session } = await loadCaptureInvitation(data.token);
    const participant = await requireLinkedParticipant(session.id, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `${session.owner_id}/${session.id}/${data.kind}-${participant.id}-${Date.now()}.${data.ext}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from("recordings")
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, uploadToken: signed.token, participantId: participant.id as string };
  });

/** El invitado registra la grabación subida (queda a nombre del anfitrión). */
export const registerParticipantRecording = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        token: z.string().min(8).max(128),
        kind: z.enum(["camera", "screen", "audio"]),
        storagePath: z.string().min(3).max(500),
        mimeType: z.string().max(120).optional(),
        sizeBytes: z.number().int().min(0).optional(),
        durationSec: z.number().min(0).optional(),
        syncOffsetMs: z.number().int().default(0),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    const { loadCaptureInvitation, requireLinkedParticipant } = await import("./capture-invitations.server");
    const { session } = await loadCaptureInvitation(data.token);
    const participant = await requireLinkedParticipant(session.id, context.userId);
    if (!data.storagePath.startsWith(`${session.owner_id}/${session.id}/`)) {
      throw new Error("Ruta de grabación no válida");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("capture_recordings")
      .insert({
        capture_session_id: session.id,
        participant_id: participant.id,
        owner_id: session.owner_id,
        kind: data.kind,
        storage_path: data.storagePath,
        mime_type: data.mimeType ?? null,
        size_bytes: data.sizeBytes ?? null,
        duration_sec: data.durationSec ?? null,
        sync_offset_ms: data.syncOffsetMs,
        status: "uploaded",
      } as any)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

/**
 * Registra (o actualiza) los consentimientos del invitado justo antes de
 * activar cámara y micrófono. Se guarda con permisos del anfitrión porque el
 * invitado no es propietario de la sesión.
 */
export const recordInvitedConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        token: z.string().min(8).max(128),
        recording: z.boolean(),
        faceAnalysis: z.boolean().default(false),
        voiceAnalysis: z.boolean().default(false),
        screen: z.boolean().default(false),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    if (!data.recording) throw new Error("Debes aceptar el consentimiento de grabación");
    const { loadCaptureInvitation, requireLinkedParticipant } = await import(
      "./capture-invitations.server"
    );
    const { session } = await loadCaptureInvitation(data.token);
    const participant = await requireLinkedParticipant(session.id, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const { CONSENT_VERSION } = await import("./consent-version");

    const now = new Date().toISOString();
    const userAgent = getRequestHeader("user-agent") ?? null;
    const scopes: Array<{ scope: string; granted: boolean }> = [
      { scope: "recording", granted: data.recording },
      { scope: "face_analysis", granted: data.faceAnalysis },
      { scope: "voice_analysis", granted: data.voiceAnalysis },
      { scope: "screen", granted: data.screen },
    ];

    const { error } = await supabaseAdmin.from("capture_consents").insert(
      scopes.map((s) => ({
        capture_session_id: session.id,
        participant_id: participant.id,
        owner_id: session.owner_id,
        scope: s.scope,
        granted: s.granted,
        consent_text: session.consent_text ?? null,
        granted_at: s.granted ? now : null,
        consent_version: CONSENT_VERSION,
        user_id: context.userId,
        user_agent: userAgent,
        recorded_at: now,
        source: "invitation",
      })) as any,
    );
    if (error) throw new Error(error.message);
    return { ok: true, participantId: participant.id as string, consentVersion: CONSENT_VERSION };
  });

