import { generateText } from "ai";
import { resolveUserTextModel } from "./ai-gateway.server";
import {
  ANSWER_VERDICTS,
  FEEDBACK_TONE_INSTRUCTIONS,
  normalizeFeedbackTone,
  BlueprintSchema,
  EvaluationSchema,
  HandwritingSchema,
  type AnswerVerdict,
  type AssessmentBlueprint,
  type AssessmentEvaluation,
  type AssessmentRecord,
  type SubmissionPage,
  type SubmissionRecord,
} from "./assessments-shared";
import { loadUserKeys } from "./user-keys.functions";

const BUCKET = "assessments";
const MAX_PAGE_BYTES = 15 * 1024 * 1024;
const MAX_PAGES = 12;

/** Normaliza el veredicto devuelto por la IA; si falta, lo deduce de la puntuación. */
function normalizeVerdict(raw: unknown, score: number, maxPoints: number): AnswerVerdict {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (ANSWER_VERDICTS.includes(value as AnswerVerdict)) return value as AnswerVerdict;
  if (value.startsWith("correct")) return "correct";
  if (value.startsWith("parcial")) return "partial";
  if (value.startsWith("incorrect")) return "incorrect";
  if (value.includes("sin responder") || value.includes("blanco") || value.includes("unanswer"))
    return "unanswered";
  if (!maxPoints) return "partial";
  if (score <= 0) return "incorrect";
  if (score >= maxPoints) return "correct";
  return "partial";
}

const ASSESSMENT_COLUMNS =
  "id, title, area_key, prompt, instructions, questions, rubric, max_score, handwriting_weight_pct, feedback_tone, status, created_at, updated_at";
const SUBMISSION_COLUMNS =
  "id, assessment_id, candidate_name, candidate_identifier, source_kind, pages, extracted_text, handwriting, evaluation, score, max_score, status, error_message, graded_at, created_at, approval_status, approval_note, approved_at";

export function mapAssessment(row: any): AssessmentRecord {
  return {
    id: row.id,
    title: row.title,
    areaKey: row.area_key ?? null,
    prompt: row.prompt ?? null,
    instructions: row.instructions ?? null,
    questions: Array.isArray(row.questions) ? row.questions : [],
    rubric: Array.isArray(row.rubric) ? row.rubric : [],
    maxScore: Number(row.max_score ?? 10),
    handwritingWeightPct: Number(row.handwriting_weight_pct ?? 15),
    feedbackTone: normalizeFeedbackTone(row.feedback_tone),
    status: row.status ?? "draft",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapSubmission(row: any): SubmissionRecord {
  const evaluation = row.evaluation && Object.keys(row.evaluation).length > 0
    ? EvaluationSchema.safeParse(row.evaluation)
    : null;
  return {
    id: row.id,
    assessmentId: row.assessment_id,
    candidateName: row.candidate_name,
    candidateIdentifier: row.candidate_identifier ?? null,
    sourceKind: row.source_kind ?? "handwritten",
    pages: Array.isArray(row.pages) ? row.pages : [],
    extractedText: row.extracted_text ?? null,
    evaluation: evaluation?.success ? evaluation.data : null,
    score: row.score === null || row.score === undefined ? null : Number(row.score),
    maxScore: row.max_score === null || row.max_score === undefined ? null : Number(row.max_score),
    status: row.status ?? "pending",
    errorMessage: row.error_message ?? null,
    gradedAt: row.graded_at ?? null,
    createdAt: row.created_at,
    approvalStatus: (row.approval_status ?? "pending") as "pending" | "approved" | "rejected",
    approvalNote: row.approval_note ?? "",
    approvedAt: row.approved_at ?? null,
  };
}

function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("La IA no devolvió un JSON reconocible.");
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    throw new Error("La IA devolvió una respuesta incompleta. Vuelve a intentarlo.");
  }
}

function slug(n: number) {
  return `p${n}`;
}

// ───────────────────────────────── Assessments ─────────────────────────────────

export async function listAssessmentsHandler(context: any) {
  const { data, error } = await context.supabase
    .from("assessments")
    .select(ASSESSMENT_COLUMNS)
    .eq("owner_id", context.userId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return { assessments: (data ?? []).map(mapAssessment) };
}

export async function getAssessmentHandler(data: { id: string }, context: any) {
  const [assessmentRes, submissionsRes] = await Promise.all([
    context.supabase
      .from("assessments")
      .select(ASSESSMENT_COLUMNS)
      .eq("id", data.id)
      .eq("owner_id", context.userId)
      .single(),
    context.supabase
      .from("assessment_submissions")
      .select(SUBMISSION_COLUMNS)
      .eq("assessment_id", data.id)
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false }),
  ]);
  if (assessmentRes.error) throw new Error(assessmentRes.error.message);
  if (submissionsRes.error) throw new Error(submissionsRes.error.message);
  return {
    assessment: mapAssessment(assessmentRes.data),
    submissions: (submissionsRes.data ?? []).map(mapSubmission),
  };
}

