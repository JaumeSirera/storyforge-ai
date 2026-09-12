import type {
  AssessmentCandidate,
  CandidateStatus,
  ExamAnswerInput,
  ExamPayload,
  ExamQuestion,
} from "./assessment-candidates-shared";
import { mapAssessment } from "./assessments.server";
import { logExamAudit } from "./exam-audit.server";
import type { AssessmentQuestion } from "./assessments-shared";
import { assessDb, assessAdminDb } from "./assessments-repo.server";

const CANDIDATE_COLUMNS =
  "id, assessment_id, name, email, identifier, token, status, submission_id, expires_at, started_at, submitted_at, note, created_at, time_expired";

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
    timeExpired: Boolean(row.time_expired),
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
  const { data: rows, error } = await assessDb(context)
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
  const { data: assessment, error: aErr } = await assessDb(context)
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

  const { data: inserted, error } = await assessDb(context)
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

  const { data: row, error } = await assessDb(context)
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
  const { error } = await assessDb(context)
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
  const supabaseAdmin = await assessAdminDb();
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
    .select("id, title, prompt, instructions, questions, rubric, max_score, handwriting_weight_pct, time_limit_min, feedback_tone, status, area_key, created_at, updated_at")
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
      startedAt: candidate.started_at ?? null,
      submittedAt: candidate.submitted_at ?? null,
      timeExpired: Boolean((candidate as any).time_expired),
    },
    serverNow: new Date().toISOString(),
    assessment: {
      id: assessment.id,
      title: assessment.title,
      timeLimitMin: assessment.timeLimitMin,
      instructions: assessment.instructions ? stripSourceReferences(assessment.instructions) : null,
      maxScore: assessment.maxScore,
      questions: assessment.questions.map(toExamQuestion).map((q) => ({
        ...q,
        prompt: stripSourceReferences(q.prompt),
      })),
    },
  };
}

export async function startExamHandler(data: { token: string; clientVersion?: string }) {
  const { supabaseAdmin, candidate } = await loadByToken(data.token);
  if (candidate.status === "submitted") {
    await logExamAudit({
      ownerId: candidate.owner_id,
      assessmentId: candidate.assessment_id,
      candidateId: candidate.id,
      event: "exam_resubmit_attempt",
      clientVersion: data.clientVersion ?? null,
      detail: { phase: "start", submittedAt: candidate.submitted_at },
    });
    throw new Error("Ya has entregado este examen.");
  }
  let startedAt = candidate.started_at ?? null;
  if (candidate.status !== "started" || !startedAt) {
    startedAt = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("assessment_candidates")
      .update({ status: "started", started_at: startedAt })
      .eq("id", candidate.id);
    if (error) throw new Error(error.message);
    await logExamAudit({
      ownerId: candidate.owner_id,
      assessmentId: candidate.assessment_id,
      candidateId: candidate.id,
      event: "exam_started",
      clientVersion: data.clientVersion ?? null,
      detail: { startedAt },
    });
  }
  return { ok: true, startedAt, serverNow: new Date().toISOString() };
}

/** Margen de cortesía (segundos) para absorber latencia de red al entregar al límite. */
const TIME_GRACE_SEC = 30;

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

export async function submitExamHandler(data: {
  token: string;
  answers: ExamAnswerInput[];
  auto?: boolean;
  clientVersion?: string;
}) {
  const { supabaseAdmin, candidate, assessment } = await loadByToken(data.token);
  const auditBase = {
    ownerId: candidate.owner_id,
    assessmentId: candidate.assessment_id,
    candidateId: candidate.id,
    clientVersion: data.clientVersion ?? null,
  };
  if (candidate.status === "submitted") {
    await logExamAudit({
      ...auditBase,
      event: "exam_resubmit_attempt",
      detail: {
        submittedAt: candidate.submitted_at,
        submissionId: candidate.submission_id,
        auto: Boolean(data.auto),
      },
    });
    throw new Error("Ya has entregado este examen.");
  }

  // Validación del tiempo: se acepta la entrega dentro del límite (+ margen) o
  // cuando es el cierre automático al agotarse el tiempo.
  const limitMin = assessment.timeLimitMin;
  let timeExpired = false;
  if (limitMin && limitMin > 0) {
    const startedAt = candidate.started_at ? new Date(candidate.started_at).getTime() : Date.now();
    const elapsedSec = (Date.now() - startedAt) / 1000;
    timeExpired = elapsedSec > limitMin * 60;
    if (timeExpired && !data.auto && elapsedSec > limitMin * 60 + TIME_GRACE_SEC) {
      await logExamAudit({
        ...auditBase,
        event: "exam_submit_rejected_time",
        detail: { elapsedSec: Math.round(elapsedSec), limitMin },
      });
      throw new Error("El tiempo del examen ha finalizado y no se admiten más cambios.");
    }
  }

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

  const submittedAt = new Date().toISOString();
  const { error: cErr } = await supabaseAdmin
    .from("assessment_candidates")
    .update({
      status: "submitted",
      submitted_at: submittedAt,
      submission_id: submission.id,
      time_expired: timeExpired,
    })
    .eq("id", candidate.id);
  if (cErr) throw new Error(cErr.message);

  await logExamAudit({
    ...auditBase,
    event: data.auto ? "exam_auto_submitted" : "exam_submitted",
    detail: {
      submittedAt,
      submissionId: submission.id,
      answers: data.answers.length,
      timeExpired,
      startedAt: candidate.started_at,
    },
  });

  // Corrección automática de la entrega del candidato (actúa como el propietario).
  try {
    const { gradeSubmissionHandler } = await import("./assessments.server");
    await gradeSubmissionHandler(
      { id: submission.id as string },
      { supabase: supabaseAdmin, userId: candidate.owner_id },
    );
  } catch (gradeError: any) {
    console.error("[exam] auto-grade:", gradeError?.message ?? gradeError);
  }

  return { ok: true, submissionId: submission.id as string, submittedAt };
}
