import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, Output } from "ai";
import { z } from "zod";
import { resolveUserTextModel } from "./ai-gateway.server";
import { loadUserKeys } from "./user-keys.functions";

// Start a new session for a simulation.
export const startSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ simulationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: sim, error: simErr } = await context.supabase
      .from("simulations")
      .select("id, story")
      .eq("id", data.simulationId)
      .maybeSingle();
    if (simErr) throw new Error(simErr.message);
    if (!sim) throw new Error("Simulación no encontrada");

    const startId = (sim.story as { startNodeId?: string })?.startNodeId;
    if (!startId) throw new Error("La simulación no tiene nodo inicial");

    const { data: sess, error } = await context.supabase
      .from("sessions")
      .insert({
        simulation_id: data.simulationId,
        user_id: context.userId,
        current_node_id: startId,
        score: 0,
        stars: 0,
        achievements: [],
        answers: [],
        competency_scores: {},
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: sess.id };
  });

// Get a session (with simulation embedded for the player).
export const getSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: sess, error } = await context.supabase
      .from("sessions")
      .select("*, simulation:simulations(*)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!sess) throw new Error("Sesión no encontrada");
    return sess;
  });

// Record an answer and advance to the next node.
const AnswerInput = z.object({
  sessionId: z.string().uuid(),
  nodeId: z.string(),
  choiceId: z.string(),
  /** Free text when the prompt is a comment. */
  commentText: z.string().max(4000).optional(),
});

export const submitAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AnswerInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: sess, error } = await context.supabase
      .from("sessions")
      .select("*, simulation:simulations(story)")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!sess) throw new Error("Sesión no encontrada");

    const story = (sess.simulation as { story: { nodes: Record<string, any> } })
      .story;
    const node = story.nodes[data.nodeId];
    if (!node) throw new Error("Nodo no encontrado");
    // Look up the choice across the legacy single question + any new multi-question array.
    const allQuestions: any[] = [
      ...(node.question ? [node.question] : []),
      ...(Array.isArray(node.questions) ? node.questions : []),
    ];
    let chosenQuestion: any = null;
    let choice: any = null;
    for (const q of allQuestions) {
      const found = q.choices?.find((c: any) => c.id === data.choiceId);
      if (found) {
        chosenQuestion = q;
        choice = found;
        break;
      }
    }
    if (!choice) throw new Error("Opción no válida");

    const kind: "question" | "comment" | "goto" = chosenQuestion?.kind ?? "question";
    const answers = Array.isArray(sess.answers) ? [...(sess.answers as any[])] : [];
    answers.push({
      nodeId: node.id,
      nodeTitle: node.title,
      question: chosenQuestion?.text ?? "",
      choiceId: choice.id,
      choiceLabel:
        kind === "comment"
          ? (data.commentText ?? "").slice(0, 4000)
          : choice.label,
      points: choice.points,
      feedback: choice.feedback,
      at: new Date().toISOString(),
      kind,
      ...(kind === "comment" && data.commentText ? { commentText: data.commentText.slice(0, 4000) } : {}),
    });


    const newScore = (sess.score ?? 0) + (choice.points ?? 0);
    const comp = { ...((sess.competency_scores as Record<string, number>) ?? {}) };
    for (const [k, v] of Object.entries(choice.competencies ?? {})) {
      comp[k] = (comp[k] ?? 0) + (v as number);
    }

    const nextKind: "end" | "scene" | "continue" | "question" =
      choice.nextKind ?? (choice.next ? "scene" : "end");
    const stayInScene = nextKind === "continue" || nextKind === "question";
    const forcedQuestionId: string | null = nextKind === "question" ? (choice.nextQuestionId ?? null) : null;
    const nextClipId: string | null = nextKind === "scene" ? (choice.nextClipId ?? null) : null;

    let nextId: string | null;
    if (stayInScene) {
      nextId = node.id;
    } else if (nextKind === "scene") {
      nextId = choice.next ?? null;
    } else {
      nextId = null;
    }
    const nextNode = nextId ? story.nodes[nextId] : null;
    const completed = !stayInScene && (!nextNode || nextNode.isEnding);
    const completedAt = completed && nextNode ? new Date().toISOString() : null;

    const { error: updErr } = await context.supabase
      .from("sessions")
      .update({
        answers: answers as any,
        score: newScore,
        competency_scores: comp as any,
        current_node_id: nextId,
        ...(completedAt ? { completed_at: completedAt } : {}),
      })
      .eq("id", data.sessionId)
      .eq("user_id", context.userId);
    if (updErr) throw new Error(updErr.message);

    return {
      nextNodeId: nextId,
      nextClipId,
      score: newScore,
      pointsDelta: choice.points,
      feedback: choice.feedback,
      competencyScores: comp,
      completed,
      stayInScene,
      forcedQuestionId,
      answeredQuestionId: chosenQuestion?.id ?? null,
    };
  });


