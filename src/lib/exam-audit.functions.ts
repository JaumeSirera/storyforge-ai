import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAnyAuth } from "@/lib/require-auth";
import { listExamAuditHandler } from "./exam-audit.server";

export const listExamAudit = createServerFn({ method: "GET" })
  .middleware([requireAnyAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        assessmentId: z.string().uuid(),
        candidateId: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => listExamAuditHandler(data, context));
