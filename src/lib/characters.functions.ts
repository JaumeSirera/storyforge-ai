import { createServerFn } from "@tanstack/react-start";
import { requireAnyAuth } from "@/lib/require-auth";
import { z } from "zod";
import { loadUserKeys } from "./user-keys.functions";
import { xdb, xAdminDb } from "./assessments-repo.server";

const SIGNED_URL_TTL = 60 * 60 * 24 * 30; // 30 días

export interface CharacterDTO {
  id: string;
  name: string;
  description: string | null;
  imagePath: string;
  imageUrl: string;
  consentAcknowledged: boolean;
  createdAt: string;
}

export const listCharacters = createServerFn({ method: "GET" })
  .middleware([requireAnyAuth])
  .handler(async ({ context }): Promise<CharacterDTO[]> => {
    const { data, error } = await xdb(context)
      .from("simulation_characters")
      .select("id, name, description, image_path, consent_acknowledged, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const supabaseAdmin = await xAdminDb();
    const results: CharacterDTO[] = [];
    for (const row of data ?? []) {
      const { data: signed } = await supabaseAdmin.storage
        .from("characters")
        .createSignedUrl(row.image_path, SIGNED_URL_TTL);
      results.push({
        id: row.id,
        name: row.name,
        description: row.description,
        imagePath: row.image_path,
        imageUrl: signed?.signedUrl ?? "",
        consentAcknowledged: row.consent_acknowledged,
        createdAt: row.created_at,
      });
    }
    return results;
  });

const CreateInput = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  consent: z.literal(true),
  /** Data URL: "data:image/...;base64,...." */
  imageDataUrl: z.string().min(20),
});

function parseDataUrl(dataUrl: string): { contentType: string; buffer: Uint8Array; ext: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Formato de imagen inválido");
  const contentType = match[1];
  const base64 = match[2];
  const bin = atob(base64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  const ext = contentType.split("/")[1]?.split("+")[0] ?? "png";
  return { contentType, buffer: buf, ext };
}

export const createCharacter = createServerFn({ method: "POST" })
  .middleware([requireAnyAuth])
  .inputValidator((input: unknown) => CreateInput.parse(input))
  .handler(async ({ data, context }): Promise<CharacterDTO> => {
    const { contentType, buffer, ext } = parseDataUrl(data.imageDataUrl);
    if (buffer.byteLength > 8 * 1024 * 1024) throw new Error("La imagen supera 8 MB");

    const supabaseAdmin = await xAdminDb();
    const path = `${context.userId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("characters")
      .upload(path, buffer, { contentType, upsert: false });
    if (upErr) throw new Error(upErr.message);

    const { data: inserted, error } = await xdb(context)
      .from("simulation_characters")
      .insert({
        user_id: context.userId,
        name: data.name,
        description: data.description ?? null,
        image_path: path,
        consent_acknowledged: true,
      })
      .select("id, name, description, image_path, consent_acknowledged, created_at")
      .single();
    if (error) throw new Error(error.message);

    const { data: signed } = await supabaseAdmin.storage
      .from("characters")
      .createSignedUrl(path, SIGNED_URL_TTL);

    return {
      id: inserted.id,
      name: inserted.name,
      description: inserted.description,
      imagePath: inserted.image_path,
      imageUrl: signed?.signedUrl ?? "",
      consentAcknowledged: inserted.consent_acknowledged,
      createdAt: inserted.created_at,
    };
  });

const DeleteInput = z.object({ id: z.string().uuid() });

export const deleteCharacter = createServerFn({ method: "POST" })
  .middleware([requireAnyAuth])
  .inputValidator((input: unknown) => DeleteInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row } = await xdb(context)
      .from("simulation_characters")
      .select("image_path")
      .eq("id", data.id)
      .maybeSingle();

    const { error } = await xdb(context)
      .from("simulation_characters")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    if (row?.image_path) {
      const supabaseAdmin = await xAdminDb();
      await supabaseAdmin.storage.from("characters").remove([row.image_path]);
    }
    return { ok: true };
  });

const GenerateInput = z.object({
  prompt: z.string().min(5).max(1000),
  model: z
    .enum(["gemini-2.5-flash-image-preview", "gemini-2.0-flash-preview-image-generation"])
    .default("gemini-2.5-flash-image-preview"),
});

/**
 * Genera una imagen de personaje ficticio con la clave Gemini del propio usuario.
 * Usa la API nativa de Google (generateContent) porque la salida es multimodal (image+text).
 */
export const generateCharacterImage = createServerFn({ method: "POST" })
  .middleware([requireAnyAuth])
  .inputValidator((input: unknown) => GenerateInput.parse(input))
  .handler(async ({ data, context }): Promise<{ imageDataUrl: string; model: string }> => {
    const keys = await loadUserKeys(xdb(context), context.userId);
    if (!keys.geminiKey) {
      throw new Error("Configura tu clave de Google Gemini en Ajustes para generar imágenes.");
    }

    const systemHint =
      "Genera una fotografía realista de una persona ficticia (que no existe), " +
      "encuadre plano medio, mirando ligeramente a cámara, fondo neutro suave, iluminación natural, " +
      "estilo casting profesional. Descripción:";

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${data.model}:generateContent?key=${encodeURIComponent(keys.geminiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `${systemHint} ${data.prompt}` }] }],
        generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 429) throw new Error("Límite de Gemini alcanzado, prueba en unos segundos.");
      if (res.status === 401 || res.status === 403) throw new Error("Clave Gemini inválida o sin permisos para generar imagen.");
      throw new Error(`Fallo generando imagen (${res.status}): ${txt.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> } }>;
    };
    const parts = json.candidates?.[0]?.content?.parts ?? [];
    const imgPart = parts.find((p) => p.inlineData?.data);
    const b64 = imgPart?.inlineData?.data;
    const mime = imgPart?.inlineData?.mimeType ?? "image/png";
    if (!b64) throw new Error("Gemini no devolvió imagen.");

    try {
      const { recordUsage, userPaysPlatform } = await import("./usage.server");
      await recordUsage({
        userId: context.userId,
        action: "image",
        provider: "gemini",
        model: data.model,
        units: 1,
        paysPlatform: await userPaysPlatform(context.userId),
      });
    } catch (e) { console.error("[img] usage:", e); }

    return { imageDataUrl: `data:${mime};base64,${b64}`, model: data.model };
  });


