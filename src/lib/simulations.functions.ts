import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

// ---------- Generate a simulation with AI ----------

const GenerateInput = z.object({
  title: z.string().min(3).max(200),
  objective: z.string().min(10).max(500),
  prompt: z.string().min(20).max(4000),
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
        evaluation_criteria: output.evaluationCriteria,
        videos: data.videos,
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