// Return current_node_id to a previous scene (used after a branched clip finishes).
export const returnToNode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ sessionId: z.string().uuid(), nodeId: z.string() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: sess, error } = await context.supabase
      .from("sessions")
      .select("simulation:simulations(story)")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!sess) throw new Error("Sesión no encontrada");
    const story = (sess.simulation as { story: { nodes: Record<string, any> } }).story;
    if (!story?.nodes?.[data.nodeId]) throw new Error("Nodo no encontrado");

    const { error: updErr } = await context.supabase
      .from("sessions")
      .update({ current_node_id: data.nodeId })
      .eq("id", data.sessionId)
      .eq("user_id", context.userId);
    if (updErr) throw new Error(updErr.message);
    return { ok: true };
  });





// Generate the final AI report for a finished session.
const ReportSchema = z.object({
  outcome: z.enum(["apto", "apto_con_reservas", "no_apto"]),
  summary: z.string(),
  strengths: z.array(z.string()).max(6),
  improvements: z.array(z.string()).max(6),
  achievements: z.array(z.string()).max(6),
});

function buildFallbackReport(
  score: number,
  answersCount: number,
  completed: boolean,
): z.infer<typeof ReportSchema> {
  const outcome =
    score >= 180 ? "apto" : score >= 80 ? "apto_con_reservas" : "no_apto";

  const noProgress = answersCount === 0 || score <= 0;

  if (noProgress) {
    return {
      outcome: "no_apto",
      summary:
        answersCount === 0
          ? "El participante no respondió ninguna pregunta de la simulación. No hay evidencia de desempeño para evaluar."
          : "El participante no obtuvo puntuación positiva en la simulación. Las decisiones tomadas no demuestran las competencias esperadas.",
      strengths: [],
      improvements: [
        answersCount === 0
          ? "Completar la simulación respondiendo a las preguntas planteadas"
          : "Revisar las decisiones tomadas: ninguna sumó puntuación positiva",
        "Repasar los criterios de evaluación antes de volver a intentarlo",
      ],
      achievements: [],
    };
  }

  const strengths: string[] = [];
  if (completed) strengths.push("Completó la simulación de principio a fin");
  if (score >= 100) strengths.push("Obtuvo una puntuación sólida en las decisiones clave");

  return {
    outcome,
    summary:
      "No se pudo generar un informe detallado automáticamente. Este es un resumen básico basado en la puntuación obtenida.",
    strengths,
    improvements: ["Revisar las decisiones tomadas para identificar áreas de mejora"],
    achievements: [],
  };
}

