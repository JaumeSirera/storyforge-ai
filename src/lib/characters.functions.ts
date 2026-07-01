import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

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
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CharacterDTO[]> => {
    const { data, error } = await context.supabase
      .from("simulation_characters")
      .select("id, name, description, image_path, consent_acknowledged, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateInput.parse(input))
  .handler(async ({ data, context }): Promise<CharacterDTO> => {
    const { contentType, buffer, ext } = parseDataUrl(data.imageDataUrl);
    if (buffer.byteLength > 8 * 1024 * 1024) throw new Error("La imagen supera 8 MB");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `${context.userId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("characters")
      .upload(path, buffer, { contentType, upsert: false });
    if (upErr) throw new Error(upErr.message);

    const { data: inserted, error } = await context.supabase
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
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DeleteInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("simulation_characters")
      .select("image_path")
      .eq("id", data.id)
      .maybeSingle();

    const { error } = await context.supabase
      .from("simulation_characters")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    if (row?.image_path) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.storage.from("characters").remove([row.image_path]);
    }
    return { ok: true };
  });
