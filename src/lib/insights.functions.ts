import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAnyAuth } from "@/lib/require-auth";
import { REPORT_ROLES } from "./insights-shared";
import { deleteSessionInsightsHandler, generateSessionInsightsHandler, getSessionInsightsHandler } from "./insights.server";

export const getSessionInsights = createServerFn({ method: "GET" })
  .middleware([requireAnyAuth])
  .inputValidator((input: unknown) => z.object({ captureSessionId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => getSessionInsightsHandler(data, context));

export const generateSessionInsights = createServerFn({ method: "POST" })
  .middleware([requireAnyAuth])
  .inputValidator((input: unknown) => z.object({
    captureSessionId: z.string().uuid(),
    focus: z.string().trim().max(500).optional(),
    role: z.enum(REPORT_ROLES).default("entrevistador"),
  }).parse(input))
  .handler(async ({ data, context }) => generateSessionInsightsHandler(data, context));

export const deleteSessionInsights = createServerFn({ method: "POST" })
  .middleware([requireAnyAuth])
  .inputValidator((input: unknown) => z.object({ captureSessionId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => deleteSessionInsightsHandler(data, context));