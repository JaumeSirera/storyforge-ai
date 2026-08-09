import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface PracticeArea {
  id: string;
  key: string;
  label: string;
  description: string | null;
  isDefault: boolean;
}

function slugify(label: string) {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

/** Áreas por defecto + las creadas por el usuario. */
export const listPracticeAreas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PracticeArea[]> => {
    const { data, error } = await context.supabase
      .from("practice_areas")
      .select("id, key, label, description, is_default")
      .order("is_default", { ascending: false })
      .order("label", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id,
      key: r.key,
      label: r.label,
      description: r.description,
      isDefault: r.is_default,
    }));
  });

export const createPracticeArea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        label: z.string().min(2).max(120),
        description: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const key = slugify(data.label);
    if (!key) throw new Error("Nombre de área no válido");
    const { data: row, error } = await context.supabase
      .from("practice_areas")
      .insert({
        user_id: context.userId,
        key,
        label: data.label.trim(),
        description: data.description?.trim() || null,
        is_default: false,
      })
      .select("id, key, label, description, is_default")
      .single();
    if (error) {
      if (error.code === "23505" || /duplicate/i.test(error.message)) {
        throw new Error("Ya existe un área con ese nombre");
      }
      throw new Error(error.message);
    }
    return {
      id: row.id,
      key: row.key,
      label: row.label,
      description: row.description,
      isDefault: row.is_default,
    } satisfies PracticeArea;
  });

export const deletePracticeArea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("practice_areas")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
