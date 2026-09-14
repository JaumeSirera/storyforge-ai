import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { loadUserKeys } from "./user-keys.functions";
import { xAdminDb } from "./assessments-repo.server";

const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10;

/** Curated voice list surfaced in the editor UI. */
export const TTS_VOICES: Array<{ id: string; name: string; hint?: string }> = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", hint: "Femenina, cálida" },
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", hint: "Femenina, joven" },
  { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica", hint: "Femenina, natural" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", hint: "Femenina, profesional" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", hint: "Masculina, autoritaria" },
  { id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger", hint: "Masculina, cercano" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", hint: "Masculina, presentador" },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian", hint: "Masculina, grave" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam", hint: "Masculina, joven" },
];

const Input = z.object({
  simulationId: z.string().uuid(),
  text: z.string().min(1).max(4000),
  voiceId: z.string().min(3).max(64),
});

export const generateClipDialogue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }): Promise<{ audioUrl: string; audioPath: string }> => {
    const userKeys = await loadUserKeys(context.supabase, context.userId);
    const apiKey = userKeys.elevenlabsKey;
    if (!apiKey) throw new Error("Configura tu clave de ElevenLabs en Ajustes para generar voz.");

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${data.voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: data.text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.35,
            use_speaker_boost: true,
            speed: 1.0,
          },
        }),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      if (res.status === 401) throw new Error("Clave de ElevenLabs inválida.");
      if (res.status === 429) throw new Error("Límite de ElevenLabs alcanzado. Reintenta en unos segundos.");
      throw new Error(`Fallo TTS (${res.status}): ${err.slice(0, 200)}`);
    }

    const buffer = new Uint8Array(await res.arrayBuffer());

    const supabaseAdmin = await xAdminDb();
    const path = `ai-audio/${context.userId}/${data.simulationId}/${crypto.randomUUID()}.mp3`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("videos")
      .upload(path, buffer, { contentType: "audio/mpeg", upsert: false });
    if (upErr) throw new Error(`Storage: ${upErr.message}`);

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("videos")
      .createSignedUrl(path, SIGNED_URL_TTL);
    if (signErr || !signed?.signedUrl) throw new Error("No se pudo firmar la URL del audio.");

    // Meter usage
    try {
      const { recordUsage, userPaysPlatform } = await import("./usage.server");
      await recordUsage({
        userId: context.userId,
        action: "tts",
        provider: "elevenlabs",
        model: "eleven_multilingual_v2",
        simulationId: data.simulationId,
        characters: data.text.length,
        paysPlatform: await userPaysPlatform(context.userId),
      });
    } catch (e) { console.error("[tts] usage:", e); }

    return { audioUrl: signed.signedUrl, audioPath: path };
  });
