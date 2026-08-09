import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Roles disponibles para un participante de la sesión. */
export const PARTICIPANT_ROLES = [
  "candidato",
  "entrevistador",
  "moderador",
  "observador",
  "terapeuta",
  "participante",
  "cliente",
  "otro",
] as const;
export type ParticipantRole = (typeof PARTICIPANT_ROLES)[number];

export const PARTICIPANT_ROLE_LABELS: Record<ParticipantRole, string> = {
  candidato: "Candidato",
  entrevistador: "Entrevistador",
  moderador: "Moderador",
  observador: "Observador",
  terapeuta: "Terapeuta",
  participante: "Participante",
  cliente: "Cliente",
  otro: "Otro",
};

export const CAPTURE_MODES = ["single_device", "per_participant"] as const;
export const SESSION_MODES = ["individual", "group"] as const;

const PARTICIPANT_COLORS = [
  "#2563eb",
  "#16a34a",
  "#ea580c",
  "#9333ea",
  "#0891b2",
  "#dc2626",
  "#ca8a04",
  "#4f46e5",
];

export interface CaptureParticipant {
  id: string;
  name: string;
  identifier: string | null;
  role: ParticipantRole;
  photoPath: string | null;
  color: string | null;
  joinedAtSec: number | null;
  isLate: boolean;
}

export interface CaptureRecording {
  id: string;
  participantId: string | null;
  kind: "camera" | "screen" | "audio";
  storagePath: string;
  mimeType: string | null;
  sizeBytes: number | null;
  durationSec: number | null;
  syncOffsetMs: number;
  status: string;
  createdAt: string;
}

export interface CaptureSession {
  id: string;
  title: string;
  areaKey: string | null;
  simulationId: string | null;
  gameSessionId: string | null;
  mode: "individual" | "group";
  captureMode: "single_device" | "per_participant";
  recordScreen: boolean;
  consentRecording: boolean;
  consentFaceAnalysis: boolean;
  consentText: string | null;
  status: string;
  retentionDays: number;
  deleteAfter: string;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
}

function mapSession(r: any): CaptureSession {
  return {
    id: r.id,
    title: r.title,
    areaKey: r.area_key,
    simulationId: r.simulation_id,
    gameSessionId: r.game_session_id,
    mode: r.mode,
    captureMode: r.capture_mode,
    recordScreen: r.record_screen,
    consentRecording: r.consent_recording,
    consentFaceAnalysis: r.consent_face_analysis,
    consentText: r.consent_text,
    status: r.status,
    retentionDays: r.retention_days,
    deleteAfter: r.delete_after,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    createdAt: r.created_at,
  };
}

const SESSION_COLUMNS =
  "id, title, area_key, simulation_id, game_session_id, mode, capture_mode, record_screen, consent_recording, consent_face_analysis, consent_text, status, retention_days, delete_after, started_at, ended_at, created_at";

// ---------- Sesiones ----------

export const listCaptureSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CaptureSession[]> => {
    const { data, error } = await context.supabase
      .from("capture_sessions")
      .select(SESSION_COLUMNS)
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapSession);
  });

export const getCaptureSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: session, error } = await context.supabase
      .from("capture_sessions")
      .select(SESSION_COLUMNS)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!session) throw new Error("Sesión no encontrada");

    const [{ data: participants }, { data: recordings }] = await Promise.all([
      context.supabase
        .from("capture_participants")
        .select("id, name, identifier, role, photo_path, color, joined_at_sec, is_late")
        .eq("capture_session_id", data.id)
        .order("created_at", { ascending: true }),
      context.supabase
        .from("capture_recordings")
        .select(
          "id, participant_id, kind, storage_path, mime_type, size_bytes, duration_sec, sync_offset_ms, status, created_at",
        )
        .eq("capture_session_id", data.id)
        .order("created_at", { ascending: true }),
    ]);

    return {
      session: mapSession(session),
      participants: (participants ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        identifier: p.identifier,
        role: p.role as ParticipantRole,
        photoPath: p.photo_path,
        color: p.color,
        joinedAtSec: p.joined_at_sec === null ? null : Number(p.joined_at_sec),
        isLate: p.is_late,
      })) as CaptureParticipant[],
      recordings: (recordings ?? []).map((r) => ({
        id: r.id,
        participantId: r.participant_id,
        kind: r.kind as CaptureRecording["kind"],
        storagePath: r.storage_path,
        mimeType: r.mime_type,
        sizeBytes: r.size_bytes === null ? null : Number(r.size_bytes),
        durationSec: r.duration_sec === null ? null : Number(r.duration_sec),
        syncOffsetMs: r.sync_offset_ms,
        status: r.status,
        createdAt: r.created_at,
      })) as CaptureRecording[],
    };
  });

