import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  listCollaboratorsHandler,
  removeCollaboratorHandler,
  setSubmissionApprovalHandler,
  upsertCollaboratorHandler,
} from "./assessment-roles.server";

const RoleEnum = z.enum(["corrector", "anotador", "aprobador", "revisor"]);

export const listAssessmentCollaborators = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ assessmentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => listCollaboratorsHandler(data, context));

export const upsertAssessmentCollaborator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        assessmentId: z.string().uuid(),
        email: z.string().trim().email().max(200),
        role: RoleEnum,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => upsertCollaboratorHandler(data, context));

export const removeAssessmentCollaborator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => removeCollaboratorHandler(data, context));

export const setSubmissionApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["pending", "approved", "rejected"]),
        note: z.string().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => setSubmissionApprovalHandler(data, context));
