import { QuestionSchema, type AssessmentQuestion } from "./assessments-shared";
import { generateBlueprint } from "./assessments.server";

const ITEM_COLUMNS =
  "id, prompt, type, subject, area_key, tags, question, version, times_used, source_assessment_id, created_at, updated_at";

export interface BankItem {
  id: string;
  prompt: string;
  type: string;
  subject: string | null;
  areaKey: string | null;
  tags: string[];
  question: AssessmentQuestion;
  version: number;
  timesUsed: number;
  createdAt: string;
  updatedAt: string;
}

export interface BankVersion {
  id: string;
  version: number;
  question: AssessmentQuestion;
  note: string;
  createdAt: string;
}

function safeQuestion(raw: unknown): AssessmentQuestion {
  const parsed = QuestionSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : QuestionSchema.parse({});
}

export function mapItem(row: any): BankItem {
  return {
    id: row.id,
    prompt: row.prompt ?? "",
    type: row.type ?? "narrative",
    subject: row.subject ?? null,
    areaKey: row.area_key ?? null,
    tags: Array.isArray(row.tags) ? row.tags : [],
    question: safeQuestion(row.question),
    version: Number(row.version ?? 1),
    timesUsed: Number(row.times_used ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapVersion(row: any): BankVersion {
  return {
    id: row.id,
    version: Number(row.version ?? 1),
    question: safeQuestion(row.question),
    note: row.note ?? "",
    createdAt: row.created_at,
  };
}

// ───────────────────────────── lectura ─────────────────────────────

export async function listBankItemsHandler(
  data: { subject?: string | null; type?: string | null; areaKey?: string | null; search?: string | null },
  context: any,
) {
  let query = context.supabase
    .from("question_bank_items")
    .select(ITEM_COLUMNS)
    .eq("owner_id", context.userId)
    .order("updated_at", { ascending: false })
    .limit(400);
  if (data.subject) query = query.eq("subject", data.subject);
  if (data.type) query = query.eq("type", data.type);
  if (data.areaKey) query = query.eq("area_key", data.areaKey);
  if (data.search?.trim()) query = query.ilike("prompt", `%${data.search.trim()}%`);
  const { data: rows, error } = await query;
  if (error) throw new Error(error.message);
  return { items: (rows ?? []).map(mapItem) };
}

export async function listBankVersionsHandler(data: { id: string }, context: any) {
  const { data: rows, error } = await context.supabase
    .from("question_bank_versions")
    .select("id, version, question, note, created_at")
    .eq("item_id", data.id)
    .eq("owner_id", context.userId)
    .order("version", { ascending: false });
  if (error) throw new Error(error.message);
  return { versions: (rows ?? []).map(mapVersion) };
}

// ───────────────────────────── escritura ─────────────────────────────

async function insertItems(
  questions: AssessmentQuestion[],
  meta: { subject?: string | null; areaKey?: string | null; tags?: string[]; sourceAssessmentId?: string | null },
  context: any,
) {
  const clean = questions.filter((q) => q.prompt.trim().length > 0);
  if (clean.length === 0) return { items: [] as BankItem[] };

  const { data: rows, error } = await context.supabase
    .from("question_bank_items")
    .insert(
      clean.map((question) => ({
        owner_id: context.userId,
        prompt: question.prompt.slice(0, 2000),
        type: question.type,
        subject: meta.subject ?? null,
        area_key: meta.areaKey ?? null,
        tags: meta.tags ?? [],
        question,
        version: 1,
        source_assessment_id: meta.sourceAssessmentId ?? null,
      })),
    )
    .select(ITEM_COLUMNS);
  if (error) throw new Error(error.message);

  const items: BankItem[] = (rows ?? []).map(mapItem);
  const { error: vError } = await context.supabase.from("question_bank_versions").insert(
    items.map((item) => ({
      item_id: item.id,
      owner_id: context.userId,
      version: 1,
      question: item.question,
      note: "Versión inicial",
    })),
  );
  if (vError) throw new Error(vError.message);
  return { items };
}

export async function generateBankQuestionsHandler(
  data: {
    prompt: string;
    questionCount: number;
    subject?: string | null;
    areaKey?: string | null;
    questionTypes?: string[];
    sourceText?: string | null;
    tags?: string[];
  },
  context: any,
) {
  const blueprint = await generateBlueprint(
    {
      prompt: data.prompt,
      questionCount: data.questionCount,
      maxScore: data.questionCount,
      areaKey: data.areaKey ?? null,
      subject: data.subject ?? null,
      questionTypes: data.questionTypes ?? ["narrative"],
      sourceText: data.sourceText ?? null,
    },
    context,
  );
  return insertItems(blueprint.questions, {
    subject: data.subject ?? null,
    areaKey: data.areaKey ?? null,
    tags: data.tags ?? [],
  }, context);
}

export async function importAssessmentQuestionsHandler(
  data: { assessmentId: string; tags?: string[] },
  context: any,
) {
  const { data: row, error } = await context.supabase
    .from("assessments")
    .select("id, area_key, questions, prompt")
    .eq("id", data.assessmentId)
    .eq("owner_id", context.userId)
    .single();
  if (error) throw new Error(error.message);

  const { unpackPrompt } = await import("./assessments.server");
  const meta = unpackPrompt(row.prompt ?? null);
  const questions = (Array.isArray(row.questions) ? row.questions : []).map((q: unknown) =>
    safeQuestion(q),
  );
  return insertItems(questions, {
    subject: meta.subject,
    areaKey: row.area_key ?? null,
    tags: data.tags ?? [],
    sourceAssessmentId: row.id,
  }, context);
}

export async function updateBankItemHandler(
  data: { id: string; question: AssessmentQuestion; tags?: string[]; note?: string },
  context: any,
) {
  const { data: current, error: cErr } = await context.supabase
    .from("question_bank_items")
    .select("id, version")
    .eq("id", data.id)
    .eq("owner_id", context.userId)
    .single();
  if (cErr) throw new Error(cErr.message);

  const nextVersion = Number(current.version ?? 1) + 1;
  const question = QuestionSchema.parse(data.question);

  const { data: row, error } = await context.supabase
    .from("question_bank_items")
    .update({
      prompt: question.prompt.slice(0, 2000),
      type: question.type,
      question,
      version: nextVersion,
      ...(data.tags ? { tags: data.tags } : {}),
    })
    .eq("id", data.id)
    .eq("owner_id", context.userId)
    .select(ITEM_COLUMNS)
    .single();
  if (error) throw new Error(error.message);

  const { error: vErr } = await context.supabase.from("question_bank_versions").insert({
    item_id: data.id,
    owner_id: context.userId,
    version: nextVersion,
    question,
    note: (data.note ?? "").slice(0, 500) || `Versión ${nextVersion}`,
  });
  if (vErr) throw new Error(vErr.message);

  return { item: mapItem(row) };
}

export async function restoreBankVersionHandler(
  data: { id: string; version: number },
  context: any,
) {
  const { data: version, error } = await context.supabase
    .from("question_bank_versions")
    .select("question")
    .eq("item_id", data.id)
    .eq("owner_id", context.userId)
    .eq("version", data.version)
    .single();
  if (error) throw new Error(error.message);
  return updateBankItemHandler(
    {
      id: data.id,
      question: safeQuestion(version.question),
      note: `Restaurada la versión ${data.version}`,
    },
    context,
  );
}

export async function deleteBankItemHandler(data: { id: string }, context: any) {
  const { error } = await context.supabase
    .from("question_bank_items")
    .delete()
    .eq("id", data.id)
    .eq("owner_id", context.userId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/** Crea una evaluación nueva a partir de preguntas guardadas en el banco. */
export async function createAssessmentFromBankHandler(
  data: {
    title: string;
    itemIds: string[];
    areaKey?: string | null;
    handwritingWeightPct: number;
    instructions?: string | null;
  },
  context: any,
) {
  const { data: rows, error } = await context.supabase
    .from("question_bank_items")
    .select(ITEM_COLUMNS)
    .eq("owner_id", context.userId)
    .in("id", data.itemIds);
  if (error) throw new Error(error.message);

  const items: BankItem[] = (rows ?? []).map(mapItem);
  if (items.length === 0) throw new Error("Selecciona al menos una pregunta del banco.");

  const ordered = data.itemIds
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is BankItem => Boolean(item));

  const questions = ordered.map((item, i) => ({
    ...item.question,
    id: `p${i + 1}`,
    maxPoints: item.question.maxPoints > 0 ? item.question.maxPoints : 1,
  }));
  const maxScore = questions.reduce((sum, q) => sum + q.maxPoints, 0) || questions.length;

  const rubric = [
    {
      id: "c1",
      name: "Contenido y precisión",
      description: "Corrección de las respuestas respecto a la solución esperada.",
      weightPct: 60,
      levels: [
        { label: "Insuficiente", descriptor: "Errores graves o respuestas ausentes.", pct: 40 },
        { label: "Suficiente", descriptor: "Responde lo básico con imprecisiones.", pct: 60 },
        { label: "Notable", descriptor: "Respuestas correctas y bien justificadas.", pct: 80 },
        { label: "Excelente", descriptor: "Respuestas completas, precisas y razonadas.", pct: 100 },
      ],
    },
    {
      id: "c2",
      name: "Razonamiento y estructura",
      description: "Claridad del razonamiento y organización de la respuesta.",
      weightPct: 40,
      levels: [
        { label: "Insuficiente", descriptor: "Sin razonamiento visible.", pct: 40 },
        { label: "Suficiente", descriptor: "Razonamiento parcial.", pct: 60 },
        { label: "Notable", descriptor: "Razonamiento claro y ordenado.", pct: 80 },
        { label: "Excelente", descriptor: "Razonamiento sólido y bien estructurado.", pct: 100 },
      ],
    },
  ];

  const { data: assessment, error: aErr } = await context.supabase
    .from("assessments")
    .insert({
      owner_id: context.userId,
      title: data.title,
      area_key: data.areaKey ?? ordered[0]?.areaKey ?? null,
      prompt: `Compuesta desde el banco de preguntas (${ordered.length} preguntas).`,
      instructions:
        data.instructions?.trim() ||
        "Responde a todas las preguntas de forma clara y ordenada. Se valorará la precisión y el razonamiento.",
      questions,
      rubric,
      max_score: maxScore,
      handwriting_weight_pct: data.handwritingWeightPct,
      status: "ready",
    })
    .select("id, title")
    .single();
  if (aErr) throw new Error(aErr.message);

  await Promise.all(
    ordered.map((item) =>
      context.supabase
        .from("question_bank_items")
        .update({ times_used: item.timesUsed + 1 })
        .eq("id", item.id)
        .eq("owner_id", context.userId),
    ),
  );

  return { assessment: { id: assessment.id as string, title: assessment.title as string } };
}
