import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateObject, NoObjectGeneratedError } from "ai";
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

type GenerateInputData = z.infer<typeof GenerateInput>;

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

type GeneratedStory = z.infer<typeof StorySchema>;

const DEFAULT_CRITERIA = [
  {
    key: "toma_decisiones",
    label: "Toma de decisiones",
    description: "Evalúa la calidad, rapidez y criterio de las decisiones tomadas.",
  },
  {
    key: "comunicacion",
    label: "Comunicación",
    description: "Evalúa claridad, escucha activa y adaptación al interlocutor.",
  },
  {
    key: "gestion_crisis",
    label: "Gestión de crisis",
    description: "Evalúa priorización, calma operativa y resolución ante presión.",
  },
] satisfies GeneratedStory["evaluationCriteria"];

function sanitizeCreatorPrompt(input: string): string {
  return input
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/<[^>]*>/g, " ")
    .split("\n")
    .filter((line) => !/(xmlns|schemas\.microsoft\.com|officedocument|drawingml|cNvPr|grpSpPr|blipFill|custGeom|prstGeom|creationId)/i.test(line))
    .join("\n")
    .replace(/\{[0-9a-fA-F-]{24,}\}/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function createFallbackStory(data: GenerateInputData): GeneratedStory {
  const topic = data.topic || "el contexto planteado";
  const videoRef = data.videos.length > 0 ? "video_1" : null;

  return {
    startNodeId: "inicio",
    evaluationCriteria: DEFAULT_CRITERIA,
    nodes: [
      {
        id: "inicio",
        title: "Inicio de la situación",
        narrative: `Te incorporas a una situación profesional relacionada con ${topic}. El objetivo es demostrar criterio, comunicación y capacidad de reacción alineadas con: ${data.objective}`,
        videoRef,
        isEnding: false,
        endingType: null,
        question: {
          text: "¿Cuál es tu primera actuación?",
          choices: [
            {
              id: "analizar",
              label: "Analizar antes de actuar",
              feedback: "Recopilas información clave, identificas riesgos y preparas una respuesta proporcionada.",
              points: 45,
              next: "gestion",
              competencies: { toma_decisiones: 15, comunicacion: 8, gestion_crisis: 10 },
            },
            {
              id: "improvisar",
              label: "Actuar de inmediato",
              feedback: "La rapidez ayuda, pero al no contrastar datos aumentas el riesgo de una mala decisión.",
              points: 5,
              next: "tension",
              competencies: { toma_decisiones: -8, comunicacion: 0, gestion_crisis: 4 },
            },
            {
              id: "delegar",
              label: "Delegar sin seguimiento",
              feedback: "Delegar puede ser útil, pero hacerlo sin contexto ni control reduce la calidad de la respuesta.",
              points: -10,
              next: "fallo",
              competencies: { toma_decisiones: -12, comunicacion: -6, gestion_crisis: -10 },
            },
          ],
        },
      },
      {
        id: "gestion",
        title: "Gestión del reto",
        narrative: "Con la información inicial sobre la mesa, debes coordinar a las personas implicadas y decidir el siguiente paso operativo.",
        videoRef: null,
        isEnding: false,
        endingType: null,
        question: {
          text: "¿Cómo conduces la respuesta?",
          choices: [
            {
              id: "coordinar",
              label: "Alinear al equipo",
              feedback: "Defines prioridades, comunicas responsabilidades y mantienes seguimiento de los puntos críticos.",
              points: 55,
              next: "exito",
              competencies: { toma_decisiones: 14, comunicacion: 16, gestion_crisis: 14 },
            },
            {
              id: "aislarse",
              label: "Resolverlo en solitario",
              feedback: "Asumes responsabilidad, pero pierdes información del equipo y reduces la velocidad de respuesta.",
              points: 10,
              next: "neutral",
              competencies: { toma_decisiones: 2, comunicacion: -10, gestion_crisis: 0 },
            },
          ],
        },
      },
      {
        id: "tension",
        title: "Escalada de tensión",
        narrative: "La decisión precipitada genera dudas y aparecen señales de conflicto o descoordinación.",
        videoRef: null,
        isEnding: false,
        endingType: null,
        question: {
          text: "¿Cómo corriges el rumbo?",
          choices: [
            {
              id: "rectificar",
              label: "Reconocer y rectificar",
              feedback: "Corriges con transparencia, recuperas parte de la confianza y enfocas al equipo en soluciones.",
              points: 30,
              next: "neutral",
              competencies: { toma_decisiones: 6, comunicacion: 12, gestion_crisis: 8 },
            },
            {
              id: "insistir",
              label: "Mantener la decisión",
              feedback: "Persistir sin nuevas evidencias empeora la situación y deteriora la confianza del equipo.",
              points: -25,
              next: "fallo",
              competencies: { toma_decisiones: -15, comunicacion: -10, gestion_crisis: -12 },
            },
          ],
        },
      },
      {
        id: "exito",
        title: "Resolución sólida",
        narrative: "La situación se resuelve con control, aprendizaje y una comunicación profesional hacia las partes implicadas.",
        videoRef: null,
        question: null,
        isEnding: true,
        endingType: "success",
      },
      {
        id: "neutral",
        title: "Resultado aceptable",
        narrative: "El desenlace evita daños mayores, aunque quedan oportunidades claras de mejora en anticipación y coordinación.",
        videoRef: null,
        question: null,
        isEnding: true,
        endingType: "neutral",
      },
      {
        id: "fallo",
        title: "Resultado insuficiente",
        narrative: "La gestión no logra contener el problema y evidencia carencias relevantes para el objetivo evaluado.",
        videoRef: null,
        question: null,
        isEnding: true,
        endingType: "fail",
      },
    ],
  };
}

function extractJsonText(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  if (fenced) return fenced;

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text;
}

function normalizeStoryFromText(text: string, data: GenerateInputData): GeneratedStory {
  const raw = JSON.parse(extractJsonText(text));
  return normalizeStory(raw, data);
}

type RawRecord = Record<string, unknown>;

function asRecord(value: unknown): RawRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RawRecord)
    : null;
}

