import { createServerFn } from "@tanstack/react-start";
import { resolveIceConfig } from "./ice.server";

export const getIceConfig = createServerFn({ method: "GET" }).handler(async () => {
  return await resolveIceConfig();
});
