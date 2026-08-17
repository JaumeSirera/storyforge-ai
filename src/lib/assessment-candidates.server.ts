import type {
  AssessmentCandidate,
  CandidateStatus,
  ExamAnswerInput,
  ExamPayload,
  ExamQuestion,
} from "./assessment-candidates-shared";
import { mapAssessment } from "./assessments.server";
import type { AssessmentQuestion } from "./assessments-shared";

const CANDIDATE_COLUMNS =
  "id, assessment_id, name, email, identifier, token, status, submission_id, expires_at, started_at, submitted_at, note, created_at";

export function mapCandidate(row: any): AssessmentCandidate {
  return {
    id: row.id,
    assessmentId: row.assessment_id,
    name: row.name,
    email: row.email ?? null,
    identifier: row.identifier ?? null,
    token: row.token,
    status: (row.status ?? "invited") as CandidateStatus,
    submissionId: row.submission_id ?? null,
    expiresAt: row.expires_at ?? null,
    startedAt: row.started_at ?? null,
    submittedAt: row.submitted_at ?? null,
    note: row.note ?? "",
    createdAt: row.created_at,
  };
}

function newToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ───────────────────────────── Panel del evaluador ─────────────────────────────

export async function listCandidatesHandler(data: { assessmentId: string }, context: any) {
  const { data: rows, error } = await context.supabase
    .from("assessment_candidates")
    .select(CANDIDATE_COLUMNS)
    .eq("assessment_id", data.assessmentId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return { candidates: (rows ?? []).map(mapCandidate) };
}

export async function addCandidatesHandler(
  data: {
    assessmentId: string;
    candidates: { name: string; email?: string | null; identifier?: string | null }[];
    expiresAt?: string | null;
  },
  context: any,
) {
  const { data: assessment, error: aErr } = await context.supabase
    .from("assessments")
    .select("id")
    .eq("id", data.assessmentId)
    .eq("owner_id", context.userId)
    .single();
  if (aErr) throw new Error("Solo el propietario de la evaluación puede inscribir aspirantes.");

  const rows = data.candidates
    .filter((c) => c.name.trim())
    .map((c) => ({
      assessment_id: assessment.id,
      owner_id: context.userId,
      name: c.name.trim(),
      email: c.email?.trim() ? c.email.trim().toLowerCase() : null,
      identifier: c.identifier?.trim() ? c.identifier.trim() : null,
      token: newToken(),
      expires_at: data.expiresAt ?? null,
    }));
  if (rows.length === 0) throw new Error("Indica al menos un nombre de aspirante.");

  const { data: inserted, error } = await context.supabase
    .from("assessment_candidates")
    .insert(rows)
    .select(CANDIDATE_COLUMNS);
  if (error) throw new Error(error.message);
  return { candidates: (inserted ?? []).map(mapCandidate) };
}

export async function updateCandidateHandler(
  data: {
    id: string;
    name?: string;
    email?: string | null;
    identifier?: string | null;
    note?: string;
    expiresAt?: string | null;
    regenerateToken?: boolean;
    reset?: boolean;
  },
  context: any,
) {
  const patch: Record<string, unknown> = {};
  if (data.name !== undefined) patch['name'] = data.name.trim();
  if (data.email !== undefined) patch['email'] = data.email?.trim() ? data.email.trim().toLowerCase() : null;
  if (data.identifier !== undefined)
    patch['identifier'] = data.identifier?.trim() ? data.identifier.trim() : null;
  if (data.note !== undefined) patch['note'] = data.note;
  if (data.expiresAt !== undefined) patch['expires_at'] = data.expiresAt;
  if (data.regenerateToken) patch['token'] = newToken();
  if (data.reset) {
    patch['status'] = "invited";
    patch['started_at'] = null;
    patch['submitted_at'] = null;
    patch['submission_id'] = null;
  }

  const { data: row, error } = await context.supabase
    .from("assessment_candidates")
    .update(patch)
    .eq("id", data.id)
    .eq("owner_id", context.userId)
    .select(CANDIDATE_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return { candidate: mapCandidate(row) };
}

export async function deleteCandidateHandler(data: { id: string }, context: any) {
  const { error } = await context.supabase
    .from("assessment_candidates")
    .delete()
    .eq("id", data.id)
    .eq("owner_id", context.userId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

// ─────────────────────────── Examen público por token ───────────────────────────

function toExamQuestion(q: AssessmentQuestion, index: number): ExamQuestion {
  return {
    id: q.id || `q${index + 1}`,
    prompt: q.prompt ?? "",
    type: q.type ?? "narrative",
    maxPoints: Number(q.maxPoints ?? 1),
    options: (q.options ?? []).map((o, i) => ({ id: o.id || `o${i + 1}`, text: o.text ?? "" })),
  };
}

async function loadByToken(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: candidate, error } = await supabaseAdmin
    .from("assessment_candidates")
    .select(`${CANDIDATE_COLUMNS}, owner_id`)
    .eq("token", token)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!candidate) throw new Error("Este enlace de examen no es válido.");
  if (candidate.expires_at && new Date(candidate.expires_at).getTime() < Date.now())
    throw new Error("El plazo para realizar este examen ha finalizado.");

  const { data: assessment, error: aErr } = await supabaseAdmin
    .from("assessments")
    .select("id, title, prompt, instructions, questions, rubric, max_score, handwriting_weight_pct, feedback_tone, status, area_key, created_at, updated_at")
    .eq("id", candidate.assessment_id)
    .single();
  if (aErr) throw new Error(aErr.message);

  return { supabaseAdmin, candidate, assessment: mapAssessment(assessment) };
}

/**
 * El candidato NO debe ver el texto base ni referencias a él: los enunciados
 * se limpian de expresiones tipo "según el texto" antes de enviarlos.
 */
function stripSourceReferences(value: string): string {
  return value
    .replace(/\s*(seg[uú]n|de acuerdo con|conforme a|a partir de|bas[aá]ndose en|con base en)\s+(el|dicho)?\s*texto( base| proporcionado| anterior| adjunto| le[ií]do)?\s*(,|:)?\s*/gi, " ")
    .replace(/\s*\((?:seg[uú]n|ver)[^)]*texto[^)]*\)\s*/gi, " ")
    .replace(/\s*(en|del|en el|dentro del)\s+texto( base| proporcionado| anterior| adjunto)?\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^\s*[,:;]\s*/, "")
    .replace(/^([a-záéíóúñ])/, (m) => m.toUpperCase())
    .trim();
}