export async function generateBlueprint(
  input: {
    prompt: string;
    questionCount: number;
    maxScore: number;
    areaKey?: string | null;
    subject?: string | null;
    questionTypes?: string[];
    sourceText?: string | null;
    allowOutsideSource?: boolean;
  },
  context: any,
): Promise<AssessmentBlueprint> {
  const userKeys = await loadUserKeys(context.supabase, context.userId);
  const { model, provider, nativeId } = resolveUserTextModel(userKeys);
  const types = input.questionTypes && input.questionTypes.length > 0 ? input.questionTypes : ["narrative"];
  const system =
    "Eres un experto en evaluación educativa, pruebas psicotécnicas y procesos de selección. Diseñas pruebas escritas (desarrollo, test, verdadero/falso y ejercicios numéricos) con rúbricas analíticas defendibles. Cuando la pregunta es cerrada, la respuesta correcta es inequívoca y verificable. Respondes solo con un objeto JSON válido, en español, sin markdown.";
  const prompt = `Diseña una prueba escrita a partir de este encargo:\n"""${input.prompt}"""\nÁrea: ${input.areaKey ?? "general"}\nMateria / tipo de contenido: ${input.subject ?? "generico"}\nTipos de pregunta permitidos (usa solo estos, repartidos de forma equilibrada): ${types.join(", ")}\nNúmero de preguntas: ${input.questionCount}\nPuntuación total de la prueba: ${input.maxScore}
${
    input.sourceText
      ? `\nTEXTO BASE (fuente única de la prueba; no lo reescribas):\n"""${input.sourceText.slice(0, 20000)}"""\n${
          input.allowOutsideSource
            ? "\nPuedes ampliar con contenido externo relacionado, pero la mayoría de las preguntas deben salir del TEXTO BASE.\n"
            : `\nREGLA DE ANCLAJE ESTRICTO (obligatoria):
- TODAS las preguntas, alternativas, respuestas correctas y elementos clave deben poder responderse y verificarse ÚNICAMENTE con la información literal o directamente inferible del TEXTO BASE.
- Está PROHIBIDO inventar datos, cifras, nombres, fechas, normativa, fórmulas o conceptos que no aparezcan en el TEXTO BASE, aunque sean ciertos en el mundo real.
- Los distractores de los test deben ser plausibles pero falsos SEGÚN EL TEXTO BASE (no requieren conocimiento externo).
- En explanation cita brevemente la parte del TEXTO BASE que justifica la respuesta (frase o fragmento entre comillas).
- Si el TEXTO BASE no da material suficiente para ${input.questionCount} preguntas, genera menos preguntas en lugar de inventar contenido, y reparte la puntuación entre las que sí generes.
`
        }`
      : ""
  }
Devuelve exactamente estas claves JSON: title (string), instructions (string con indicaciones para el candidato), questions (array), rubric (array de {id, name, description, weightPct, levels: array de {label, descriptor, pct}}).

Cada pregunta es un objeto {id, prompt, type, maxPoints, keyElements, options, correctOptionIds, correctAnswer, explanation} donde:
- type es uno de: narrative, single_choice, multiple_choice, true_false, numeric.
- narrative: options=[], correctOptionIds=[], correctAnswer="" y keyElements con los elementos que debe contener una buena respuesta.
- single_choice / multiple_choice: options con 4 alternativas [{id:"a"|"b"|"c"|"d", text}], correctOptionIds con la(s) correcta(s), keyElements=[].
- true_false: options=[{id:"v",text:"Verdadero"},{id:"f",text:"Falso"}] y correctOptionIds con "v" o "f".
- numeric: correctAnswer con el resultado exacto (incluye unidades si aplica), options=[].
- explanation: justificación breve de la respuesta correcta (para el corrector, no para el candidato).
Para psicotécnicos usa series numéricas, analogías, razonamiento lógico-abstracto o cálculo mental, siempre con una única alternativa correcta.
La suma de maxPoints debe ser ${input.maxScore}. La suma de weightPct debe ser 100. Usa 4 niveles por criterio (Insuficiente 40, Suficiente 60, Notable 80, Excelente 100).`;

  const result = await generateText({ model, system, prompt });
  const raw = extractJson(result.text) as any;
  const allowedTypes = ["narrative", "single_choice", "multiple_choice", "true_false", "numeric"];
  const blueprint = BlueprintSchema.parse({
    title: raw.title ?? raw.titulo ?? "",
    instructions: raw.instructions ?? raw.instrucciones ?? "",
    questions: (raw.questions ?? raw.preguntas ?? []).map((q: any, i: number) => {
      const rawType = String(q?.type ?? q?.tipo ?? "narrative");
      const type = allowedTypes.includes(rawType) ? rawType : "narrative";
      const options = Array.isArray(q?.options ?? q?.opciones)
        ? (q.options ?? q.opciones).map((o: any, oi: number) => ({
            id: String(o?.id ?? String.fromCharCode(97 + oi)),
            text: String(o?.text ?? o?.texto ?? o ?? ""),
          }))
        : [];
      const correct = q?.correctOptionIds ?? q?.correctas ?? q?.correcta;
      return {
        id: String(q?.id ?? slug(i + 1)),
        prompt: String(q?.prompt ?? q?.enunciado ?? ""),
        type,
        maxPoints: Number(q?.maxPoints ?? q?.puntos ?? 0) || 0,
        keyElements: Array.isArray(q?.keyElements ?? q?.elementosClave)
          ? (q.keyElements ?? q.elementosClave).map((s: any) => String(s))
          : [],
        options,
        correctOptionIds: Array.isArray(correct)
          ? correct.map((s: any) => String(s))
          : correct
            ? [String(correct)]
            : [],
        correctAnswer: String(q?.correctAnswer ?? q?.respuesta ?? ""),
        explanation: String(q?.explanation ?? q?.justificacion ?? ""),
      };
    }),
    rubric: (raw.rubric ?? raw.rubrica ?? []).map((c: any, i: number) => ({
      id: String(c?.id ?? `c${i + 1}`),
      name: String(c?.name ?? c?.nombre ?? ""),
      description: String(c?.description ?? c?.descripcion ?? ""),
      weightPct: Number(c?.weightPct ?? c?.peso ?? 0) || 0,
      levels: Array.isArray(c?.levels ?? c?.niveles)
        ? (c.levels ?? c.niveles).map((l: any) => ({
            label: String(l?.label ?? l?.nivel ?? ""),
            descriptor: String(l?.descriptor ?? l?.descripcion ?? ""),
            pct: Number(l?.pct ?? l?.porcentaje ?? 0) || 0,
          }))
        : [],
    })),
  });


  try {
    const usage = await result.usage;
    const { recordUsage, userPaysPlatform } = await import("./usage.server");
    await recordUsage({
      userId: context.userId,
      action: "text",
      provider,
      model: nativeId,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      paysPlatform: await userPaysPlatform(context.userId),
    });
  } catch (error) {
    console.error("[assessments] usage:", error);
  }

  return blueprint;
}