export const generateReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ sessionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: sess, error } = await context.supabase
      .from("sessions")
      .select("*, simulation:simulations(title,objective,evaluation_criteria)")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!sess) throw new Error("Sesión no encontrada");

    if (sess.report) return sess.report;

    const userKeys = await loadUserKeys(context.supabase, context.userId);
    const { model: aiModel, provider: aiProvider, nativeId } = resolveUserTextModel(userKeys);

    const sim = sess.simulation as {
      title: string;
      objective: string;
      evaluation_criteria: Array<{ key: string; label: string; description: string }>;
    };

    const transcript = (sess.answers as any[])
      .map(
        (a, i) =>
          `Escena ${i + 1} — ${a.nodeTitle}\nPregunta: ${a.question}\nRespuesta: ${a.choiceLabel} (${a.points >= 0 ? "+" : ""}${a.points} pts)\nFeedback escenario: ${a.feedback}`,
      )
      .join("\n\n");

    const comp = sess.competency_scores as Record<string, number>;

    const score = sess.score ?? 0;
    let report: z.infer<typeof ReportSchema>;
    let usageIn = 0;
    let usageOut = 0;
    try {
      const result = await generateText({
        model: aiModel,
        experimental_output: Output.object({ schema: ReportSchema }),
        system:
          "Eres un evaluador profesional. Generas un informe final breve, claro y útil sobre el desempeño del participante. Idioma: español. Devuelve SIEMPRE el JSON con todos los campos requeridos.",
        prompt: `Simulación: ${sim.title}
Objetivo: ${sim.objective}
Puntuación total: ${score}
Competencias y deltas: ${JSON.stringify(comp)}
Criterios definidos: ${JSON.stringify(sim.evaluation_criteria)}

Transcripción de decisiones del participante:
${transcript}

Genera el veredicto (apto / apto_con_reservas / no_apto), un resumen ejecutivo (2-4 frases), fortalezas, áreas de mejora y logros desbloqueados.`,
      });
      report = result.experimental_output;
      usageIn = (result.usage as { inputTokens?: number; promptTokens?: number } | undefined)?.inputTokens ?? (result.usage as { promptTokens?: number } | undefined)?.promptTokens ?? 0;
      usageOut = (result.usage as { outputTokens?: number; completionTokens?: number } | undefined)?.outputTokens ?? (result.usage as { completionTokens?: number } | undefined)?.completionTokens ?? 0;
    } catch (e) {
      console.error("generateReport: AI schema failed, using fallback", e);
      report = buildFallbackReport(score, (sess.answers as any[]).length, !!sess.completed_at);
    }

    try {
      const { recordUsage, userPaysPlatform } = await import("./usage.server");
      await recordUsage({
        userId: context.userId,
        action: "text",
        provider: aiProvider,
        model: nativeId,
        inputTokens: usageIn,
        outputTokens: usageOut,
        simulationId: sess.simulation_id,
        paysPlatform: await userPaysPlatform(context.userId),
      });
    } catch (e) { console.error("[text] usage:", e); }

    // Compute stars from score range (rough heuristic).
    let stars = 1;
    if (score >= 250) stars = 5;
    else if (score >= 180) stars = 4;
    else if (score >= 100) stars = 3;
    else if (score >= 40) stars = 2;

    const fullReport = {
      finalScore: score,
      stars,
      outcome: report.outcome,
      summary: report.summary,
      strengths: report.strengths,
      improvements: report.improvements,
      achievements: report.achievements,
      competencyScores: comp,
    };

    const { error: updErr } = await context.supabase
      .from("sessions")
      .update({
        report: fullReport,
        stars,
        achievements: report.achievements,
        completed_at: sess.completed_at ?? new Date().toISOString(),
      })
      .eq("id", data.sessionId)
      .eq("user_id", context.userId);
    if (updErr) throw new Error(updErr.message);

    return fullReport;
  });

// List my recent sessions.
export const listMySessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("sessions")
      .select(
        "id, score, stars, started_at, completed_at, admin_feedback, admin_feedback_at, simulation:simulations(title)",
      )
      .eq("user_id", context.userId)
      .order("started_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---------- Save current preview state as a playable draft session ----------

const PreviewAnswerSchema = z.object({
  nodeId: z.string(),
  nodeTitle: z.string().default(""),
  question: z.string().default(""),
  choiceId: z.string().default(""),
  choiceLabel: z.string().default(""),
  points: z.number(),
  feedback: z.string().default(""),
  at: z.string().optional(),
  kind: z.enum(["question", "comment", "goto"]).optional(),
  commentText: z.string().max(4000).optional(),
});

const SavePreviewDraftInput = z.object({
  simulationId: z.string().uuid(),
  currentNodeId: z.string().nullable(),
  score: z.number(),
  competencyScores: z.record(z.string(), z.number()).default({}),
  answers: z.array(PreviewAnswerSchema).default([]),
  resumeSessionId: z.string().uuid().optional(),
});

export const savePreviewAsDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SavePreviewDraftInput.parse(input))
  .handler(async ({ data, context }) => {
    // Confirm the caller owns the simulation (preview drafts only for owners).
    const { data: sim, error: simErr } = await context.supabase
      .from("simulations")
      .select("id, owner_id")
      .eq("id", data.simulationId)
      .maybeSingle();
    if (simErr) throw new Error(simErr.message);
    if (!sim) throw new Error("Simulación no encontrada");
    if (sim.owner_id !== context.userId) throw new Error("No autorizado");

    const answers = data.answers.map((a) => ({
      ...a,
      at: a.at ?? new Date().toISOString(),
    }));

    // Mark the session as a preview draft via the achievements field so we can
    // filter it in lists without changing the schema.
    const achievements = ["__preview_draft__"];

    if (data.resumeSessionId) {
      const { error: updErr } = await context.supabase
        .from("sessions")
        .update({
          current_node_id: data.currentNodeId,
          score: data.score,
          competency_scores: data.competencyScores as any,
          answers: answers as any,
          achievements: achievements as any,
          completed_at: null,
          report: null,
        })
        .eq("id", data.resumeSessionId)
        .eq("user_id", context.userId);
      if (updErr) throw new Error(updErr.message);
      return { id: data.resumeSessionId };
    }

    const { data: sess, error } = await context.supabase
      .from("sessions")
      .insert({
        simulation_id: data.simulationId,
        user_id: context.userId,
        current_node_id: data.currentNodeId,
        score: data.score,
        stars: 0,
        achievements: achievements as any,
        answers: answers as any,
        competency_scores: data.competencyScores as any,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: sess.id };
  });