export async function getExamHandler(data: { token: string }): Promise<ExamPayload> {
  const { candidate, assessment } = await loadByToken(data.token);
  return {
    candidate: {
      name: candidate.name,
      identifier: candidate.identifier ?? null,
      status: (candidate.status ?? "invited") as CandidateStatus,
    },
    assessment: {
      id: assessment.id,
      title: assessment.title,
      instructions: assessment.instructions ? stripSourceReferences(assessment.instructions) : null,
      maxScore: assessment.maxScore,
      questions: assessment.questions.map(toExamQuestion).map((q) => ({
        ...q,
        prompt: stripSourceReferences(q.prompt),
      })),
    },
  };
}

export async function startExamHandler(data: { token: string }) {
  const { supabaseAdmin, candidate } = await loadByToken(data.token);
  if (candidate.status === "submitted") throw new Error("Ya has entregado este examen.");
  if (candidate.status !== "started") {
    const { error } = await supabaseAdmin
      .from("assessment_candidates")
      .update({ status: "started", started_at: new Date().toISOString() })
      .eq("id", candidate.id);
    if (error) throw new Error(error.message);
  }
  return { ok: true };
}

function formatAnswers(questions: ExamQuestion[], answers: ExamAnswerInput[]) {
  const byId = new Map(answers.map((a) => [a.questionId, a]));
  return questions
    .map((q, i) => {
      const a = byId.get(q.id);
      const chosen = (a?.optionIds ?? [])
        .map((id) => q.options.find((o) => o.id === id)?.text ?? id)
        .filter(Boolean);
      const body = [chosen.length ? `Opción elegida: ${chosen.join(" | ")}` : "", a?.text?.trim() ?? ""]
        .filter(Boolean)
        .join("\n");
      return `Pregunta ${i + 1}: ${q.prompt}\nRespuesta: ${body || "(sin responder)"}`;
    })
    .join("\n\n");
}

export async function submitExamHandler(data: { token: string; answers: ExamAnswerInput[] }) {
  const { supabaseAdmin, candidate, assessment } = await loadByToken(data.token);
  if (candidate.status === "submitted") throw new Error("Ya has entregado este examen.");

  const questions = assessment.questions.map(toExamQuestion);
  const text = formatAnswers(questions, data.answers);

  const { data: submission, error } = await supabaseAdmin
    .from("assessment_submissions")
    .insert({
      assessment_id: assessment.id,
      owner_id: candidate.owner_id,
      candidate_name: candidate.name,
      candidate_identifier: candidate.identifier ?? null,
      source_kind: "digital",
      extracted_text: text,
      max_score: assessment.maxScore,
      status: "pending",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { error: cErr } = await supabaseAdmin
    .from("assessment_candidates")
    .update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
      submission_id: submission.id,
    })
    .eq("id", candidate.id);
  if (cErr) throw new Error(cErr.message);

  return { ok: true, submissionId: submission.id as string };
}
