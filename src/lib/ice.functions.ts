import { createServerFn } from "@tanstack/react-start";
import { requireAnyAuth } from "@/lib/require-auth";
import { resolveIceConfig } from "./ice.server";

export const getIceConfig = createServerFn({ method: "GET" })
  .middleware([requireAnyAuth])
  .handler(async ({ context }) => {
    return await resolveIceConfig(context.userId, context.supabase);
  });
