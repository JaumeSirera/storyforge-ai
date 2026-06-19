import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

// ---------- Generate a simulation with AI ----------

const GenerateInput = z.object({
  title: z.string().min(3).max(200),
  objective: z.string().min(10).max(500),
  prompt: z.string().min(20).max(60000),
  topic: z.string().max(200).optional(),
  durationMin: z.number().int().min(5).max(60).default(15),
  videos: z
    .array(
      z.object({
        label: z.string(),
        type: z.enum(["youtube", "vimeo", "mp4"]),
        url: z.string().url(),
      }),
    )
    .max(20)
    .default([]),
});

const ChoiceSchema = z.object({
  id: z.string(),
  label: z.string(),
  feedback: z.string(),
  points: z.number(),
  next: z.string().nullable(),
  competencies: z.record(z.string(), z.number()),
});

const NodeSchema = z.object({
  id: z.string(),
  title: z.string(),
  narrative: z.string(),
  videoRef: z.string().nullable(),
  question: z
    .object({
      text: z.string(),
      choices: z.array(ChoiceSchema).min(2).max(4),
    })
    .nullable(),
  isEnding: z.boolean(),
  endingType: z.enum(["success", "neutral", "fail"]).nullable(),
});

const StorySchema = z.object({
  startNodeId: z.string(),
  nodes: z.array(NodeSchema).min(3).max(20),
  evaluationCriteria: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        description: z.string(),
      }),
    )
    .min(3)
    .max(8),
});

export const generateSimulation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GenerateInput.parse(input))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);

    const videoList =
      data.videos.length > 0
        ? data.videos
            .map((v, i) => `${i + 1}. id="video_${i + 1}" (${v.type}) ${v.label} — ${v.url}`)
            .join("\n")
        : "(sin vídeos: usa videoRef=null en todos los nodos)";

    const systemPrompt = `Eres un diseñador experto de simulaciones gamificadas para evaluación, formación y selección de personal. Generas un árbol de decisiones rico, realista y profesionalmente útil.

Tu salida debe seguir el esquema EXACTO solicitado:
- 5 a 12 nodos (escenas). Cada nodo es una escena con narrativa + (opcional) pregunta.
- Solo el nodo inicial NO necesita pregunta si es introductorio; los nodos intermedios SÍ tienen pregunta.
- Cada pregunta tiene 3-4 opciones, cada una con: feedback (qué pasa y por qué), puntos (-30 a +60), y competencias (impacto -20 a +20 en cada competencia evaluada).
- Ramificación REAL: distintas opciones llevan a distintos nodos. Al menos 2 nodos finales (uno con éxito, otro neutro o de fallo).
- isEnding=true en nodos finales; question debe ser null en ellos.
- videoRef: referencia el id de uno de los vídeos disponibles, o null si no encaja.
- Idioma: español.
- 3-6 criterios de evaluación con keys snake_case (ej. liderazgo, comunicacion, toma_decisiones, gestion_crisis, conocimiento_tecnico).`;

    const userPrompt = `Crea una simulación profesional gamificada con estos datos:

TÍTULO: ${data.title}
OBJETIVO: ${data.objective}
TEMA/SECTOR: ${data.topic ?? "(no especificado)"}
DURACIÓN OBJETIVO: ~${data.durationMin} minutos

GUIÓN / CONTEXTO DEL CREADOR:
${data.prompt}

VÍDEOS DISPONIBLES PARA REFERENCIAR (usa el id en videoRef):
${videoList}

Devuelve el árbol completo con startNodeId apuntando al primer nodo.`;

    const { experimental_output: output } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      experimental_output: Output.object({ schema: StorySchema }),
      system: systemPrompt,
      prompt: userPrompt,
    });

    // Convert flat nodes array into the runtime Story shape with embedded video objects.
    const videoMap = new Map(
      data.videos.map((v, i) => [`video_${i + 1}`, v]),
    );
    const nodesRecord: Record<string, unknown> = {};
    for (const n of output.nodes) {
      const vref = n.videoRef && videoMap.get(n.videoRef);
      nodesRecord[n.id] = {
        id: n.id,
        title: n.title,
        narrative: n.narrative,
        video: vref
          ? { type: vref.type, url: vref.url }
          : { type: "none" },
        question: n.isEnding ? undefined : n.question ?? undefined,
        isEnding: n.isEnding,
        endingType: n.endingType ?? undefined,
      };
    }

    const story = {
      startNodeId: output.startNodeId,
      nodes: nodesRecord,
    };

    // Persist the simulation immediately as draft, owned by the caller.
    const { data: inserted, error } = await context.supabase
      .from("simulations")
      .insert({
        owner_id: context.userId,
        title: data.title,
        objective: data.objective,
        prompt: data.prompt,
        topic: data.topic ?? null,
        duration_min: data.durationMin,
        status: "ready",
        story: story as any,
        evaluation_criteria: output.evaluationCriteria as any,
        videos: data.videos as any,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return { id: inserted.id };
  });

