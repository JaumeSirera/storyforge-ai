import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GATEWAY = "https://connector-gateway.lovable.dev/replicate/v1";
// sync.so lipsync-2: fast, high-quality lip-sync. ~$0.05-0.15/s.
const LIPSYNC_MODEL = { owner: "sync", name: "lipsync-2" };
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10;

function gatewayHeaders() {
  const lovable = process.env.LOVABLE_API_KEY;
  const rep = process.env.REPLICATE_API_KEY ?? process.env.LOVABLE_CONNECTOR_REPLICATE_API_KEY;
  if (!lovable || !rep) throw new Error("Replicate no está conectado.");
  return {
    Authorization: `Bearer ${lovable}`,
    "X-Connection-Api-Key": rep,
  } as Record<string, string>;
}

function summarizeProviderError(value: unknown): string {
  const raw = typeof value === "string" ? value : JSON.stringify(value ?? "");
  console.error("[lipsync] provider error:", raw.slice(0, 2000));
  return raw.slice(0, 800);
}

function assertMediaBytes(buffer: Uint8Array, contentType: string, filename: string) {
  const head = new TextDecoder().decode(buffer.slice(0, Math.min(buffer.length, 220))).trim().toLowerCase();
  if (contentType.toLowerCase().includes("text/html") || head.startsWith("<!doctype") || head.startsWith("<html")) {
    throw new Error(`${filename} no es un archivo multimedia válido; se recibió HTML de bloqueo.`);
  }
  if (buffer.byteLength < 1024) {
    throw new Error(`${filename} parece estar vacío o incompleto.`);
  }
}

function storagePathFromSignedUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const path = decodeURIComponent(new URL(url).pathname);
    const match = path.match(/\/storage\/v1\/object\/(?:sign|public)\/videos\/(.+)$/);
    return match?.[1];
  } catch {
    return undefined;
  }
}

async function readMediaAsset(options: {
  storagePath?: string;
  url?: string;
  userId: string;
  allowedPrefixes: string[];
  defaultContentType: string;
  filename: string;
}): Promise<{ buffer: Uint8Array; contentType: string }> {
  const storagePath = options.storagePath ?? storagePathFromSignedUrl(options.url);
  if (storagePath) {
    if (!options.allowedPrefixes.some((prefix) => storagePath.startsWith(prefix))) {
      throw new Error(`${options.filename} no pertenece a tu simulación.`);
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: file, error } = await supabaseAdmin.storage.from("videos").download(storagePath);
    if (error || !file) {
      throw new Error(`No se pudo leer ${options.filename} desde Storage: ${error?.message ?? "sin archivo"}`);
    }
    const buffer = new Uint8Array(await file.arrayBuffer());
    const contentType = file.type || options.defaultContentType;
    assertMediaBytes(buffer, contentType, options.filename);
    return { buffer, contentType };
  }

  if (!options.url) throw new Error(`Falta ${options.filename}.`);
  const dl = await fetch(options.url);
  const contentType = dl.headers.get("content-type") ?? options.defaultContentType;
  const buffer = new Uint8Array(await dl.arrayBuffer());
  if (!dl.ok) throw new Error(`No se pudo descargar ${options.filename} (${dl.status})`);
  assertMediaBytes(buffer, contentType, options.filename);
  return { buffer, contentType };
}

/** Estimate lip-sync cost (~$0.10/s of clip). */
export function estimateLipsyncCostUsd(durationSec: number): number {
  return Math.max(0.1, durationSec * 0.1);
}

// ---------- Start ----------

const StartInput = z.object({
  videoUrl: z.string().url().optional(),
  audioUrl: z.string().url().optional(),
  videoStoragePath: z.string().min(1).optional(),
  audioStoragePath: z.string().min(1).optional(),
}).refine(
  (data) => (data.videoUrl || data.videoStoragePath) && (data.audioUrl || data.audioStoragePath),
  "Faltan el vídeo o el audio para aplicar lip-sync.",
);

