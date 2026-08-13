import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { loadUserKeys } from "./user-keys.functions";

const REPLICATE_DIRECT = "https://api.replicate.com/v1";
const REPLICATE_GATEWAY = "https://connector-gateway.lovable.dev/replicate/v1";
const T2V_MODEL = { owner: "wan-video", name: "wan-2.2-t2v-fast" };
const I2V_MODEL = { owner: "wan-video", name: "wan-2.2-i2v-fast" };
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10;

interface ReplicateAuth {
  base: string;
  headers: Record<string, string>;
}

async function getReplicateAuth(supabase: unknown, userId: string): Promise<ReplicateAuth> {
  const keys = await loadUserKeys(supabase, userId);
  if (!keys.replicateKey) {
    throw new Error("Configura tu token de Replicate en Ajustes para generar vídeo.");
  }
  // If the key came from the platform env (Replicate connector), it is a
  // connection key for the Lovable gateway, not a raw Replicate token.
  const envReplicate = process.env.REPLICATE_API_KEY ?? null;
  const isPlatform = envReplicate !== null && keys.replicateKey === envReplicate;
  if (isPlatform) {
    const lovableKey = process.env.LOVABLE_API_KEY;
    if (!lovableKey) throw new Error("LOVABLE_API_KEY no configurado");
    return {
      base: REPLICATE_GATEWAY,
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": keys.replicateKey,
      },
    };
  }
  return {
    base: REPLICATE_DIRECT,
    headers: { Authorization: `Bearer ${keys.replicateKey}` },
  };
}