// ---------- List simulations of the current user ----------

export const listMySimulations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("simulations")
      .select("id,title,objective,topic,status,is_public,created_at,duration_min")
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---------- Get a simulation by id ----------

export const getSimulation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: sim, error } = await context.supabase
      .from("simulations")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!sim) throw new Error("Simulación no encontrada");
    return sim;
  });

// ---------- Delete a simulation ----------

export const deleteSimulation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("simulations")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Toggle public ----------

export const setSimulationPublic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), isPublic: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("simulations")
      .update({ is_public: data.isPublic })
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Update story / evaluation criteria / videos (manual editor) ----------

const VideoSourceSchema = z.union([
  z.object({ type: z.literal("none") }),
  z.object({
    type: z.enum(["youtube", "vimeo", "mp4"]),
    url: z.string().url(),
    startSec: z.number().optional(),
    endSec: z.number().optional(),
  }),
]);

const EditorChoiceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  feedback: z.string().default(""),
  points: z.number(),
  next: z.string().nullable(),
  competencies: z.record(z.string(), z.number()).default({}),
});

const EditorNodeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  narrative: z.string().default(""),
  video: VideoSourceSchema.default({ type: "none" }),
  question: z
    .object({
      text: z.string().min(1),
      choices: z.array(EditorChoiceSchema).min(2).max(4),
    })
    .optional(),
  isEnding: z.boolean().optional(),
  endingType: z.enum(["success", "neutral", "fail"]).optional(),
});

const EditorStorySchema = z.object({
  startNodeId: z.string().min(1),
  nodes: z.record(z.string(), EditorNodeSchema),
});

const EditorCriterionSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  description: z.string().default(""),
});

const UpdateStoryInput = z.object({
  id: z.string().uuid(),
  story: EditorStorySchema,
  evaluationCriteria: z.array(EditorCriterionSchema).min(1).max(12),
});

export const updateSimulationStory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    UpdateStoryInput.extend({ note: z.string().max(500).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // Integrity checks: startNodeId exists, all "next" refs point to existing nodes or null.
    const ids = new Set(Object.keys(data.story.nodes));
    if (!ids.has(data.story.startNodeId)) {
      throw new Error("startNodeId no existe en los nodos");
    }
    for (const node of Object.values(data.story.nodes)) {
      if (node.question) {
        for (const ch of node.question.choices) {
          if (ch.next !== null && !ids.has(ch.next)) {
            throw new Error(`La opción "${ch.label}" apunta a un nodo inexistente: ${ch.next}`);
          }
        }
      }
    }

    // Block edits when the simulation is locked (in_review or published) and load previous snapshot for diffing.
    const { data: current, error: readErr } = await context.supabase
      .from("simulations")
      .select("status, owner_id, story, evaluation_criteria")
      .eq("id", data.id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!current) throw new Error("Simulación no encontrada");
    if (current.owner_id !== context.userId) throw new Error("No autorizado");
    if (current.status === "in_review" || current.status === "published") {
      throw new Error(
        "La simulación está bloqueada para edición. Vuelve a borrador para hacer cambios.",
      );
    }

    const { error } = await context.supabase
      .from("simulations")
      .update({
        story: data.story as any,
        evaluation_criteria: data.evaluationCriteria as any,
      })
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);

    const summary = diffStory(
      { story: current.story, criteria: current.evaluation_criteria },
      { story: data.story, criteria: data.evaluationCriteria },
    );

    // Only log when something actually changed, to avoid noise from no-op saves.
    if (summary.changed) {
      await logRevision(context, data.id, {
        action: "edit",
        fromStatus: current.status,
        toStatus: current.status,
        note: data.note ?? null,
        summary,
        snapshot: { story: data.story, criteria: data.evaluationCriteria },
      });
    }

    return { ok: true };
  });

// ---------- Review / publish workflow ----------

async function logRevision(
  context: { supabase: any; userId: string },
  simulationId: string,
  entry: {
    action: "edit" | "submit" | "publish" | "revert" | "create";
    fromStatus: string | null;
    toStatus: string | null;
    note?: string | null;
    summary?: Record<string, unknown>;
    snapshot?: Record<string, unknown>;
  },
) {
  await context.supabase.from("simulation_revisions").insert({
    simulation_id: simulationId,
    actor_id: context.userId,
    action: entry.action,
    from_status: entry.fromStatus,
    to_status: entry.toStatus,
    note: entry.note ?? null,
    summary: (entry.summary ?? {}) as any,
    snapshot: (entry.snapshot ?? {}) as any,
  });
}

