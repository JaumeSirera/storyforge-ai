import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  deleteAnnotationHandler,
  listAnnotationsHandler,
  saveAnnotationHandler,
} from "./assessment-annotations.server";
import { ANNOTATION_KINDS } from "./assessments-shared";

export const listAnnotations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ submissionId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => listAnnotationsHandler(data, context));

export const saveAnnotation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        submissionId: z.string().uuid(),
        pagePath: z.string().min(1),
        pageIndex: z.number().int().min(0).max(200),
        kind: z.enum(ANNOTATION_KINDS),
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
        w: z.number().min(0).max(1),
        h: z.number().min(0).max(1),
        correction: z.string().max(4000).default(""),
        comment: z.string().max(4000).default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => saveAnnotationHandler(data, context));

export const deleteAnnotation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => deleteAnnotationHandler(data, context));
