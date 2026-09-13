import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  computeSessionMetrics,
  type InteractionNetwork,
  type SessionMetrics,
  type TranscriptSegment,
} from "./analyze-metrics";
import { xdb, xAdminDb } from "./assessments-repo.server";


const TRANSCRIPTION_MODEL = "scribe_v2";
// Límite del proveedor de transcripción (1 GB por archivo).
const MAX_AUDIO_BYTES = 1024 * 1024 * 1024;
// Por encima de este tamaño no descargamos el fichero en el servidor:
// enviamos una URL firmada para que el proveedor lo lea directamente.
const INLINE_UPLOAD_BYTES = 20 * 1024 * 1024;

export interface CaptureAnalysis {
  id: string;
  status: "pending" | "transcribing" | "ready" | "failed";
  stage: string | null;
  errorMessage: string | null;
  transcriptionModel: string | null;
  metrics: SessionMetrics | null;
  interactions: InteractionNetwork | null;
  updatedAt: string;
}

function mapSegment(r: any): TranscriptSegment {
  return {
    id: r.id,
    recordingId: r.recording_id,
    participantId: r.participant_id,
    speakerLabel: r.speaker_label,
    startSec: Number(r.start_sec) || 0,
    endSec: Number(r.end_sec) || 0,
    text: r.text,
  };
}

function mapAnalysis(r: any): CaptureAnalysis {
  const metrics = r.metrics && Object.keys(r.metrics).length > 0 ? (r.metrics as SessionMetrics) : null;
  const interactions =
    r.interactions && Object.keys(r.interactions).length > 0
      ? (r.interactions as InteractionNetwork)
      : null;
  return {
    id: r.id,
    status: r.status,
    stage: r.stage,
    errorMessage: r.error_message,
    transcriptionModel: r.transcription_model,
    metrics,
    interactions,
    updatedAt: r.updated_at,
  };
}

const ANALYSIS_COLUMNS =
  "id, status, stage, error_message, transcription_model, metrics, interactions, updated_at";

/** Devuelve el análisis, los segmentos y las grabaciones ya transcritas de una sesión. */
export const getSessionAnalysis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ captureSessionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const [analysis, segments] = await Promise.all([
      xdb(context)
        .from("capture_analyses")
        .select(ANALYSIS_COLUMNS)
        .eq("capture_session_id", data.captureSessionId)
        .eq("owner_id", context.userId)
        .maybeSingle(),
      xdb(context)
        .from("capture_transcript_segments")
        .select("id, recording_id, participant_id, speaker_label, start_sec, end_sec, text")
        .eq("capture_session_id", data.captureSessionId)
        .eq("owner_id", context.userId)
        .order("start_sec", { ascending: true })
        .limit(3000),
    ]);

    if (analysis.error) throw new Error(analysis.error.message);
    if (segments.error) throw new Error(segments.error.message);

    return {
      analysis: analysis.data ? mapAnalysis(analysis.data) : null,
      segments: (segments.data ?? []).map(mapSegment),
    };
  });

/**
 * Transcribe una grabación con diarización de hablantes y guarda los segmentos.
 * Solo hechos observables: quién habla, cuándo y qué dice.
 */
export const transcribeRecording = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        captureSessionId: z.string().uuid(),
        recordingId: z.string().uuid(),
        languageCode: z.string().max(8).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env["ELEVENLABS_API_KEY"];
    if (!apiKey) throw new Error("Falta la conexión de transcripción. Conéctala en Ajustes.");

    const { data: rec, error: recErr } = await xdb(context)
      .from("capture_recordings")
      .select("id, capture_session_id, storage_path, mime_type, size_bytes, participant_id")
      .eq("id", data.recordingId)
      .eq("capture_session_id", data.captureSessionId)
      .single();
    if (recErr || !rec) throw new Error("Grabación no encontrada");
    const sizeBytes = rec.size_bytes ?? 0;
    if (sizeBytes > MAX_AUDIO_BYTES) {
      throw new Error(
        "La grabación supera 1 GB y el servicio de transcripción no la acepta. Divide la sesión en tramos más cortos.",
      );
    }

    await upsertAnalysis(context, data.captureSessionId, {
      status: "transcribing",
      stage: "Transcribiendo audio",
      error_message: null,
      transcription_model: TRANSCRIPTION_MODEL,
    });

    try {
      const form = new FormData();
      form.append("model_id", TRANSCRIPTION_MODEL);
      form.append("diarize", "true");
      form.append("tag_audio_events", "true");
      if (data.languageCode) form.append("language_code", data.languageCode);

      if (sizeBytes > INLINE_UPLOAD_BYTES) {
        // Grabaciones grandes: el proveedor descarga el fichero desde una URL firmada
        // (evita cargar cientos de MB en memoria del servidor).
        const signed = await xdb(context).storage
          .from("recordings")
          .createSignedUrl(rec.storage_path, 60 * 60);
        if (signed.error || !signed.data?.signedUrl) {
          throw new Error("No se pudo preparar el acceso a la grabación almacenada");
        }
        form.append("cloud_storage_url", signed.data.signedUrl);
      } else {
        const file = await xdb(context).storage.from("recordings").download(rec.storage_path);
        if (file.error || !file.data) throw new Error("No se pudo leer la grabación almacenada");
        form.append("file", file.data, "recording.webm");
      }

      const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
        method: "POST",
        headers: { "xi-api-key": apiKey },
        body: form,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(`[analyze] transcription failed [${res.status}]: ${body}`);
        throw new Error(`La transcripción falló (${res.status}). ${body.slice(0, 300)}`);
      }

      const payload = (await res.json()) as {
        text?: string;
        words?: { text: string; start?: number; end?: number; speaker_id?: string; speaker?: string; type?: string }[];
      };

      const segments = groupWordsIntoTurns(payload.words ?? [], payload.text ?? "");
      if (segments.length === 0) throw new Error("No se detectó voz en la grabación");

      // Reemplaza los segmentos previos de esta grabación.
      await xdb(context)
        .from("capture_transcript_segments")
        .delete()
        .eq("recording_id", rec.id)
        .eq("owner_id", context.userId);

      const rows = segments.map((s) => ({
        capture_session_id: data.captureSessionId,
        recording_id: rec.id,
        owner_id: context.userId,
        // En grabaciones por participante ya conocemos la identidad.
        participant_id: rec.participant_id ?? null,
        speaker_label: rec.participant_id ? null : s.speakerLabel,
        start_sec: s.startSec,
        end_sec: s.endSec,
        text: s.text,
      }));

      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await xdb(context)
          .from("capture_transcript_segments")
          .insert(rows.slice(i, i + 500));
        if (error) throw new Error(error.message);
      }

      await recomputeMetrics(context, data.captureSessionId);
      return { segments: rows.length };
    } catch (err: any) {
      await upsertAnalysis(context, data.captureSessionId, {
        status: "failed",
        stage: null,
        error_message: String(err?.message ?? err).slice(0, 500),
      });
      throw err;
    }
  });