function diffStory(
  prev: { story: any; criteria: any },
  next: { story: any; criteria: any },
) {
  const prevNodes: Record<string, any> = prev?.story?.nodes ?? {};
  const nextNodes: Record<string, any> = next?.story?.nodes ?? {};
  const prevIds = new Set(Object.keys(prevNodes));
  const nextIds = new Set(Object.keys(nextNodes));

  const addedNodes: string[] = [];
  const removedNodes: string[] = [];
  const modifiedNodes: string[] = [];

  for (const id of nextIds) {
    if (!prevIds.has(id)) addedNodes.push(id);
    else if (JSON.stringify(prevNodes[id]) !== JSON.stringify(nextNodes[id])) modifiedNodes.push(id);
  }
  for (const id of prevIds) if (!nextIds.has(id)) removedNodes.push(id);

  const prevCrit: any[] = Array.isArray(prev?.criteria) ? prev.criteria : [];
  const nextCrit: any[] = Array.isArray(next?.criteria) ? next.criteria : [];
  const prevByKey = new Map(prevCrit.map((c) => [c.key, c]));
  const nextByKey = new Map(nextCrit.map((c) => [c.key, c]));

  const addedCriteria: string[] = [];
  const removedCriteria: string[] = [];
  const modifiedCriteria: string[] = [];
  for (const [k, v] of nextByKey) {
    if (!prevByKey.has(k)) addedCriteria.push(k);
    else if (JSON.stringify(prevByKey.get(k)) !== JSON.stringify(v)) modifiedCriteria.push(k);
  }
  for (const k of prevByKey.keys()) if (!nextByKey.has(k)) removedCriteria.push(k);

  const startChanged = (prev?.story?.startNodeId ?? null) !== (next?.story?.startNodeId ?? null);

  const changed =
    addedNodes.length +
      removedNodes.length +
      modifiedNodes.length +
      addedCriteria.length +
      removedCriteria.length +
      modifiedCriteria.length >
      0 || startChanged;

  return {
    changed,
    addedNodes,
    removedNodes,
    modifiedNodes,
    addedCriteria,
    removedCriteria,
    modifiedCriteria,
    startChanged,
  };
}

async function setStatus(
  context: { supabase: any; userId: string },
  id: string,
  patch: { status: string; is_public?: boolean },
  allowedFrom: string[],
  action: "submit" | "publish" | "revert",
  note?: string | null,
) {
  const { data: current, error: readErr } = await context.supabase
    .from("simulations")
    .select("status, owner_id, story, evaluation_criteria")
    .eq("id", id)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if (!current) throw new Error("Simulación no encontrada");
  if (current.owner_id !== context.userId) throw new Error("No autorizado");
  if (!allowedFrom.includes(current.status)) {
    throw new Error(
      `No se puede pasar a "${patch.status}" desde el estado actual "${current.status}".`,
    );
  }
  const { error } = await context.supabase
    .from("simulations")
    .update(patch)
    .eq("id", id)
    .eq("owner_id", context.userId);
  if (error) throw new Error(error.message);

  await logRevision(context, id, {
    action,
    fromStatus: current.status,
    toStatus: patch.status,
    note: note ?? null,
    snapshot: { story: current.story, criteria: current.evaluation_criteria },
  });

  return { ok: true, status: patch.status };
}

const StatusActionInput = z.object({
  id: z.string().uuid(),
  note: z.string().max(500).optional(),
});

export const submitForReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StatusActionInput.parse(input))
  .handler(({ data, context }) =>
    setStatus(context, data.id, { status: "in_review" }, ["draft", "ready"], "submit", data.note),
  );

export const publishSimulation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StatusActionInput.parse(input))
  .handler(({ data, context }) =>
    setStatus(
      context,
      data.id,
      { status: "published", is_public: true },
      ["in_review"],
      "publish",
      data.note,
    ),
  );

export const revertToDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StatusActionInput.parse(input))
  .handler(({ data, context }) =>
    setStatus(
      context,
      data.id,
      { status: "ready", is_public: false },
      ["in_review", "published"],
      "revert",
      data.note,
    ),
  );

// ---------- List preview-draft sessions for a simulation ----------

export const listPreviewDrafts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ simulationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("sessions")
      .select("id, score, current_node_id, started_at, updated_at, answers, achievements")
      .eq("simulation_id", data.simulationId)
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).filter((r: any) =>
      Array.isArray(r.achievements) && r.achievements.includes("__preview_draft__"),
    );
  });

// ---------- Revision history ----------

export const listSimulationHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ simulationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("simulation_revisions")
      .select("id, actor_id, action, from_status, to_status, note, summary, created_at")
      .eq("simulation_id", data.simulationId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const actorIds = Array.from(new Set((rows ?? []).map((r: any) => r.actor_id)));
    let actors: Record<string, { full_name: string | null; email: string | null }> = {};
    if (actorIds.length > 0) {
      const { data: profiles } = await context.supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", actorIds);
      actors = Object.fromEntries(
        (profiles ?? []).map((p: any) => [p.id, { full_name: p.full_name, email: p.email }]),
      );
    }
    return (rows ?? []).map((r: any) => ({ ...r, actor: actors[r.actor_id] ?? null }));
  });


