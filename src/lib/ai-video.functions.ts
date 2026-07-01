import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GATEWAY = "https://connector-gateway.lovable.dev/replicate/v1";
// wan-2.2 image-to-video / text-to-video "fast" — ~1 min per clip.
const MODEL_OWNER = "wan-video";
const MODEL_NAME = "wan-2.2-t2v-fast";
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

// ---------- Start a video generation job ----------

const StartInput = z.object({
  prompt: z.string().min(5).max(2000),
  durationSec: z.union([z.literal(5), z.literal(10)]).default(5),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
});

export const startAiVideoGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StartInput.parse(input))
  .handler(async ({ data }) => {
    const res = await fetch(
      `${GATEWAY}/models/${MODEL_OWNER}/${MODEL_NAME}/predictions`,
      {
        method: "POST",
        headers: { ...gatewayHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          input: {
            prompt: data.prompt,
            num_frames: data.durationSec === 10 ? 161 : 81,
            aspect_ratio: data.aspectRatio,
          },
        }),
      },
    );
    const body = await res.text();
    if (!res.ok) {
      throw new Error(`Replicate error ${res.status}: ${body.slice(0, 400)}`);
    }
    const json = JSON.parse(body) as { id: string; status: string };
    return { predictionId: json.id, status: json.status };
  });

// ---------- Poll a video generation job ----------

const PollInput = z.object({
  predictionId: z.string().min(1),
  simulationId: z.string().uuid(),
});

type PollResult =
  | { status: "pending" }
  | { status: "ready"; url: string; storagePath: string }
  | { status: "failed"; error: string };

export const pollAiVideoGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PollInput.parse(input))
  .handler(async ({ data, context }): Promise<PollResult> => {
    const res = await fetch(`${GATEWAY}/predictions/${data.predictionId}`, {
      headers: gatewayHeaders(),
    });
    const body = await res.text();
    if (!res.ok) {
      return { status: "failed", error: `Replicate ${res.status}: ${body.slice(0, 200)}` };
    }
    const json = JSON.parse(body) as {
      status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
      output: string | string[] | null;
      error: string | null;
    };

    if (json.status === "failed" || json.status === "canceled") {
      return { status: "failed", error: json.error ?? json.status };
    }
    if (json.status !== "succeeded" || !json.output) {
      return { status: "pending" };
    }

    const outputUrl = Array.isArray(json.output) ? json.output[0] : json.output;

    // Fetch the MP4 and persist it to the private `videos` bucket.
    const videoRes = await fetch(outputUrl);
    if (!videoRes.ok) {
      return { status: "failed", error: `No se pudo descargar el vídeo generado (${videoRes.status})` };
    }
    const buf = new Uint8Array(await videoRes.arrayBuffer());

    const storagePath = `ai/${context.userId}/${data.simulationId}/${data.predictionId}.mp4`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: upErr } = await supabaseAdmin.storage
      .from("videos")
      .upload(storagePath, buf, { contentType: "video/mp4", upsert: true });
    if (upErr) return { status: "failed", error: upErr.message };

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("videos")
      .createSignedUrl(storagePath, SIGNED_URL_TTL);
    if (signErr || !signed) return { status: "failed", error: signErr?.message ?? "sign failed" };

    return { status: "ready", url: signed.signedUrl, storagePath };
  });
