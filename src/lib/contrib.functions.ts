import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAnyAuth } from "@/lib/require-auth";
import { PROPOSAL_KINDS, type ContribMe, type ContribProposal, type ContribRequest } from "./contrib-shared";

type Ctx = { accessToken?: string; authMode?: "cloud" | "own" };

async function api<T>(context: Ctx, path: string, method: "GET" | "POST" = "GET", body?: Record<string, unknown>) {
  if (context.authMode !== "own") {
    throw new Error("La colaboración requiere una cuenta de Xandralyze.");
  }
  const { externalRequest } = await import("./external-data.server");
  return externalRequest<T>({ accessToken: String(context.accessToken ?? ""), method, path, body });
}

export const getMyContrib = createServerFn({ method: "GET" })
  .middleware([requireAnyAuth])
  .handler(async ({ context }) => api<ContribMe>(context, "/contrib/me"));

export const requestCollaborator = createServerFn({ method: "POST" })
  .middleware([requireAnyAuth])
  .inputValidator(
    z.object({
      motivation: z.string().trim().min(20).max(2000),
      skills: z.string().max(500).default(""),
      githubUser: z.string().trim().max(39).default(""),
      consent: z.literal(true),
    }),
  )
  .handler(async ({ data, context }) =>
    api<ContribMe>(context, "/contrib/request", "POST", {
      motivation: data.motivation,
      skills: data.skills,
      github_user: data.githubUser,
      consent: data.consent,
    }),
  );

export const submitProposal = createServerFn({ method: "POST" })
  .middleware([requireAnyAuth])
  .inputValidator(
    z.object({
      kind: z.enum(PROPOSAL_KINDS),
      title: z.string().trim().min(5).max(200),
      description: z.string().trim().min(20).max(8000),
      link: z.string().trim().max(500).default(""),
    }),
  )
  .handler(async ({ data, context }) => api<ContribMe>(context, "/contrib/proposals", "POST", data));

export const adminListContrib = createServerFn({ method: "GET" })
  .middleware([requireAnyAuth])
  .handler(async ({ context }) =>
    api<{ requests: ContribRequest[]; proposals: ContribProposal[] }>(context, "/contrib/admin"),
  );

export const adminDecideContrib = createServerFn({ method: "POST" })
  .middleware([requireAnyAuth])
  .inputValidator(
    z.object({
      type: z.enum(["request", "proposal"]),
      id: z.string().uuid(),
      decision: z.enum(["approved", "rejected", "revoked", "changes"]),
      note: z.string().max(2000).default(""),
    }),
  )
  .handler(async ({ data, context }) =>
    api<{ requests: ContribRequest[]; proposals: ContribProposal[] }>(
      context,
      "/contrib/admin/decide",
      "POST",
      data,
    ),
  );
