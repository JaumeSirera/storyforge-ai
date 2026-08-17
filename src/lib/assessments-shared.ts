import { z } from "zod";

/** Tipos de pregunta soportados en la primera fase del módulo de evaluaciones escritas. */
export const QUESTION_TYPES = ["narrative"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QuestionSchema = z.object({
  id: z.string().default(""),
  prompt: z.string().default(""),
  type: z.enum(QUESTION_TYPES).default("narrative"),
  maxPoints: z.number().default(1),
  keyElements: z.array(z.string()).default([]),
});
export type AssessmentQuestion = z.infer<typeof QuestionSchema>;

export const RubricCriterionSchema = z.object({
  id: z.string().default(""),
  name: z.string().default(""),
  description: z.string().default(""),
  weightPct: z.number().default(0),
  levels: z
    .array(
      z.object({
        label: z.string().default(""),
        descriptor: z.string().default(""),
        pct: z.number().default(0),
      }),
    )
    .default([]),
});
export type RubricCriterion = z.infer<typeof RubricCriterionSchema>;

export const BlueprintSchema = z.object({
  title: z.string().default(""),
  instructions: z.string().default(""),
  questions: z.array(QuestionSchema).default([]),
  rubric: z.array(RubricCriterionSchema).default([]),
});
export type AssessmentBlueprint = z.infer<typeof BlueprintSchema>;

/**
 * Análisis del grafismo: hechos observables (0-100) + hipótesis de trabajo
 * explícitamente no concluyentes, revisables por el evaluador.
 */
export const HandwritingSchema = z.object({
  legibility: z.number().default(0),
  structure: z.number().default(0),
  cleanliness: z.number().default(0),
  spacing: z.number().default(0),
  consistency: z.number().default(0),
  score: z.number().default(0),
  observations: z.array(z.string()).default([]),
  corrections: z.string().default(""),
  hypotheses: z
    .array(
      z.object({
        hypothesis: z.string().default(""),
        basis: z.string().default(""),
        confidence: z.string().default("media"),
      }),
    )
    .default([]),
});
export type HandwritingAnalysis = z.infer<typeof HandwritingSchema>;

export const EvaluationSchema = z.object({
  score: z.number().default(0),
  maxScore: z.number().default(10),
  contentScore: z.number().default(0),
  handwritingScore: z.number().default(0),
  headline: z.string().default(""),
  summary: z.string().default(""),
  answers: z
    .array(
      z.object({
        questionId: z.string().default(""),
        question: z.string().default(""),
        answerSummary: z.string().default(""),
        score: z.number().default(0),
        maxPoints: z.number().default(0),
        strengths: z.array(z.string()).default([]),
        gaps: z.array(z.string()).default([]),
        evidence: z.string().default(""),
      }),
    )
    .default([]),
  criteria: z
    .array(
      z.object({
        name: z.string().default(""),
        score: z.number().default(0),
        maxScore: z.number().default(100),
        justification: z.string().default(""),
      }),
    )
    .default([]),
  competencies: z
    .array(
      z.object({
        name: z.string().default(""),
        level: z.string().default(""),
        evidence: z.string().default(""),
      }),
    )
    .default([]),
  handwriting: HandwritingSchema.default(() => HandwritingSchema.parse({})),
  recommendations: z.array(z.string()).default([]),
  conclusion: z.string().default(""),
});
export type AssessmentEvaluation = z.infer<typeof EvaluationSchema>;

export interface AssessmentRecord {
  id: string;
  title: string;
  areaKey: string | null;
  prompt: string | null;
  instructions: string | null;
  questions: AssessmentQuestion[];
  rubric: RubricCriterion[];
  maxScore: number;
  handwritingWeightPct: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  submissionCount?: number;
}

export interface SubmissionPage {
  path: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
}

export interface SubmissionRecord {
  id: string;
  assessmentId: string;
  candidateName: string;
  candidateIdentifier: string | null;
  sourceKind: "handwritten" | "digital";
  pages: SubmissionPage[];
  extractedText: string | null;
  evaluation: AssessmentEvaluation | null;
  score: number | null;
  maxScore: number | null;
  status: "pending" | "grading" | "graded" | "failed";
  errorMessage: string | null;
  gradedAt: string | null;
  createdAt: string;
}

export function gradeLabel(score: number, maxScore: number): string {
  if (!maxScore) return "—";
  const pct = (score / maxScore) * 100;
  if (pct >= 90) return "Excelente";
  if (pct >= 75) return "Notable";
  if (pct >= 60) return "Bien";
  if (pct >= 50) return "Suficiente";
  return "Insuficiente";
}

/** Tipos de marca que el evaluador puede poner sobre una página escaneada. */
export const ANNOTATION_KINDS = ["transcription", "handwriting", "content"] as const;
export type AnnotationKind = (typeof ANNOTATION_KINDS)[number];

export const ANNOTATION_KIND_LABELS: Record<AnnotationKind, string> = {
  transcription: "Corrección de transcripción",
  handwriting: "Observación de grafismo",
  content: "Nota de contenido",
};

/** Marca rectangular (coordenadas normalizadas 0-1) sobre una página de la entrega. */
export interface SubmissionAnnotation {
  id: string;
  submissionId: string;
  pagePath: string;
  pageIndex: number;
  kind: AnnotationKind;
  x: number;
  y: number;
  w: number;
  h: number;
  correction: string;
  comment: string;
  createdAt: string;
  updatedAt: string;
}
