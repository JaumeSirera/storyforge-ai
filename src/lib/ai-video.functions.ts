import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GATEWAY = "https://connector-gateway.lovable.dev/replicate/v1";
// Text-to-video: ~1 min. Image-to-video (primer fotograma): ~1 min.
const T2V_MODEL = { owner: "wan-video", name: "wan-2.2-t2v-fast" };
const I2V_MODEL = { owner: "wan-video", name: "wan-2.2-i2v-fast" };
// Signed URL TTL for private-bucket playback (~10 years).
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10;

function gatewayHeaders() {
  const lovable = process.env.LOVABLE_API_KEY;
  const rep = process.env.REPLICATE_API_KEY;
  if (!lovable || !rep) {
    throw new Error("Replicate no está conectado (faltan claves de conexión).");
  }
  return {
    Authorization: `Bearer ${lovable}`,
    "X-Connection-Api-Key": rep,
  } as Record<string, string>;
}

/** Upload bytes to Replicate's Files API through the gateway and return the fetchable URL. */
async function uploadReferenceImage(
  buffer: Uint8Array,
  contentType: string,
  filename: string,
): Promise<string> {
  const form = new FormData();
  form.append("content", new Blob([buffer], { type: contentType }), filename);
  const res = await fetch(`${GATEWAY}/files`, {
    method: "POST",
    headers: gatewayHeaders(),
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
  durationSec: z.union([z.literal(5), z.literal(10)]).default(5),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
  /** Optional: character whose image is used as the first frame. */
  characterId: z.string().uuid().optional(),
});

export const startAiVideoGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StartInput.parse(input))
  .handler(async ({ data, context }) => {
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
      imageUrl = await uploadReferenceImage(buf, contentType, `character.${ext}`);
    }

    const model = imageUrl ? I2V_MODEL : T2V_MODEL;
    const input: Record<string, unknown> = {
      prompt: data.prompt,
      num_frames: data.durationSec === 10 ? 161 : 81,
    };
    if (imageUrl) {
      input.image = imageUrl;
    } else {
      input.aspect_ratio = data.aspectRatio;
    }

    const res = await fetch(
      `${GATEWAY}/models/${model.owner}/${model.name}/predictions`,
      {
        method: "POST",
        headers: { ...gatewayHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      },
    );
    const body = await res.text();
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
    const res = await fetch(`${GATEWAY}/predictions/${data.predictionId}`, {
      headers: gatewayHeaders(),
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

    return { status: "ready", stage: "finished", progress: 100, url: signed.signedUrl, storagePath, elapsedSec };
  });
