import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { resolveIceConfig } from "./ice.server";

/**
 * Configuración ICE para el mosaico multicámara. Es pública porque también la
 * piden los invitados (página de unirse a una captura): si hay sesión se usan
 * las claves TURN de ese usuario; si no, las del administrador.
 */
export const getIceConfig = createServerFn({ method: "GET" }).handler(async () => {
  const header = getRequest()?.headers?.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (token) {
    try {
      const { accountsApi, ownAccountsEnabled } = await import("./accounts.server");
      if (ownAccountsEnabled()) {
        const user = await accountsApi.me(token).catch(() => null);
        if (user?.id) {
          const { createClient } = await import("@supabase/supabase-js");
          const { assessDb } = await import("./assessments-repo.server");
          const url = process.env["SUPABASE_URL"];
          const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
          const base = createClient(url!, key!, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
          });
          return await resolveIceConfig(user.id, assessDb({ supabase: base }));
        }
      }
    } catch {
      // Sin sesión válida: se usa el respaldo del administrador.
    }
  }
  return await resolveIceConfig();
});