export const createCaptureSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        title: z.string().min(2).max(200),
        areaKey: z.string().max(80).optional(),
        simulationId: z.string().uuid().optional(),
        gameSessionId: z.string().uuid().optional(),
        mode: z.enum(SESSION_MODES).default("individual"),
        captureMode: z.enum(CAPTURE_MODES).default("single_device"),
        recordScreen: z.boolean().default(false),
        retentionDays: z.number().int().min(1).max(365).default(30),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const deleteAfter = new Date(Date.now() + data.retentionDays * 86400_000).toISOString();
    const { data: row, error } = await context.supabase
      .from("capture_sessions")
      .insert({
        owner_id: context.userId,
        title: data.title.trim(),
        area_key: data.areaKey ?? null,
        simulation_id: data.simulationId ?? null,
        game_session_id: data.gameSessionId ?? null,
        mode: data.mode,
        capture_mode: data.captureMode,
        record_screen: data.recordScreen,
        retention_days: data.retentionDays,
        delete_after: deleteAfter,
        status: "draft",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const updateCaptureSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().min(2).max(200).optional(),
        areaKey: z.string().max(80).nullable().optional(),
        mode: z.enum(SESSION_MODES).optional(),
        captureMode: z.enum(CAPTURE_MODES).optional(),
        recordScreen: z.boolean().optional(),
        consentRecording: z.boolean().optional(),
        consentFaceAnalysis: z.boolean().optional(),
        consentText: z.string().max(5000).nullable().optional(),
        status: z.enum(["draft", "ready", "recording", "recorded", "analyzing", "done"]).optional(),
        retentionDays: z.number().int().min(1).max(365).optional(),
        startedAt: z.string().nullable().optional(),
        endedAt: z.string().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, any> = {};
    if (data.title !== undefined) patch.title = data.title.trim();
    if (data.areaKey !== undefined) patch.area_key = data.areaKey;
    if (data.mode !== undefined) patch.mode = data.mode;
    if (data.captureMode !== undefined) patch.capture_mode = data.captureMode;
    if (data.recordScreen !== undefined) patch.record_screen = data.recordScreen;
    if (data.consentRecording !== undefined) patch.consent_recording = data.consentRecording;
    if (data.consentFaceAnalysis !== undefined)
      patch.consent_face_analysis = data.consentFaceAnalysis;
    if (data.consentText !== undefined) patch.consent_text = data.consentText;
    if (data.status !== undefined) patch.status = data.status;
    if (data.startedAt !== undefined) patch.started_at = data.startedAt;
    if (data.endedAt !== undefined) patch.ended_at = data.endedAt;
    if (data.retentionDays !== undefined) {
      patch.retention_days = data.retentionDays;
      patch.delete_after = new Date(Date.now() + data.retentionDays * 86400_000).toISOString();
    }

    const { error } = await context.supabase
      .from("capture_sessions")
      .update(patch)
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCaptureSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: recs } = await context.supabase
      .from("capture_recordings")
      .select("storage_path")
      .eq("capture_session_id", data.id);
    const paths = (recs ?? []).map((r) => r.storage_path).filter(Boolean);
    if (paths.length > 0) await context.supabase.storage.from("recordings").remove(paths);

    const { error } = await context.supabase
      .from("capture_sessions")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Participantes ----------

export const upsertParticipant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        captureSessionId: z.string().uuid(),
        name: z.string().min(1).max(120),
        identifier: z.string().max(60).nullable().optional(),
        role: z.enum(PARTICIPANT_ROLES).default("participante"),
        photoPath: z.string().max(500).nullable().optional(),
        joinedAtSec: z.number().min(0).nullable().optional(),
        isLate: z.boolean().optional(),
        colorIndex: z.number().int().min(0).max(50).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const base = {
      capture_session_id: data.captureSessionId,
      owner_id: context.userId,
      name: data.name.trim(),
      identifier: data.identifier ?? null,
      role: data.role,
      photo_path: data.photoPath ?? null,
      joined_at_sec: data.joinedAtSec ?? null,
      is_late: data.isLate ?? false,
      color: PARTICIPANT_COLORS[(data.colorIndex ?? 0) % PARTICIPANT_COLORS.length],
    };

    if (data.id) {
      const { error } = await context.supabase
        .from("capture_participants")
        .update(base)
        .eq("id", data.id)
        .eq("owner_id", context.userId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    const { data: row, error } = await context.supabase
      .from("capture_participants")
      .insert(base)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deleteParticipant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("capture_participants")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Grabaciones ----------

export const registerRecording = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        captureSessionId: z.string().uuid(),
        participantId: z.string().uuid().nullable().optional(),
        kind: z.enum(["camera", "screen", "audio"]).default("camera"),
        storagePath: z.string().min(3).max(500),
        mimeType: z.string().max(120).optional(),
        sizeBytes: z.number().int().min(0).optional(),
        durationSec: z.number().min(0).optional(),
        syncOffsetMs: z.number().int().default(0),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("capture_recordings")
      .insert({
        capture_session_id: data.captureSessionId,
        participant_id: data.participantId ?? null,
        owner_id: context.userId,
        kind: data.kind,
        storage_path: data.storagePath,
        mime_type: data.mimeType ?? null,
        size_bytes: data.sizeBytes ?? null,
        duration_sec: data.durationSec ?? null,
        sync_offset_ms: data.syncOffsetMs,
        status: "uploaded",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deleteRecording = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rec } = await context.supabase
      .from("capture_recordings")
      .select("storage_path")
      .eq("id", data.id)
      .maybeSingle();
    if (rec?.storage_path) await context.supabase.storage.from("recordings").remove([rec.storage_path]);
    const { error } = await context.supabase
      .from("capture_recordings")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** URL firmada temporal para reproducir una grabación en el navegador. */
export const getRecordingUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rec, error } = await context.supabase
      .from("capture_recordings")
      .select("storage_path")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!rec?.storage_path) throw new Error("Grabación no encontrada");
    const { data: signed, error: sErr } = await context.supabase.storage
      .from("recordings")
      .createSignedUrl(rec.storage_path, 3600);
    if (sErr) throw new Error(sErr.message);
    return { url: signed.signedUrl };
  });

// ---------- Consentimientos ----------

export const recordConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        captureSessionId: z.string().uuid(),
        participantId: z.string().uuid().nullable().optional(),
        scope: z.enum(["recording", "face_analysis", "voice_analysis", "screen"]),
        granted: z.boolean(),
        consentText: z.string().max(5000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("capture_consents").insert({
      capture_session_id: data.captureSessionId,
      participant_id: data.participantId ?? null,
      owner_id: context.userId,
      scope: data.scope,
      granted: data.granted,
      consent_text: data.consentText ?? null,
      granted_at: data.granted ? new Date().toISOString() : null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listConsents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ captureSessionId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("capture_consents")
      .select("id, participant_id, scope, granted, granted_at, created_at")
      .eq("capture_session_id", data.captureSessionId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