/** Asigna todos los segmentos de una etiqueta de hablante a un participante identificado. */
export const assignSpeaker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        captureSessionId: z.string().uuid(),
        speakerLabel: z.string().min(1).max(80),
        participantId: z.string().uuid().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await xdb(context)
      .from("capture_transcript_segments")
      .update({ participant_id: data.participantId })
      .eq("capture_session_id", data.captureSessionId)
      .eq("owner_id", context.userId)
      .eq("speaker_label", data.speakerLabel);
    if (error) throw new Error(error.message);
    await recomputeMetrics(context, data.captureSessionId);
    return { ok: true };
  });

/** Recalcula métricas y red de interacción a partir de los segmentos guardados. */
export const recomputeSessionMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ captureSessionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    return recomputeMetrics(context, data.captureSessionId);
  });

/** Borra la transcripción y el análisis de la sesión (derecho de supresión). */
export const deleteSessionAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ captureSessionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await xdb(context)
      .from("capture_transcript_segments")
      .delete()
      .eq("capture_session_id", data.captureSessionId)
      .eq("owner_id", context.userId);
    await xdb(context)
      .from("capture_analyses")
      .delete()
      .eq("capture_session_id", data.captureSessionId)
      .eq("owner_id", context.userId);
    return { ok: true };
  });

// ---------- helpers ----------

async function upsertAnalysis(
  context: { supabase: any; userId: string },
  captureSessionId: string,
  patch: Record<string, unknown>,
) {
  const { error } = await xdb(context).from("capture_analyses").upsert(
    {
      capture_session_id: captureSessionId,
      owner_id: context.userId,
      ...patch,
    },
    { onConflict: "capture_session_id" },
  );
  if (error) throw new Error(error.message);
}

async function recomputeMetrics(
  context: { supabase: any; userId: string },
  captureSessionId: string,
) {
  const { data, error } = await xdb(context)
    .from("capture_transcript_segments")
    .select("id, recording_id, participant_id, speaker_label, start_sec, end_sec, text")
    .eq("capture_session_id", captureSessionId)
    .eq("owner_id", context.userId)
    .order("start_sec", { ascending: true })
    .limit(3000);
  if (error) throw new Error(error.message);

  const segments = (data ?? []).map(mapSegment);
  const { metrics, interactions } = computeSessionMetrics(segments);

  await upsertAnalysis(context, captureSessionId, {
    status: segments.length > 0 ? "ready" : "pending",
    stage: null,
    error_message: null,
    metrics: metrics as unknown as Record<string, unknown>,
    interactions: interactions as unknown as Record<string, unknown>,
  });

  return { metrics, interactions, segments: segments.length };
}

/** Agrupa las palabras diarizadas en turnos de palabra por hablante. */
function groupWordsIntoTurns(
  words: { text: string; start?: number; end?: number; speaker_id?: string; speaker?: string; type?: string }[],
  fallbackText: string,
): { speakerLabel: string; startSec: number; endSec: number; text: string }[] {
  const spoken = words.filter((w) => (w.type ?? "word") !== "audio_event" && w.text?.trim());
  if (spoken.length === 0) {
    return fallbackText.trim()
      ? [{ speakerLabel: "speaker_0", startSec: 0, endSec: 0, text: fallbackText.trim() }]
      : [];
  }

  const turns: { speakerLabel: string; startSec: number; endSec: number; text: string }[] = [];
  for (const w of spoken) {
    const label = w.speaker_id ?? w.speaker ?? "speaker_0";
    const start = Number(w.start ?? 0);
    const end = Number(w.end ?? start);
    const last = turns[turns.length - 1];
    // Nuevo turno al cambiar de hablante o tras una pausa larga del mismo hablante.
    if (last && last.speakerLabel === label && start - last.endSec < 1.5) {
      last.text = `${last.text} ${w.text.trim()}`.trim();
      last.endSec = Math.max(last.endSec, end);
    } else {
      turns.push({ speakerLabel: label, startSec: start, endSec: end, text: w.text.trim() });
    }
  }
  return turns.filter((t) => t.text.length > 0);
}
