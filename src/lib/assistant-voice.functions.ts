import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAnyAuth } from "@/lib/require-auth";

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function errorDetail(res: Response): Promise<string> {
  const body = await res.text().catch(() => "");
  try {
    const j = JSON.parse(body) as { error?: { message?: string }; detail?: { message?: string } | string };
    const m = j.error?.message ?? (typeof j.detail === "string" ? j.detail : j.detail?.message);
    if (m) return `${res.status}: ${m.slice(0, 200)}`;
  } catch {
    /* texto plano */
  }
  return `${res.status}: ${body.slice(0, 200)}`;
}

const VOICE_INSTRUCTIONS =
  "Habla en español de España con acento castellano peninsular. Eres una asistente cercana y profesional: tono cálido, ritmo natural y claro, sin prisas.";

/** Laura (voz femenina) de la biblioteca de ElevenLabs. */
const ELEVEN_VOICE = "FGY2WhTYpPnrIDTdsKH5";

/** Nombre de la voz copiada del saludo en la cuenta de ElevenLabs del usuario. */
export const CLONE_VOICE_NAME = "Xandralyze asistente (voz del saludo)";
const VOICE_ID = /^[A-Za-z0-9]{8,40}$/;

export type AssistantVoiceSetup =
  | { state: "ready"; voiceId: string; created: boolean }
  | { state: "needs-sample" }
  | { state: "unavailable"; message: string };

/**
 * Prepara la voz del saludo en la cuenta de ElevenLabs del propio usuario:
 * si ya existe la reutiliza; si no, y llega la muestra, la crea una sola vez
 * (copia instantánea de voz, que ElevenLabs solo permite en sus planes de pago).
 */
export const assistantPrepareVoice = createServerFn({ method: "POST" })
  .middleware([requireAnyAuth])
  .inputValidator((input: unknown) =>
    z.object({ sample: z.string().min(16).max(2_000_000).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<AssistantVoiceSetup> => {
    const { loadUserKeys } = await import("./user-keys.functions");
    const keys = await loadUserKeys(context.supabase, context.userId);
    const eleven = keys.elevenlabsKey?.trim().replace(/\s+/g, "");
    if (!eleven) return { state: "unavailable", message: "Sin clave de ElevenLabs." };

    const list = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": eleven } });
    if (!list.ok) return { state: "unavailable", message: `ElevenLabs ${await errorDetail(list)}` };
    const voices = ((await list.json()) as { voices?: { voice_id: string; name: string }[] }).voices ?? [];
    const found = voices.find((v) => v.name === CLONE_VOICE_NAME);
    if (found) return { state: "ready", voiceId: found.voice_id, created: false };
    if (!data.sample) return { state: "needs-sample" };

    const form = new FormData();
    form.append("name", CLONE_VOICE_NAME);
    form.append("description", "Voz de la asistente de Xandralyze, copiada de su saludo.");
    form.append("remove_background_noise", "false");
    form.append("files", new Blob([fromBase64(data.sample)], { type: "audio/mpeg" }), "voz-saludo.mp3");
    const res = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: { "xi-api-key": eleven },
      body: form,
    });
    if (!res.ok) {
      const message = `ElevenLabs ${await errorDetail(res)}`;
      console.error("[assistant-voice] clone:", message);
      return { state: "unavailable", message };
    }
    const j = (await res.json()) as { voice_id?: string };
    if (!j.voice_id) return { state: "unavailable", message: "ElevenLabs no devolvió la voz." };
    return { state: "ready", voiceId: j.voice_id, created: true };
  });

export type AssistantSpeech =
  | { ok: true; audio: string; mime: string; provider: "openai" | "elevenlabs" }
  | { ok: false; reason: "no-keys" | "error"; message: string };

/**
 * Voz del asistente con las claves del propio usuario: primero OpenAI y, si
 * falla o no hay clave, ElevenLabs. Devuelve el MP3 en base64; si no hay
 * ninguna clave el navegador usa su propia voz.
 */
