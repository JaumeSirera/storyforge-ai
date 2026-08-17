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
  candidate: { name: string; identifier: string | null; status: CandidateStatus };
  assessment: {
    id: string;
    title: string;
    instructions: string | null;
    sourceText: string | null;
    maxScore: number;
    questions: ExamQuestion[];
  };
}

export interface ExamAnswerInput {
  questionId: string;
  text: string;
  optionIds: string[];
}

/** Enlace público al examen para un aspirante. */
export function examUrl(token: string, origin?: string) {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/exam/${token}`;
}