async function uploadBytesToReplicate(
  buffer: Uint8Array,
  contentType: string,
  filename: string,
): Promise<string> {
  const form = new FormData();
  form.append("content", new Blob([buffer as BlobPart], { type: contentType }), filename);

  const res = await fetch(`${GATEWAY}/files`, {
    method: "POST",
    headers: gatewayHeaders(),
    body: form,
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Replicate files error ${res.status}: ${summarizeProviderError(body)}`);

  const json = JSON.parse(body) as { urls?: { get?: string } };
  if (!json.urls?.get) throw new Error("Replicate no devolvió URL interna del archivo.");
  return json.urls.get;
}

export const startLipsync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StartInput.parse(input))
  .handler(async ({ data, context }) => {
    // Leer los ficheros desde Storage interno cuando esté disponible. Así no
    // dependemos de URLs firmadas que un WAF pueda interceptar.
    const [videoAsset, audioAsset] = await Promise.all([
      readMediaAsset({
        storagePath: data.videoStoragePath,
        url: data.videoUrl,
        userId: context.userId,
        allowedPrefixes: [`ai/${context.userId}/`, `lipsync/${context.userId}/`],
        defaultContentType: "video/mp4",
        filename: "input.mp4",
      }),
      readMediaAsset({
        storagePath: data.audioStoragePath,
        url: data.audioUrl,
        userId: context.userId,
        allowedPrefixes: [`ai-audio/${context.userId}/`],
        defaultContentType: "audio/mpeg",
        filename: "input.mp3",
      }),
    ]);

    // Subir los bytes a Replicate Files y pasar esas URLs internas al modelo.
    // sync/lipsync-2 espera URLs de archivo; los data URIs grandes fallan en el proveedor.
    const [videoFileUrl, audioFileUrl] = await Promise.all([
      uploadBytesToReplicate(videoAsset.buffer, videoAsset.contentType || "video/mp4", "input.mp4"),
      uploadBytesToReplicate(audioAsset.buffer, audioAsset.contentType || "audio/mpeg", "input.mp3"),
    ]);

    const res = await fetch(
      `${GATEWAY}/models/${LIPSYNC_MODEL.owner}/${LIPSYNC_MODEL.name}/predictions`,
      {
        method: "POST",
        headers: { ...gatewayHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          input: {
            video: videoFileUrl,
            audio: audioFileUrl,
          },
        }),
      },
    );
    const body = await res.text();
    if (!res.ok) throw new Error(`Replicate error ${res.status}: ${summarizeProviderError(body)}`);
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

function outputToUrl(output: unknown): string | null {
  if (typeof output === "string") return output;
  if (Array.isArray(output)) return outputToUrl(output[0]);
  if (output && typeof output === "object") {
    const record = output as { url?: unknown; urls?: { get?: unknown; download?: unknown } };
    if (typeof record.url === "string") return record.url;
    if (typeof record.urls?.download === "string") return record.urls.download;
    if (typeof record.urls?.get === "string") return record.urls.get;
  }
  return null;
}

async function fetchReplicateOutput(url: string): Promise<Response> {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "api.replicate.com" && parsed.pathname.startsWith("/v1/")) {
      const gatewayUrl = `${GATEWAY}${parsed.pathname.slice("/v1".length)}${parsed.search}`;
      return fetch(gatewayUrl, { headers: gatewayHeaders() });
    }
  } catch {
    // Fall through to regular fetch.
  }
  return fetch(url);
}

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
      return { status: "failed", error: summarizeProviderError(json.error ?? json.status), logsTail };
    }
    if (json.status !== "succeeded" || !json.output) {
      const progress = json.status === "starting" ? Math.min(10, 2 + elapsedSec) : Math.min(90, 15 + elapsedSec * 2);
      return { status: "pending", progress, elapsedSec, logsTail };
    }

    const outputUrl = outputToUrl(json.output);
    if (!outputUrl) return { status: "failed", error: "Replicate no devolvió un MP4 final.", logsTail };
    const videoRes = await fetchReplicateOutput(outputUrl);
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