export async function createAssessmentHandler(
  data: {
    title: string;
    prompt?: string;
    areaKey?: string | null;
    maxScore: number;
    handwritingWeightPct: number;
    feedbackTone?: string;
    questionCount: number;
    generate: boolean;
    subject?: string | null;
    questionTypes?: string[];
    sourceText?: string | null;
    allowOutsideSource?: boolean;
  },
  context: any,
) {
  let blueprint: AssessmentBlueprint | null = null;
  if (data.generate && (data.prompt || data.sourceText)) {
    blueprint = await generateBlueprint(
      {
        prompt:
          data.prompt ||
          "Formula las preguntas exclusivamente a partir del TEXTO BASE aportado.",
        questionCount: data.questionCount,
        maxScore: data.maxScore,
        areaKey: data.areaKey ?? null,
        subject: data.subject ?? null,
        questionTypes: data.questionTypes ?? ["narrative"],
        sourceText: data.sourceText ?? null,
        allowOutsideSource: data.allowOutsideSource ?? false,
      },
      context,
    );
  }

  const { data: row, error } = await context.supabase
    .from("assessments")
    .insert({
      owner_id: context.userId,
      title: blueprint?.title || data.title,
      area_key: data.areaKey ?? null,
      prompt: packPrompt(data.prompt ?? null, data.subject ?? null, data.questionTypes, data.sourceText ?? null),
      instructions: blueprint?.instructions ?? null,
      questions: blueprint?.questions ?? [],
      rubric: blueprint?.rubric ?? [],
      max_score: data.maxScore,
      handwriting_weight_pct: data.handwritingWeightPct,
      feedback_tone: normalizeFeedbackTone(data.feedbackTone),
      status: blueprint ? "ready" : "draft",
    })
    .select(ASSESSMENT_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return { assessment: mapAssessment(row) };
}

const SOURCE_MARK = "\n\n[TEXTO BASE]\n";
const META_MARK = "\n\n[CONFIG]";

/** Guarda materia, tipos y texto base dentro del campo `prompt` (sin cambiar el esquema). */
export function packPrompt(
  prompt: string | null,
  subject: string | null,
  questionTypes: string[] | undefined,
  sourceText: string | null,
) {
  if (!prompt && !sourceText) return null;
  let out = prompt ?? "";
  if (subject || (questionTypes && questionTypes.length > 0)) {
    out += `${META_MARK} materia=${subject ?? "generico"} tipos=${(questionTypes ?? ["narrative"]).join(",")}`;
  }
  if (sourceText?.trim()) out += `${SOURCE_MARK}${sourceText.trim()}`;
  return out;
}

/** Recupera materia, tipos y texto base guardados en el campo `prompt`. */
export function unpackPrompt(stored: string | null) {
  const value = stored ?? "";
  const [beforeSource, ...sourceRest] = value.split(SOURCE_MARK);
  const sourceText = sourceRest.length > 0 ? sourceRest.join(SOURCE_MARK) : null;
  const [prompt, meta] = beforeSource.split(META_MARK);
  const subject = meta?.match(/materia=([\w-]+)/)?.[1] ?? null;
  const typesRaw = meta?.match(/tipos=([\w,]+)/)?.[1];
  return {
    prompt: (prompt ?? "").trim(),
    subject,
    questionTypes: typesRaw ? typesRaw.split(",").filter(Boolean) : [],
    sourceText,
  };
}

export async function regenerateAssessmentHandler(
  data: {
    id: string;
    prompt: string;
    questionCount: number;
    subject?: string | null;
    questionTypes?: string[];
    sourceText?: string | null;
    allowOutsideSource?: boolean;
  },
  context: any,
) {
  const { data: current, error: curErr } = await context.supabase
    .from("assessments")
    .select("max_score, area_key, prompt")
    .eq("id", data.id)
    .eq("owner_id", context.userId)
    .single();
  if (curErr) throw new Error(curErr.message);

  const previous = unpackPrompt(current.prompt ?? null);
  const subject = data.subject ?? previous.subject ?? null;
  const questionTypes =
    data.questionTypes && data.questionTypes.length > 0
      ? data.questionTypes
      : previous.questionTypes.length > 0
        ? previous.questionTypes
        : ["narrative"];
  const sourceText = data.sourceText ?? previous.sourceText ?? null;

  const blueprint = await generateBlueprint(
    {
      prompt: data.prompt,
      questionCount: data.questionCount,
      maxScore: Number(current.max_score ?? 10),
      areaKey: current.area_key ?? null,
      subject,
      questionTypes,
      sourceText,
      allowOutsideSource: data.allowOutsideSource ?? false,
    },
    context,
  );

  const { data: row, error } = await context.supabase
    .from("assessments")
    .update({
      prompt: packPrompt(data.prompt, subject, questionTypes, sourceText),
      instructions: blueprint.instructions,
      questions: blueprint.questions,
      rubric: blueprint.rubric,
      status: "ready",
    })
    .eq("id", data.id)
    .eq("owner_id", context.userId)
    .select(ASSESSMENT_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return { assessment: mapAssessment(row) };
}


export async function updateAssessmentBlueprintHandler(
  data: {
    id: string;
    instructions?: string;
    maxScore?: number;
    handwritingWeightPct?: number;
    feedbackTone?: string;
    questions?: any[];
    rubric?: any[];
  },
  context: any,
) {
  const patch: Record<string, unknown> = {};
  if (data.instructions !== undefined) patch.instructions = data.instructions;
  if (data.maxScore !== undefined) patch.max_score = data.maxScore;
  if (data.handwritingWeightPct !== undefined)
    patch.handwriting_weight_pct = data.handwritingWeightPct;
  if (data.feedbackTone !== undefined)
    patch.feedback_tone = normalizeFeedbackTone(data.feedbackTone);
  if (data.questions !== undefined) patch.questions = data.questions;
  if (data.rubric !== undefined) {
    patch.rubric = data.rubric;
    if (data.rubric.length > 0) patch.status = "ready";
  }

  const { data: row, error } = await context.supabase
    .from("assessments")
    .update(patch)
    .eq("id", data.id)
    .eq("owner_id", context.userId)
    .select(ASSESSMENT_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return { assessment: mapAssessment(row) };
}

export async function deleteAssessmentHandler(data: { id: string }, context: any) {

  const { error } = await context.supabase
    .from("assessments")
    .delete()
    .eq("id", data.id)
    .eq("owner_id", context.userId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

// ───────────────────────────────── Submissions ─────────────────────────────────

export async function createSubmissionHandler(
  data: {
    assessmentId: string;
    candidateName: string;
    candidateIdentifier?: string | null;
    sourceKind: "handwritten" | "digital";
    files: File[];
    typedText?: string;
  },
  context: any,
) {
  const { data: assessment, error: aErr } = await context.supabase
    .from("assessments")
    .select("id, max_score")
    .eq("id", data.assessmentId)
    .eq("owner_id", context.userId)
    .single();
  if (aErr) throw new Error(aErr.message);

  const { data: row, error } = await context.supabase
    .from("assessment_submissions")
    .insert({
      assessment_id: assessment.id,
      owner_id: context.userId,
      candidate_name: data.candidateName,
      candidate_identifier: data.candidateIdentifier ?? null,
      source_kind: data.sourceKind,
      extracted_text: data.typedText?.trim() ? data.typedText.trim() : null,
      max_score: Number(assessment.max_score ?? 10),
      status: "pending",
    })
    .select(SUBMISSION_COLUMNS)
    .single();
  if (error) throw new Error(error.message);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const pages: SubmissionPage[] = [];
  for (let i = 0; i < data.files.length; i++) {
    const file = data.files[i];
    const ext = (file.name.split(".").pop() ?? "bin").toLowerCase();
    const path = `${context.userId}/${assessment.id}/${row.id}/${String(i + 1).padStart(2, "0")}.${ext}`;
    const buf = new Uint8Array(await file.arrayBuffer());
    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, buf, { contentType: file.type || "application/octet-stream", upsert: true });
    if (upErr) throw new Error(`No se pudo subir ${file.name}: ${upErr.message}`);
    pages.push({
      path,
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
    });
  }

  if (pages.length > 0) {
    const { error: pErr } = await context.supabase
      .from("assessment_submissions")
      .update({ pages })
      .eq("id", row.id)
      .eq("owner_id", context.userId);
    if (pErr) throw new Error(pErr.message);
  }

  return { submission: mapSubmission({ ...row, pages }) };
}

export function validateFiles(files: File[]) {
  if (files.length > MAX_PAGES) throw new Error(`Máximo ${MAX_PAGES} páginas por entrega.`);
  for (const f of files) {
    if (f.size === 0) throw new Error(`El archivo ${f.name} está vacío.`);
    if (f.size > MAX_PAGE_BYTES) throw new Error(`${f.name} supera los 15 MB.`);
    const ok = /^image\/(png|jpeg|jpg|webp|heic)$/.test(f.type) || f.type === "application/pdf";
    if (!ok) throw new Error(`Formato no soportado en ${f.name}. Usa imágenes o PDF.`);
  }
}

export async function deleteSubmissionHandler(data: { id: string }, context: any) {
  const { data: row } = await context.supabase
    .from("assessment_submissions")
    .select("pages")
    .eq("id", data.id)
    .eq("owner_id", context.userId)
    .maybeSingle();
  const pages: SubmissionPage[] = Array.isArray(row?.pages) ? row!.pages : [];
  if (pages.length > 0) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.storage.from(BUCKET).remove(pages.map((p) => p.path));
  }
  const { error } = await context.supabase
    .from("assessment_submissions")
    .delete()
    .eq("id", data.id)
    .eq("owner_id", context.userId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function getSubmissionHandler(data: { id: string }, context: any) {
  const { assertSubmissionPermission } = await import("./assessment-roles.server");
  const { permissions } = await assertSubmissionPermission(data.id, "view", context);

  const { data: row, error } = await context.supabase
    .from("assessment_submissions")
    .select(SUBMISSION_COLUMNS)
    .eq("id", data.id)
    .single();
  if (error) throw new Error(error.message);
  const { data: assessment, error: aErr } = await context.supabase
    .from("assessments")
    .select(ASSESSMENT_COLUMNS)
    .eq("id", row.assessment_id)
    .single();
  if (aErr) throw new Error(aErr.message);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const pages: SubmissionPage[] = Array.isArray(row.pages) ? row.pages : [];
  const pageUrls: { path: string; url: string | null; mimeType: string; name: string }[] = [];
  for (const page of pages) {
    const { data: signed } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(page.path, 3600);
    pageUrls.push({
      path: page.path,
      url: signed?.signedUrl ?? null,
      mimeType: page.mimeType,
      name: page.name,
    });
  }

  const { listAnnotationsHandler } = await import("./assessment-annotations.server");
  const { annotations } = await listAnnotationsHandler({ submissionId: row.id }, context);

  return {
    submission: mapSubmission(row),
    assessment: mapAssessment(assessment),
    pageUrls,
    annotations,
    permissions,
  };
}

/** Descarga las páginas y las convierte en partes multimodales para el modelo. */
async function buildFileParts(pages: SubmissionPage[]) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const parts: any[] = [];
  for (const page of pages) {
    const { data: blob, error } = await supabaseAdmin.storage.from(BUCKET).download(page.path);
    if (error || !blob) continue;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (page.mimeType === "application/pdf") {
      parts.push({ type: "file", data: bytes, mediaType: "application/pdf", filename: page.name });
    } else {
      parts.push({ type: "image", image: bytes, mediaType: page.mimeType });
    }
  }
  return parts;
}

export async function gradeSubmissionHandler(data: { id: string }, context: any) {
  const { assertSubmissionPermission } = await import("./assessment-roles.server");
  await assertSubmissionPermission(data.id, "grade", context);

  const { data: row, error } = await context.supabase
    .from("assessment_submissions")
    .select(SUBMISSION_COLUMNS)
    .eq("id", data.id)
    .single();
  if (error) throw new Error(error.message);

  const { data: assessmentRow, error: aErr } = await context.supabase
    .from("assessments")
    .select(ASSESSMENT_COLUMNS)
    .eq("id", row.assessment_id)
    .single();
  if (aErr) throw new Error(aErr.message);
  const assessment = mapAssessment(assessmentRow);

  const pages: SubmissionPage[] = Array.isArray(row.pages) ? row.pages : [];
  const typed = (row.extracted_text ?? "").trim();
  if (pages.length === 0 && !typed) {
    throw new Error("La entrega no tiene páginas escaneadas ni texto para evaluar.");
  }
  if (assessment.questions.length === 0) {
    throw new Error("La evaluación no tiene preguntas. Genera la prueba antes de corregir.");
  }

  await context.supabase
    .from("assessment_submissions")
    .update({ status: "grading", error_message: null })
    .eq("id", row.id);

  try {
    const userKeys = await loadUserKeys(context.supabase, context.userId);
    const { model, provider, nativeId } = resolveUserTextModel(userKeys);
    const hwWeight = assessment.handwritingWeightPct;
    const contentWeight = 100 - hwWeight;

    const system = `Eres un corrector experto. Trabajas en dos capas independientes:
1) CONTENIDO: transcribes literalmente lo que ha escrito el candidato y lo evalúas contra las preguntas y la rúbrica.
2) GRAFISMO: describes hechos observables de la escritura (legibilidad, estructura, limpieza, espaciado, consistencia, tachones y correcciones). Puedes añadir hipótesis de trabajo, marcadas siempre como no concluyentes y revisables. Nunca afirmes rasgos de personalidad, ni hagas diagnósticos, ni inferencias de salud, género, origen o edad.
Responde en español con un único objeto JSON válido, sin markdown.`;

    const rubricBrief = assessment.rubric.map((c) => ({
      nombre: c.name,
      peso: c.weightPct,
      descripcion: c.description,
      niveles: c.levels.map((l) => `${l.label} (${l.pct}%): ${l.descriptor}`),
    }));
    const questionsBrief = assessment.questions.map((q) => ({
      id: q.id,
      enunciado: q.prompt,
      tipo: q.type ?? "narrative",
      puntos: q.maxPoints,
      elementosClave: q.keyElements,
      opciones: (q.options ?? []).map((o) => `${o.id}) ${o.text}`),
      respuestaCorrecta:
        (q.correctOptionIds ?? []).length > 0
          ? (q.correctOptionIds ?? []).join(", ")
          : (q.correctAnswer ?? ""),
      justificacion: q.explanation ?? "",
    }));
    const hasObjective = assessment.questions.some((q) => (q.type ?? "narrative") !== "narrative");
    const objectiveRule = hasObjective
      ? `\nEn las preguntas cerradas (single_choice, multiple_choice, true_false, numeric) corrige de forma OBJETIVA: identifica qué ha marcado o respondido el candidato y compáralo con respuestaCorrecta. Acierto = puntos completos; fallo = 0 (en multiple_choice puedes puntuar proporcionalmente a las opciones correctas marcadas sin marcar incorrectas). En evidence indica la respuesta detectada y la correcta.`
      : "";


    const instructions = `Prueba: ${assessment.title}
Área: ${assessment.areaKey ?? "general"}
Puntuación máxima: ${assessment.maxScore}
Reparto de la nota: contenido ${contentWeight}% · grafismo ${hwWeight}%
Preguntas: ${JSON.stringify(questionsBrief)}
Rúbrica: ${JSON.stringify(rubricBrief)}
${typed ? `\nTexto ya transcrito por el evaluador:\n"""${typed.slice(0, 40000)}"""` : ""}
${pages.length > 0 ? `\nAdjunto ${pages.length} página(s) de la entrega (escaneadas o digitales). Transcribe primero su contenido.` : ""}

Devuelve exactamente estas claves JSON:
transcription (string con la transcripción literal completa),
headline (string), summary (string),
score (número sobre ${assessment.maxScore}), contentScore (número sobre ${assessment.maxScore}), handwritingScore (número 0-100),
answers (array de {questionId, question, answerSummary, score, maxPoints, strengths[], gaps[], evidence con cita textual, verdict, expectedAnswer, explanation, feedback, nextStep}),
Para CADA pregunta, sin excepción, incluye:
- verdict: exactamente uno de "correct", "partial", "incorrect", "unanswered".
- expectedAnswer: la respuesta correcta esperada (en cerradas, la opción u opciones correctas con su texto; en narrativas, los elementos clave imprescindibles).
- explanation: explicación didáctica de POR QUÉ la respuesta del candidato es correcta o incorrecta, indicando el razonamiento o la regla aplicable y en qué punto se desvía.
- feedback: feedback individual dirigido al candidato en segunda persona, concreto y respetuoso, basado solo en lo que ha escrito.
- nextStep: una acción concreta para mejorar en esa pregunta (qué repasar o cómo estructurar la respuesta).
criteria (array de {name, score sobre 100, maxScore:100, justification}),
competencies (array de {name, level, evidence}),
handwriting ({legibility, structure, cleanliness, spacing, consistency, score — todos 0-100 —, corrections (string), observations (array de strings con hechos observables), hypotheses (array de {hypothesis, basis, confidence})}),
recommendations (array de strings), conclusion (string).
score debe ser coherente con: contenido ponderado al ${contentWeight}% y grafismo al ${hwWeight}%.`;

    const { listAnnotationsHandler } = await import("./assessment-annotations.server");
    const { annotations } = await listAnnotationsHandler({ submissionId: row.id }, context);
    const annotationBrief =
      annotations.length > 0
        ? `\nCorrecciones marcadas manualmente por el evaluador sobre las páginas (tienen PRIORIDAD sobre tu propia lectura; aplícalas en la transcripción y en el grafismo):\n${annotations
            .map(
              (a: any, i: number) =>
                `${i + 1}. página ${a.pageIndex + 1} · ${a.kind === "transcription" ? "transcripción" : a.kind === "handwriting" ? "grafismo" : "contenido"}${
                  a.correction ? ` · texto correcto: "${a.correction}"` : ""
                }${a.comment ? ` · comentario: "${a.comment}"` : ""}`,
            )
            .join("\n")}`
        : "";

    const toneRule = `\nESTILO DEL FEEDBACK: ${FEEDBACK_TONE_INSTRUCTIONS[assessment.feedbackTone]}\nAplica ese tono en explanation, feedback y nextStep de TODAS las preguntas, y también en summary, recommendations y conclusion. No cambies por ello la puntuación ni los hechos.`;

    const fileParts = pages.length > 0 ? await buildFileParts(pages) : [];
    const result = await generateText({
      model,
      system,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: instructions + objectiveRule + toneRule + annotationBrief },
            ...fileParts,
          ],
        } as any,
      ],
    });

    const raw = extractJson(result.text) as any;
    const handwriting = HandwritingSchema.parse({
      legibility: Number(raw?.handwriting?.legibility ?? 0) || 0,
      structure: Number(raw?.handwriting?.structure ?? 0) || 0,
      cleanliness: Number(raw?.handwriting?.cleanliness ?? 0) || 0,
      spacing: Number(raw?.handwriting?.spacing ?? 0) || 0,
      consistency: Number(raw?.handwriting?.consistency ?? 0) || 0,
      score: Number(raw?.handwriting?.score ?? raw?.handwritingScore ?? 0) || 0,
      corrections: String(raw?.handwriting?.corrections ?? ""),
      observations: Array.isArray(raw?.handwriting?.observations)
        ? raw.handwriting.observations.map((s: any) => String(s))
        : [],
      hypotheses: Array.isArray(raw?.handwriting?.hypotheses)
        ? raw.handwriting.hypotheses.map((h: any) => ({
            hypothesis: String(h?.hypothesis ?? h?.hipotesis ?? ""),
            basis: String(h?.basis ?? h?.base ?? ""),
            confidence: String(h?.confidence ?? h?.confianza ?? "media"),
          }))
        : [],
    });

    const evaluation: AssessmentEvaluation = EvaluationSchema.parse({
      score: Number(raw?.score ?? 0) || 0,
      maxScore: assessment.maxScore,
      contentScore: Number(raw?.contentScore ?? 0) || 0,
      handwritingScore: handwriting.score,
      headline: String(raw?.headline ?? ""),
      summary: String(raw?.summary ?? ""),
      answers: Array.isArray(raw?.answers)
        ? raw.answers.map((a: any) => ({
            questionId: String(a?.questionId ?? ""),
            question: String(a?.question ?? ""),
            answerSummary: String(a?.answerSummary ?? ""),
            score: Number(a?.score ?? 0) || 0,
            maxPoints: Number(a?.maxPoints ?? 0) || 0,
            strengths: Array.isArray(a?.strengths) ? a.strengths.map((s: any) => String(s)) : [],
            gaps: Array.isArray(a?.gaps) ? a.gaps.map((s: any) => String(s)) : [],
            evidence: String(a?.evidence ?? ""),
            verdict: normalizeVerdict(
              a?.verdict ?? a?.veredicto,
              Number(a?.score ?? 0) || 0,
              Number(a?.maxPoints ?? 0) || 0,
            ),
            expectedAnswer: String(a?.expectedAnswer ?? a?.respuestaCorrecta ?? ""),
            explanation: String(a?.explanation ?? a?.explicacion ?? ""),
            feedback: String(a?.feedback ?? a?.retroalimentacion ?? ""),
            nextStep: String(a?.nextStep ?? a?.siguientePaso ?? ""),
          }))
        : [],
      criteria: Array.isArray(raw?.criteria)
        ? raw.criteria.map((c: any) => ({
            name: String(c?.name ?? ""),
            score: Number(c?.score ?? 0) || 0,
            maxScore: Number(c?.maxScore ?? 100) || 100,
            justification: String(c?.justification ?? ""),
          }))
        : [],
      competencies: Array.isArray(raw?.competencies)
        ? raw.competencies.map((c: any) => ({
            name: String(c?.name ?? ""),
            level: String(c?.level ?? ""),
            evidence: String(c?.evidence ?? ""),
          }))
        : [],
      handwriting,
      recommendations: Array.isArray(raw?.recommendations)
        ? raw.recommendations.map((s: any) => String(s))
        : [],
      conclusion: String(raw?.conclusion ?? ""),
    });

    const transcription = typed || String(raw?.transcription ?? "").trim() || null;
    const gradedAt = new Date().toISOString();
    const { data: saved, error: saveErr } = await context.supabase
      .from("assessment_submissions")
      .update({
        evaluation,
        handwriting,
        extracted_text: transcription,
        score: evaluation.score,
        max_score: assessment.maxScore,
        status: "graded",
        error_message: null,
        graded_at: gradedAt,
      })
      .eq("id", row.id)
      .select(SUBMISSION_COLUMNS)
      .single();
    if (saveErr) throw new Error(saveErr.message);

    try {
      const usage = await result.usage;
      const { recordUsage, userPaysPlatform } = await import("./usage.server");
      await recordUsage({
        userId: context.userId,
        action: "text",
        provider,
        model: nativeId,
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
        paysPlatform: await userPaysPlatform(context.userId),
      });
    } catch (usageError) {
      console.error("[assessments] usage:", usageError);
    }

    return { submission: mapSubmission(saved) };
  } catch (err: any) {
    const message = err?.message ?? "No se pudo corregir la entrega";
    await context.supabase
      .from("assessment_submissions")
      .update({ status: "failed", error_message: message })
      .eq("id", row.id)
    throw new Error(message);
  }
}
