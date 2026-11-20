import type { QuestionType } from "./assessments-shared";

/** Estado del aspirante inscrito en una evaluación. */
export const CANDIDATE_STATUSES = ["invited", "started", "submitted"] as const;
export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];

export const CANDIDATE_STATUS_LABELS: Record<CandidateStatus, string> = {
  invited: "Inscrito (sin empezar)",
  started: "Examen empezado",
  submitted: "Examen entregado",
};

export interface AssessmentCandidate {
  id: string;
  assessmentId: string;
  name: string;
  email: string | null;
  identifier: string | null;
  token: string;
  status: CandidateStatus;
  submissionId: string | null;
  timeExpired?: boolean;
  expiresAt: string | null;
  startedAt: string | null;
  submittedAt: string | null;
  note: string;
  createdAt: string;
}

/** Pregunta tal y como la ve el candidato (sin claves de corrección). */
export interface ExamQuestion {
  id: string;
  prompt: string;
  type: QuestionType;
  maxPoints: number;
  options: { id: string; text: string }[];
}

export interface ExamPayload {
  candidate: {
    name: string;
    identifier: string | null;
    status: CandidateStatus;
    /** ISO del momento en que el aspirante abrió el examen (null si aún no ha empezado). */
    startedAt: string | null;
    /** ISO del momento en que entregó el examen (null si aún no ha entregado). */
    submittedAt: string | null;
    timeExpired: boolean;
  };
  /** Hora del servidor al servir el examen, para calcular el tiempo restante sin depender del reloj local. */
  serverNow: string;
  assessment: {
    id: string;
    title: string;
    instructions: string | null;
    /** Texto de lectura del examen, visible para el aspirante (null si no hay). */
    sourceText: string | null;
    /** Minutos disponibles para completar el examen (null = sin límite). */
    timeLimitMin: number | null;

    maxScore: number;
    questions: ExamQuestion[];
  };
}

export interface ExamAnswerInput {
  questionId: string;
  text: string;
  optionIds: string[];
  /** true cuando la respuesta se dio hablando y es la transcripción automática de la voz. */
  spoken?: boolean;
}

/** Línea que acompaña a las respuestas orales en el texto de la entrega (la lee la corrección por IA). */
export const ORAL_SPOKEN_NOTE = "Modo: respuesta oral, transcrita automáticamente de la voz del aspirante";
/** Línea para preguntas orales que el aspirante tuvo que escribir porque su navegador no permitía hablar. */
export const ORAL_TYPED_NOTE = "Modo: pregunta oral respondida por escrito (el navegador no permitía responder hablando)";

/**
 * Convierte las respuestas del examen online en el texto de la entrega que se corrige.
 * Mantiene el formato «Pregunta N: …\nRespuesta: …» que leen la corrección y la detección de copias.
 */
export function formatExamAnswers(questions: ExamQuestion[], answers: ExamAnswerInput[]) {
  const byId = new Map(answers.map((a) => [a.questionId, a]));
  return questions
    .map((q, i) => {
      const a = byId.get(q.id);
      const chosen = (a?.optionIds ?? [])
        .map((id) => q.options.find((o) => o.id === id)?.text ?? id)
        .filter(Boolean);
      const text = a?.text?.trim() ?? "";
      const body = [chosen.length ? `Opción elegida: ${chosen.join(" | ")}` : "", text]
        .filter(Boolean)
        .join("\n");
      const mode =
        q.type === "oral" && text ? `\n${a?.spoken ? ORAL_SPOKEN_NOTE : ORAL_TYPED_NOTE}` : "";
      return `Pregunta ${i + 1}: ${q.prompt}${mode}\nRespuesta: ${body || "(sin responder)"}`;
    })
    .join("\n\n");
}

/** Enlace público al examen para un aspirante. */
export function examUrl(token: string, origin?: string) {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/exam/${token}`;
}
