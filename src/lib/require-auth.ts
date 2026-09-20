/**
 * Middleware de autenticación dual (transición).
 *
 * Acepta el token de la sesión propia (API PHP + MySQL) y, mientras la
 * migración no termine, también el token antiguo de Lovable Cloud. El contexto
 * mantiene la misma forma que `requireAnyAuth` (`supabase`, `userId`,
 * `claims`) para que los módulos existentes no cambien.
 */

import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type AuthMode = "cloud" | "own";

function bearer(): string {
  const request = getRequest();
  const header = request?.headers?.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) {
    throw new Error("Unauthorized: No authorization header provided");
  }
  const token = header.slice("Bearer ".length).trim();
  if (!token) throw new Error("Unauthorized: No token provided");
  return token;
}

function supabaseForToken(token: string) {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Missing Supabase environment variables");
  return createClient<Database>(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export const requireAnyAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const token = bearer();
  const supabase = supabaseForToken(token);

  // 1) Token antiguo de Lovable Cloud (sigue siendo válido durante la transición).
  const { data, error } = await supabase.auth.getClaims(token).catch(() => ({
    data: null,
    error: new Error("invalid"),
  }));
  if (!error && data?.claims?.sub) {
    return next({
      context: {
        supabase,
        userId: data.claims.sub as string,
        claims: data.claims as unknown as Record<string, unknown>,
        accessToken: token,
        authMode: "cloud" as AuthMode,
      },
    });
  }

  // 2) Token de las cuentas propias.
  const { accountsApi, ownAccountsEnabled } = await import("./accounts.server");
  if (!ownAccountsEnabled()) throw new Error("Unauthorized: Invalid token");
  const user = await accountsApi.me(token).catch(() => null);
  if (!user?.id) throw new Error("Unauthorized: Invalid token");

  return next({
    context: {
      supabase,
      userId: user.id,
      claims: { sub: user.id, email: user.email, roles: user.roles } as Record<string, unknown>,
      accessToken: token,
      authMode: "own" as AuthMode,
    },
  });
});
