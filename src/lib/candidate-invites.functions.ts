import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { listInviteEmailsHandler, sendInviteEmailsHandler } from "./candidate-invites.server";

export const listCandidateInviteEmails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ assessmentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => listInviteEmailsHandler(data, context));

export const sendCandidateInviteEmails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        assessmentId: z.string().uuid(),
        candidateIds: z.array(z.string().uuid()).max(200).optional(),
        onlyPendingOrFailed: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => sendInviteEmailsHandler(data, context));