function toText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function toId(value: unknown, fallback: string): string {
  return toText(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "") || fallback;
}

function toEndingType(value: unknown, fallback: "success" | "neutral" | "fail") {
  return value === "success" || value === "neutral" || value === "fail" ? value : fallback;
}

function normalizeStory(raw: unknown, data: GenerateInputData): GeneratedStory {
  const fallback = createFallbackStory(data);
  const rawRecord = asRecord(raw);
  const rawNodes = rawRecord?.nodes;
  const nodesInput: RawRecord[] = Array.isArray(rawNodes)
    ? rawNodes.map((node) => asRecord(node) ?? {})
    : asRecord(rawNodes)
      ? Object.entries(asRecord(rawNodes)!).map(([id, node]) => ({ ...(asRecord(node) ?? {}), id }))
      : [];

  if (nodesInput.length < 3) return fallback;

  const originalIds = nodesInput.map((node, i) => toText(node.id, `nodo_${i + 1}`));
  const idMap = new Map<string, string>();
  const used = new Set<string>();

  for (const [i, oldId] of originalIds.entries()) {
    const base = toId(oldId, `nodo_${i + 1}`);
    let id = base;
    let n = 2;
    while (used.has(id)) id = `${base}_${n++}`;
    used.add(id);
    idMap.set(oldId, id);
  }

  const endings = nodesInput.filter((node) => node.isEnding === true || node.question == null);
  const fallbackEndingId = idMap.get(toText(endings[0]?.id, originalIds.at(-1) ?? "exito")) ?? "exito";

  const nodes: GeneratedStory["nodes"] = nodesInput.slice(0, 18).map((node, i) => {
    const oldId = originalIds[i];
    const id = idMap.get(oldId) ?? `nodo_${i + 1}`;
    const rawQuestion = asRecord(node.question);
    const choicesInput = Array.isArray(rawQuestion?.choices) ? rawQuestion.choices.slice(0, 4) : [];
    const isEnding = node.isEnding === true || (!rawQuestion && i > 0);
    const choices = choicesInput.map((choiceInput, choiceIndex) => {
      const choice = asRecord(choiceInput) ?? {};
      const nextRaw = choice.next == null ? null : String(choice.next);
      const next = nextRaw && idMap.has(nextRaw) ? idMap.get(nextRaw)! : fallbackEndingId;
      const rawCompetencies = asRecord(choice.competencies);
      const competencies =
        rawCompetencies
          ? Object.fromEntries(
              Object.entries(rawCompetencies)
                .filter(([, value]) => typeof value === "number" && Number.isFinite(value))
                .map(([key, value]) => [
                  key,
                  Math.max(-20, Math.min(20, Math.round(value as number))),
                ]),
            )
          : { toma_decisiones: 0, comunicacion: 0, gestion_crisis: 0 };

      return {
        id: toText(choice.id, `opcion_${choiceIndex + 1}`),
        label: toText(choice.label, `Opción ${choiceIndex + 1}`).slice(0, 160),
        feedback: toText(
          choice.feedback,
          "La decisión tiene consecuencias en el desarrollo de la simulación.",
        ),
        points:
          typeof choice.points === "number" && Number.isFinite(choice.points)
            ? Math.round(choice.points)
            : 0,
        next,
        competencies,
      };
    });

    return {
      id,
      title: toText(node.title, `Escena ${i + 1}`),
      narrative: toText(
        node.narrative,
        "La situación evoluciona y requiere una decisión profesional.",
      ),
      videoRef: typeof node.videoRef === "string" ? node.videoRef : null,
      question: isEnding
        ? null
        : {
            text: toText(rawQuestion?.text, "¿Qué haces a continuación?"),
            choices:
              choices.length >= 2
                ? choices
                : fallback.nodes[0].question!.choices.slice(0, 2).map((choice) => ({
                    ...choice,
                    next: fallbackEndingId,
                  })),
          },
      isEnding,
      endingType: isEnding
        ? toEndingType(node.endingType, i % 2 === 0 ? "success" : "neutral")
        : null,
    };
  });

  if (nodes.filter((node) => node.isEnding).length < 2) {
    nodes.push(...fallback.nodes.filter((node) => node.isEnding).slice(0, 2));
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  const safeFallbackEndingId = nodes.find((node) => node.isEnding)?.id ?? fallbackEndingId;
  for (const node of nodes) {
    if (!node.question) continue;
    node.question.choices = node.question.choices.map((choice) => ({
      ...choice,
      next: choice.next && nodeIds.has(choice.next) ? choice.next : safeFallbackEndingId,
    }));
  }

  const criteriaInput = Array.isArray(rawRecord?.evaluationCriteria) ? rawRecord.evaluationCriteria : [];
  const evaluationCriteria = criteriaInput
    .map((criterionInput, i) => {
      const criterion = asRecord(criterionInput) ?? {};
      return {
        key: toId(criterion.key, `criterio_${i + 1}`),
        label: toText(criterion.label, `Criterio ${i + 1}`),
        description: toText(
          criterion.description,
          "Criterio de evaluación de la simulación.",
        ),
      };
    })
    .slice(0, 8);

  const story = {
    startNodeId: idMap.get(toText(rawRecord?.startNodeId, "")) ?? nodes[0]?.id ?? fallback.startNodeId,
    nodes,
    evaluationCriteria: evaluationCriteria.length >= 3 ? evaluationCriteria : fallback.evaluationCriteria,
  };

  const parsed = StorySchema.safeParse(story);
  return parsed.success ? parsed.data : fallback;
}

export const generateSimulation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GenerateInput.parse(input))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);
    const sanitizedPrompt = sanitizeCreatorPrompt(data.prompt) || data.prompt;
    const generationData = { ...data, prompt: sanitizedPrompt };

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
${sanitizedPrompt}

VÍDEOS DISPONIBLES PARA REFERENCIAR (usa el id en videoRef):
${videoList}

Devuelve el árbol completo con startNodeId apuntando al primer nodo.`;

    let output: GeneratedStory;
    try {
      const result = await generateObject({
        model: gateway("google/gemini-3-pro-preview"),
        schema: StorySchema,
        system: systemPrompt,
        prompt: userPrompt,
        maxOutputTokens: 65000,
        temperature: 0.25,
        experimental_repairText: async ({ text }) => {
          try {
            return JSON.stringify(normalizeStoryFromText(text, generationData));
          } catch {
            return null;
          }
        },
      });
      output = normalizeStory(result.object, generationData);
    } catch (err) {
      if (!NoObjectGeneratedError.isInstance(err)) throw err;
      try {
        output = err.text
          ? normalizeStoryFromText(err.text, generationData)
          : createFallbackStory(generationData);
      } catch {
        output = createFallbackStory(generationData);
      }
    }

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
        prompt: sanitizedPrompt,
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
    if (!inserted?.id) throw new Error("No se pudo crear la simulación");
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


