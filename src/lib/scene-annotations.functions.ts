import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Anotación del profesional sobre una escena de la película resumen. */
export type SceneAnnotation = {
  id: string;
  sceneIndex: number;
  sceneTitle: string | null;
  startSec: number;
  endSec: number;
  note: string;
  tags: string[];
  updatedAt: string;
};

const COLUMNS = "id, scene_index, scene_title, start_sec, end_sec, note, tags, updated_at";

function mapRow(row: any): SceneAnnotation {
  return {
    id: row.id,
    sceneIndex: row.scene_index,
    sceneTitle: row.scene_title ?? null,
    startSec: Number(row.start_sec) || 0,
    endSec: Number(row.end_sec) || 0,
    note: row.note ?? "",
    tags: Array.isArray(row.tags) ? row.tags : [],
    updatedAt: row.updated_at,
  };
}

/** Lista las notas y etiquetas guardadas de todas las escenas de la sesión. */
export const listSceneAnnotations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ captureSessionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("capture_scene_annotations")
      .select(COLUMNS)
      .eq("capture_session_id", data.captureSessionId)
      .eq("owner_id", context.userId)
      .order("scene_index", { ascending: true });
    if (error) throw new Error(error.message);
    return { annotations: (rows ?? []).map(mapRow) };
  });

/** Guarda (crea o actualiza) la nota y las etiquetas de una escena. */
export const saveSceneAnnotation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        captureSessionId: z.string().uuid(),
        sceneIndex: z.number().int().min(0).max(999),
        sceneTitle: z.string().trim().max(300).optional(),
        startSec: z.number().min(0),
        endSec: z.number().min(0),
        note: z.string().max(4000),
        tags: z.array(z.string().trim().min(1).max(40)).max(20),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const tags = Array.from(new Set(data.tags.map((t) => t.trim()).filter(Boolean))).slice(0, 20);
    const note = data.note.trim();

    if (!note && tags.length === 0) {
      const { error } = await context.supabase
        .from("capture_scene_annotations")
        .delete()
        .eq("capture_session_id", data.captureSessionId)
        .eq("owner_id", context.userId)
        .eq("scene_index", data.sceneIndex);
      if (error) throw new Error(error.message);
      return { annotation: null };
    }

    const { data: row, error } = await context.supabase
      .from("capture_scene_annotations")
      .upsert(
        {
          capture_session_id: data.captureSessionId,
          owner_id: context.userId,
          scene_index: data.sceneIndex,
          scene_title: data.sceneTitle ?? null,
          start_sec: data.startSec,
          end_sec: data.endSec,
          note,
          tags,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "capture_session_id,scene_index" },
      )
      .select(COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return { annotation: mapRow(row) };
  });

/** Borra la anotación de una escena. */
export const deleteSceneAnnotation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ captureSessionId: z.string().uuid(), sceneIndex: z.number().int().min(0) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("capture_scene_annotations")
      .delete()
      .eq("capture_session_id", data.captureSessionId)
      .eq("owner_id", context.userId)
      .eq("scene_index", data.sceneIndex);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
