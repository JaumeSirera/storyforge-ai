import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAnyAuth } from "@/lib/require-auth";
import {
  createAssessmentFromBankHandler,
  deleteBankItemHandler,
  generateBankQuestionsHandler,
  importAssessmentQuestionsHandler,
  listBankItemsHandler,
  listBankVersionsHandler,
  restoreBankVersionHandler,
  updateBankItemHandler,
} from "./question-bank.server";

const QuestionTypeEnum = z.enum([
  "narrative",
  "single_choice",
  "multiple_choice",
  "true_false",
  "numeric",
]);

const QuestionInput = z.object({
  id: z.string().max(40).default(""),
  prompt: z.string().max(2000).default(""),
  type: QuestionTypeEnum.default("narrative"),
  maxPoints: z.number().min(0).max(100).default(1),
  keyElements: z.array(z.string().max(400)).max(20).default([]),
  options: z
    .array(z.object({ id: z.string().max(8).default(""), text: z.string().max(600).default("") }))
    .max(8)
    .default([]),
  correctOptionIds: z.array(z.string().max(8)).max(8).default([]),
  correctAnswer: z.string().max(400).default(""),
  explanation: z.string().max(1000).default(""),
});

const TagsInput = z.array(z.string().trim().min(1).max(40)).max(10);

export const listBankItems = createServerFn({ method: "GET" })
  .middleware([requireAnyAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        subject: z.string().max(40).nullable().optional(),
        type: QuestionTypeEnum.nullable().optional(),
        areaKey: z.string().max(80).nullable().optional(),
        search: z.string().max(200).nullable().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => listBankItemsHandler(data, context));

export const listBankVersions = createServerFn({ method: "GET" })
  .middleware([requireAnyAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => listBankVersionsHandler(data, context));

export const generateBankQuestions = createServerFn({ method: "POST" })
  .middleware([requireAnyAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        prompt: z.string().trim().min(10).max(4000),
        questionCount: z.number().min(1).max(20).default(5),
        subject: z.string().trim().max(40).nullable().optional(),
        areaKey: z.string().trim().max(80).nullable().optional(),
        questionTypes: z.array(QuestionTypeEnum).min(1).max(5).default(["narrative"]),
        sourceText: z.string().trim().max(30000).nullable().optional(),
        allowOutsideSource: z.boolean().default(false),
        tags: TagsInput.default([]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => generateBankQuestionsHandler(data, context));

export const importAssessmentQuestions = createServerFn({ method: "POST" })
  .middleware([requireAnyAuth])
  .inputValidator((input: unknown) =>
    z.object({ assessmentId: z.string().uuid(), tags: TagsInput.default([]) }).parse(input),
  )
  .handler(async ({ data, context }) => importAssessmentQuestionsHandler(data, context));

export const updateBankItem = createServerFn({ method: "POST" })
  .middleware([requireAnyAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        question: QuestionInput,
        tags: TagsInput.optional(),
        note: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => updateBankItemHandler(data, context));

export const restoreBankVersion = createServerFn({ method: "POST" })
  .middleware([requireAnyAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), version: z.number().min(1).max(500) }).parse(input),
  )
  .handler(async ({ data, context }) => restoreBankVersionHandler(data, context));

export const deleteBankItem = createServerFn({ method: "POST" })
  .middleware([requireAnyAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => deleteBankItemHandler(data, context));

export const createAssessmentFromBank = createServerFn({ method: "POST" })
  .middleware([requireAnyAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        title: z.string().trim().min(1).max(160),
        itemIds: z.array(z.string().uuid()).min(1).max(40),
        areaKey: z.string().trim().max(80).nullable().optional(),
        handwritingWeightPct: z.number().min(0).max(50).default(15),
        instructions: z.string().max(4000).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => createAssessmentFromBankHandler(data, context));
