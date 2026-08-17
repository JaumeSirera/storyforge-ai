import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  createAssessmentHandler,
  createSubmissionHandler,
  deleteAssessmentHandler,
  deleteSubmissionHandler,
  getAssessmentHandler,
  getSubmissionHandler,
  gradeSubmissionHandler,
  listAssessmentsHandler,
  regenerateAssessmentHandler,
  validateFiles,
} from "./assessments.server";

export const listAssessments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => listAssessmentsHandler(context));

export const getAssessment = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => getAssessmentHandler(data, context));

export const createAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        title: z.string().trim().min(1).max(160),
        prompt: z.string().trim().max(4000).optional(),
        areaKey: z.string().trim().max(80).nullable().optional(),
        maxScore: z.number().min(1).max(100).default(10),
        handwritingWeightPct: z.number().min(0).max(50).default(15),
        questionCount: z.number().min(1).max(12).default(4),
        generate: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => createAssessmentHandler(data, context));

export const regenerateAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        prompt: z.string().trim().min(10).max(4000),
        questionCount: z.number().min(1).max(12).default(4),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => regenerateAssessmentHandler(data, context));

export const updateAssessmentBlueprint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        instructions: z.string().max(4000).optional(),
        maxScore: z.number().min(1).max(100).optional(),
        handwritingWeightPct: z.number().min(0).max(50).optional(),
        questions: z
          .array(
            z.object({
              id: z.string().max(40).default(""),
              prompt: z.string().max(2000).default(""),
              type: z.literal("narrative").default("narrative"),
              maxPoints: z.number().min(0).max(100).default(1),
              keyElements: z.array(z.string().max(400)).max(20).default([]),
            }),
          )
          .max(20)
          .optional(),
        rubric: z
          .array(
            z.object({
              id: z.string().max(40).default(""),
              name: z.string().max(160).default(""),
              description: z.string().max(1000).default(""),
              weightPct: z.number().min(0).max(100).default(0),
              levels: z
                .array(
                  z.object({
                    label: z.string().max(80).default(""),
                    descriptor: z.string().max(600).default(""),
                    pct: z.number().min(0).max(100).default(0),
                  }),
                )
                .max(8)
                .default([]),
            }),
          )
          .max(15)
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => updateAssessmentBlueprintHandler(data, context));

export const deleteAssessment = createServerFn({ method: "POST" })

  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => deleteAssessmentHandler(data, context));

export const createSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    if (!(input instanceof FormData)) throw new Error("FormData requerido");
    const assessmentId = z.string().uuid().parse(String(input.get("assessmentId") ?? ""));
    const candidateName = z.string().trim().min(1).max(160).parse(String(input.get("candidateName") ?? ""));
    const candidateIdentifier = String(input.get("candidateIdentifier") ?? "").trim() || null;
    const sourceKind = z.enum(["handwritten", "digital"]).parse(String(input.get("sourceKind") ?? "handwritten"));
    const typedText = String(input.get("typedText") ?? "");
    const files = input.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0 && !typedText.trim()) {
      throw new Error("Adjunta al menos una página o pega el texto de la entrega.");
    }
    validateFiles(files);
    return { assessmentId, candidateName, candidateIdentifier, sourceKind, typedText, files };
  })
  .handler(async ({ data, context }) => createSubmissionHandler(data, context));

export const getSubmission = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => getSubmissionHandler(data, context));

export const gradeSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => gradeSubmissionHandler(data, context));

export const deleteSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => deleteSubmissionHandler(data, context));
