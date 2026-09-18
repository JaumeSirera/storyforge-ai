/**
 * Adjunta a cada llamada al servidor el token de la sesión propia; si todavía
 * no existe (transición), deja pasar el token antiguo de Lovable Cloud.
 */

import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getValidAccessToken } from "./auth-session";

export const attachAnyAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const own = await getValidAccessToken().catch(() => null);
  if (own) {
    return next({ headers: { Authorization: `Bearer ${own}` } });
  }
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
});