export const assistantSpeech = createServerFn({ method: "POST" })
  .middleware([requireAnyAuth])
  .inputValidator((input: unknown) => z
      .object({ text: z.string().trim().min(1).max(2400), voiceId: z.string().regex(VOICE_ID).optional() })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<AssistantSpeech> => {
    const { loadUserKeys } = await import("./user-keys.functions");
    const keys = await loadUserKeys(context.supabase, context.userId);
    const openai = keys.openaiKey?.trim();
    const eleven = keys.elevenlabsKey?.trim().replace(/\s+/g, "");
    if (!openai && !eleven) {
      return { ok: false, reason: "no-keys", message: "Sin clave de OpenAI ni de ElevenLabs." };
    }
    const errors: string[] = [];

    // La voz del saludo (copiada en su ElevenLabs) va primero para que suene igual.
    if (eleven && data.voiceId) {
      try {
        const res = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${data.voiceId}?output_format=mp3_44100_64`,
          {
            method: "POST",
            headers: { "xi-api-key": eleven, "Content-Type": "application/json" },
            body: JSON.stringify({
              text: data.text,
              model_id: "eleven_multilingual_v2",
              voice_settings: { stability: 0.5, similarity_boost: 0.9, style: 0, use_speaker_boost: true },
            }),
          },
        );
        if (res.ok) return { ok: true, audio: toBase64(await res.arrayBuffer()), mime: "audio/mpeg", provider: "elevenlabs" };
        errors.push(`ElevenLabs (voz del saludo) ${await errorDetail(res)}`);
      } catch (e) {
        errors.push(`ElevenLabs (voz del saludo): ${String((e as Error)?.message ?? e)}`);
      }
    }

    if (openai) {
      try {
        const res = await fetch("https://api.openai.com/v1/audio/speech", {
          method: "POST",
          headers: { Authorization: `Bearer ${openai}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gpt-4o-mini-tts",
            voice: "coral",
            input: data.text,
            instructions: VOICE_INSTRUCTIONS,
            response_format: "mp3",
          }),
        });
        if (res.ok) return { ok: true, audio: toBase64(await res.arrayBuffer()), mime: "audio/mpeg", provider: "openai" };
        errors.push(`OpenAI ${await errorDetail(res)}`);
      } catch (e) {
        errors.push(`OpenAI: ${String((e as Error)?.message ?? e)}`);
      }
    }

    if (eleven) {
      try {
        const res = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE}?output_format=mp3_44100_64`,
          {
            method: "POST",
            headers: { "xi-api-key": eleven, "Content-Type": "application/json" },
            body: JSON.stringify({
              text: data.text,
              model_id: "eleven_flash_v2_5",
              language_code: "es",
              voice_settings: { stability: 0.5, similarity_boost: 0.75 },
            }),
          },
        );
        if (res.ok) return { ok: true, audio: toBase64(await res.arrayBuffer()), mime: "audio/mpeg", provider: "elevenlabs" };
        errors.push(`ElevenLabs ${await errorDetail(res)}`);
      } catch (e) {
        errors.push(`ElevenLabs: ${String((e as Error)?.message ?? e)}`);
      }
    }

    console.error("[assistant-voice] tts:", errors.join(" | "));
    return { ok: false, reason: "error", message: errors.join(" | ") };
  });

export type AssistantTranscript =
  | { ok: true; text: string }
  | { ok: false; reason: "no-keys" | "error"; message: string };

/**
 * Dictado por voz para navegadores sin reconocimiento propio (Firefox, algunos
 * iPhone): transcribe la grabación con OpenAI o, si falla, con ElevenLabs.
 */
export const assistantTranscribe = createServerFn({ method: "POST" })
  .middleware([requireAnyAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        audio: z.string().min(16).max(6_000_000),
        mime: z.string().max(80).default("audio/webm"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<AssistantTranscript> => {
    const { loadUserKeys } = await import("./user-keys.functions");
    const keys = await loadUserKeys(context.supabase, context.userId);
    const openai = keys.openaiKey?.trim();
    const eleven = keys.elevenlabsKey?.trim().replace(/\s+/g, "");
    if (!openai && !eleven) {
      return {
        ok: false,
        reason: "no-keys",
        message: "Para dictar en este navegador necesito tu clave de OpenAI o de ElevenLabs en «Ajustes».",
      };
    }
    const mime = data.mime.split(";")[0].trim() || "audio/webm";
    const ext = mime.includes("ogg") ? "ogg" : mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac") ? "m4a" : mime.includes("wav") ? "wav" : "webm";
    const bytes = fromBase64(data.audio);
    const file = () => new Blob([bytes], { type: mime });
    const errors: string[] = [];

    if (openai) {
      try {
        const form = new FormData();
        form.append("file", file(), `voz.${ext}`);
        form.append("model", "gpt-4o-mini-transcribe");
        form.append("language", "es");
        const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${openai}` },
          body: form,
        });
        if (res.ok) {
          const j = (await res.json()) as { text?: string };
          return { ok: true, text: String(j.text ?? "").trim() };
        }
        errors.push(`OpenAI ${await errorDetail(res)}`);
      } catch (e) {
        errors.push(`OpenAI: ${String((e as Error)?.message ?? e)}`);
      }
    }

    if (eleven) {
      try {
        const form = new FormData();
        form.append("file", file(), `voz.${ext}`);
        form.append("model_id", "scribe_v1");
        form.append("language_code", "spa");
        const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
          method: "POST",
          headers: { "xi-api-key": eleven },
          body: form,
        });
        if (res.ok) {
          const j = (await res.json()) as { text?: string };
          return { ok: true, text: String(j.text ?? "").trim() };
        }
        errors.push(`ElevenLabs ${await errorDetail(res)}`);
      } catch (e) {
        errors.push(`ElevenLabs: ${String((e as Error)?.message ?? e)}`);
      }
    }

    console.error("[assistant-voice] stt:", errors.join(" | "));
    return { ok: false, reason: "error", message: "No he podido entender la grabación. Prueba otra vez o escríbelo." };
  });
