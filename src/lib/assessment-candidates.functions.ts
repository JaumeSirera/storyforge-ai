import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAnyAuth } from "@/lib/require-auth";
import {
  addCandidatesHandler,
  deleteCandidateHandler,
  getExamHandler,
  listCandidatesHandler,
  startExamHandler,
  submitExamHandler,
  updateCandidateHandler,
} from "./assessment-candidates.server";

export const listAssessmentCandidates = createServerFn({ method: "GET" })
  .middleware([requireAnyAuth])
  .inputValidator((input: unknown) => z.object({ assessmentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => listCandidatesHandler(data, context));

export const addAssessmentCandidates = createServerFn({ method: "POST" })
  .middleware([requireAnyAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        assessmentId: z.string().uuid(),
        candidates: z
          .array(
            z.object({
              name: z.string().trim().min(1).max(160),
              email: z.string().trim().max(200).nullable().optional(),
              identifier: z.string().trim().max(80).nullable().optional(),
            }),
          )
          .min(1)
          .max(200),
        expiresAt: z.string().datetime().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => addCandidatesHandler(data, context));

export const updateAssessmentCandidate = createServerFn({ method: "POST" })
  .middleware([requireAnyAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(160).optional(),
        email: z.string().trim().max(200).nullable().optional(),
        identifier: z.string().trim().max(80).nullable().optional(),
        note: z.string().max(600).optional(),
        expiresAt: z.string().datetime().nullable().optional(),
        regenerateToken: z.boolean().optional(),
        reset: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => updateCandidateHandler(data, context));

export const deleteAssessmentCandidate = createServerFn({ method: "POST" })
  .middleware([requireAnyAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => deleteCandidateHandler(data, context));

// ─── Examen público (acceso solo con token privado del aspirante) ───

const TokenInput = z.object({
  token: z.string().trim().min(20).max(120),
  /** Versión del cliente que realiza la acción (para el log de auditoría). */
  clientVersion: z.string().trim().max(80).optional(),
});

export const getExam = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => TokenInput.pick({ token: true }).parse(input))
  .handler(async ({ data }) => getExamHandler(data));

export const startExam = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TokenInput.parse(input))
  .handler(async ({ data }) => startExamHandler(data));

export const submitExam = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    TokenInput.extend({
      answers: z
        .array(
          z.object({
            questionId: z.string().max(60),
            text: z.string().max(20000).default(""),
            optionIds: z.array(z.string().max(20)).max(12).default([]),
          }),
        )
        .max(60),
      auto: z.boolean().default(false),
    }).parse(input),
  )
  .handler(async ({ data }) => submitExamHandler(data));