/** Upload bytes to Replicate's Files API and return the fetchable URL. */
async function uploadReferenceImage(
  auth: ReplicateAuth,
  buffer: Uint8Array,
  contentType: string,
  filename: string,
): Promise<string> {
  const form = new FormData();
  form.append("content", new Blob([buffer as BlobPart], { type: contentType }), filename);
  const res = await fetch(`${auth.base}/files`, {
    method: "POST",
    headers: auth.headers,
    body: form,
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Replicate files error ${res.status}: ${body.slice(0, 300)}`);
  const json = JSON.parse(body) as { urls: { get: string } };
  return json.urls.get;
}

// ---------- Start a video generation job ----------

const StartInput = z.object({
  prompt: z.string().min(5).max(2000),
  durationSec: z.number().int().min(4).max(10).default(5),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
  /** Optional: character whose image is used as the first frame. */
  characterId: z.string().uuid().optional(),
});

export const startAiVideoGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StartInput.parse(input))
  .handler(async ({ data, context }) => {
    const auth = await getReplicateAuth(context.supabase, context.userId);
    let imageUrl: string | null = null;
    let characterName: string | undefined;

    if (data.characterId) {
      const { data: row, error } = await context.supabase
        .from("simulation_characters")
        .select("name, image_path")
        .eq("id", data.characterId)
        .maybeSingle();
      if (error || !row) throw new Error("Personaje no encontrado");
      characterName = row.name;

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: file, error: dlErr } = await supabaseAdmin.storage
        .from("characters")
        .download(row.image_path);
      if (dlErr || !file) throw new Error(`No se pudo leer la imagen del personaje: ${dlErr?.message ?? ""}`);
      const buf = new Uint8Array(await file.arrayBuffer());
      const contentType = file.type || "image/png";
      const ext = row.image_path.split(".").pop() ?? "png";
      imageUrl = await uploadReferenceImage(auth, buf, contentType, `character.${ext}`);
    }

    const model = imageUrl ? I2V_MODEL : T2V_MODEL;
    // Los modelos wan-2.2-*-fast limitan num_frames (81..100). Para 10 s no se
    // pueden pedir 161 fotogramas: se usa el máximo y se baja el frame rate.
    const isLong = data.durationSec > 5;
    // num_frames debe estar entre 81 y 100; el frame rate se ajusta para
    // aproximar la duración pedida (p. ej. 100 frames a 14 fps ≈ 7 s).
    const numFrames = isLong ? 100 : 81;
    const fps = Math.max(5, Math.min(24, Math.round(numFrames / data.durationSec)));
    const input: Record<string, unknown> = {
      prompt: data.prompt,
      num_frames: numFrames,
      frames_per_second: fps,
    };
    if (imageUrl) {
      input.image = imageUrl;
    } else {
      input.aspect_ratio = data.aspectRatio;
    }

    const post = (payload: Record<string, unknown>) =>
      fetch(`${auth.base}/models/${model.owner}/${model.name}/predictions`, {
        method: "POST",
        headers: { ...auth.headers, "Content-Type": "application/json" },
        body: JSON.stringify({ input: payload }),
      });

    let res = await post(input);
    let body = await res.text();
    if (!res.ok && isLong) {
      // Reintento seguro con los valores por defecto del modelo (~5 s).
      const fallback = { ...input, num_frames: 81, frames_per_second: 16 };
      res = await post(fallback);
      body = await res.text();
    }
    if (!res.ok) {
      throw new Error(`Replicate error ${res.status}: ${body.slice(0, 400)}`);
    }

    const json = JSON.parse(body) as { id: string; status: string };
    return {
      predictionId: json.id,
      status: json.status,
      model: model.name,
      characterName,
    };
  });

// ---------- Poll a video generation job ----------

const PollInput = z.object({
  predictionId: z.string().min(1),
  simulationId: z.string().uuid(),
});

export type JobStage =
  | "queued"
  | "running"
  | "uploading"
  | "finished"
  | "failed";

type PollResult =
  | { status: "pending"; stage: JobStage; progress: number; logsTail?: string; startedAt?: string | null; elapsedSec?: number }
  | { status: "ready"; stage: "finished"; progress: 100; url: string; storagePath: string; elapsedSec?: number }
  | { status: "failed"; stage: "failed"; progress: number; error: string; logsTail?: string };

function tailLogs(logs: string | null | undefined, maxLines = 8): string | undefined {
  if (!logs) return undefined;
  const lines = logs.trim().split(/\r?\n/);
  return lines.slice(-maxLines).join("\n");
}

// Rough progress heuristic: Replicate doesn't expose a percentage for video models.
function estimateProgress(stage: JobStage, elapsedSec: number): number {
  switch (stage) {
    case "queued": return Math.min(10, 2 + elapsedSec);
    case "running": return Math.min(85, 15 + Math.round((elapsedSec / 120) * 70));
    case "uploading": return 92;
    case "finished": return 100;
    case "failed": return 0;
  }
}

export const pollAiVideoGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PollInput.parse(input))
  .handler(async ({ data, context }): Promise<PollResult> => {
    const auth = await getReplicateAuth(context.supabase, context.userId);
    const res = await fetch(`${auth.base}/predictions/${data.predictionId}`, {
      headers: auth.headers,
    });
    const body = await res.text();
    if (!res.ok) {
      return { status: "failed", stage: "failed", progress: 0, error: `Replicate ${res.status}: ${body.slice(0, 200)}` };
    }
    const json = JSON.parse(body) as {
      status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
      output: string | string[] | null;
      error: string | null;
      logs?: string | null;
      created_at?: string | null;
      started_at?: string | null;
      completed_at?: string | null;
    };

    const startedAt = json.started_at ?? json.created_at ?? null;
    const elapsedSec = startedAt ? Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000)) : 0;
    const logsTail = tailLogs(json.logs);

    if (json.status === "failed" || json.status === "canceled") {
      return { status: "failed", stage: "failed", progress: 0, error: json.error ?? json.status, logsTail };
    }
    if (json.status !== "succeeded" || !json.output) {
      const stage: JobStage = json.status === "starting" ? "queued" : "running";
      return {
        status: "pending",
        stage,
        progress: estimateProgress(stage, elapsedSec),
        logsTail,
        startedAt,
        elapsedSec,
      };
    }

    const outputUrl = Array.isArray(json.output) ? json.output[0] : json.output;

    const videoRes = await fetch(outputUrl);
    if (!videoRes.ok) {
      return { status: "failed", stage: "failed", progress: 0, error: `No se pudo descargar el vídeo generado (${videoRes.status})`, logsTail };
    }
    const buf = new Uint8Array(await videoRes.arrayBuffer());

    const storagePath = `ai/${context.userId}/${data.simulationId}/${data.predictionId}.mp4`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: upErr } = await supabaseAdmin.storage
      .from("videos")
      .upload(storagePath, buf, { contentType: "video/mp4", upsert: true });
    if (upErr) return { status: "failed", stage: "failed", progress: 0, error: upErr.message, logsTail };

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("videos")
      .createSignedUrl(storagePath, SIGNED_URL_TTL);
    if (signErr || !signed) return { status: "failed", stage: "failed", progress: 0, error: signErr?.message ?? "sign failed", logsTail };

    // Meter usage: compute wall-clock seconds between started and completed.
    try {
      const startedMs = startedAt ? new Date(startedAt).getTime() : 0;
      const completedMs = json.completed_at ? new Date(json.completed_at).getTime() : Date.now();
      const seconds = startedMs ? Math.max(1, Math.round((completedMs - startedMs) / 1000)) : elapsedSec;
      const { recordUsage, userPaysPlatform } = await import("./usage.server");
      await recordUsage({
        userId: context.userId,
        action: "video",
        provider: "replicate",
        model: "wan-2.2",
        simulationId: data.simulationId,
        seconds,
        paysPlatform: await userPaysPlatform(context.userId),
      });
    } catch (e) { console.error("[video] usage:", e); }

    return { status: "ready", stage: "finished", progress: 100, url: signed.signedUrl, storagePath, elapsedSec };
  });
