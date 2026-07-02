import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GATEWAY = "https://connector-gateway.lovable.dev/replicate/v1";
// sync.so lipsync-2: fast, high-quality lip-sync. ~$0.05-0.15/s.
const LIPSYNC_MODEL = { owner: "sync", name: "lipsync-2" };
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10;

function gatewayHeaders() {
  const lovable = process.env.LOVABLE_API_KEY;
  const rep = process.env.REPLICATE_API_KEY;
  if (!lovable || !rep) throw new Error("Replicate no está conectado.");
  return {
    Authorization: `Bearer ${lovable}`,
    "X-Connection-Api-Key": rep,
  } as Record<string, string>;
}

/** Estimate lip-sync cost (~$0.10/s of clip). */
export function estimateLipsyncCostUsd(durationSec: number): number {
  return Math.max(0.1, durationSec * 0.1);
}

// ---------- Start ----------

const StartInput = z.object({
  videoUrl: z.string().url(),
  audioUrl: z.string().url(),
});

async function uploadToReplicate(
  url: string,
  contentType: string,
  filename: string,
): Promise<string> {
  const dl = await fetch(url);
  if (!dl.ok) throw new Error(`No se pudo descargar ${filename} (${dl.status})`);
  const buf = new Uint8Array(await dl.arrayBuffer());
  const form = new FormData();
  form.append("content", new Blob([buf as BlobPart], { type: contentType }), filename);
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

export const startLipsync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StartInput.parse(input))
  .handler(async ({ data }) => {
    // Re-hospedar en Replicate Files para evitar bloqueos de Cloudflare al
    // descargar desde URLs firmadas de *.lovable.app / Supabase.
    const [videoRef, audioRef] = await Promise.all([
      uploadToReplicate(data.videoUrl, "video/mp4", "input.mp4"),
      uploadToReplicate(data.audioUrl, "audio/mpeg", "input.mp3"),
    ]);

    const res = await fetch(
      `${GATEWAY}/models/${LIPSYNC_MODEL.owner}/${LIPSYNC_MODEL.name}/predictions`,
      {
        method: "POST",
        headers: { ...gatewayHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          input: {
            video: videoRef,
            audio: audioRef,
            sync_mode: "cut_off",
          },
        }),
      },
    );
    const body = await res.text();
    if (!res.ok) throw new Error(`Replicate error ${res.status}: ${body.slice(0, 400)}`);
    const json = JSON.parse(body) as { id: string; status: string };
    return { predictionId: json.id, status: json.status };
  });

// ---------- Poll ----------

const PollInput = z.object({
  predictionId: z.string().min(1),
  simulationId: z.string().uuid(),
});

type PollResult =
  | { status: "pending"; progress: number; elapsedSec?: number; logsTail?: string }
  | { status: "ready"; progress: 100; url: string; storagePath: string; elapsedSec?: number }
  | { status: "failed"; error: string; logsTail?: string };

function tailLogs(logs: string | null | undefined, maxLines = 6): string | undefined {
  if (!logs) return undefined;
  return logs.trim().split(/\r?\n/).slice(-maxLines).join("\n");
}

export const pollLipsync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PollInput.parse(input))
  .handler(async ({ data, context }): Promise<PollResult> => {
    const res = await fetch(`${GATEWAY}/predictions/${data.predictionId}`, {
      headers: gatewayHeaders(),
    });
    const body = await res.text();
    if (!res.ok) return { status: "failed", error: `Replicate ${res.status}: ${body.slice(0, 200)}` };
    const json = JSON.parse(body) as {
      status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
      output: string | string[] | null;
      error: string | null;
      logs?: string | null;
      started_at?: string | null;
      created_at?: string | null;
    };

    const startedAt = json.started_at ?? json.created_at ?? null;
    const elapsedSec = startedAt
      ? Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000))
      : 0;
    const logsTail = tailLogs(json.logs);

    if (json.status === "failed" || json.status === "canceled") {
      return { status: "failed", error: json.error ?? json.status, logsTail };
    }
    if (json.status !== "succeeded" || !json.output) {
      const progress = json.status === "starting" ? Math.min(10, 2 + elapsedSec) : Math.min(90, 15 + elapsedSec * 2);
      return { status: "pending", progress, elapsedSec, logsTail };
    }

    const outputUrl = Array.isArray(json.output) ? json.output[0] : json.output;
    const videoRes = await fetch(outputUrl);
    if (!videoRes.ok) return { status: "failed", error: `Descarga fallida (${videoRes.status})`, logsTail };
    const buf = new Uint8Array(await videoRes.arrayBuffer());

    const storagePath = `lipsync/${context.userId}/${data.simulationId}/${data.predictionId}.mp4`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: upErr } = await supabaseAdmin.storage
      .from("videos")
      .upload(storagePath, buf, { contentType: "video/mp4", upsert: true });
    if (upErr) return { status: "failed", error: upErr.message, logsTail };

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("videos")
      .createSignedUrl(storagePath, SIGNED_URL_TTL);
    if (signErr || !signed) return { status: "failed", error: signErr?.message ?? "sign failed", logsTail };

    return { status: "ready", progress: 100, url: signed.signedUrl, storagePath, elapsedSec };
  });
