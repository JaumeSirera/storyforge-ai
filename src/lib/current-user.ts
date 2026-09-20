import { supabase } from "@/integrations/supabase/client";
import { readSession } from "@/lib/auth-session";

export type CurrentUser = {
  id: string;
  email: string | null;
  full_name: string | null;
};

/**
 * Usuario actual, sea de las cuentas propias (API PHP) o de la forma anterior.
 * Devuelve null si no hay sesión.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const own = readSession();
  if (own?.user) {
    return {
      id: own.user.id,
      email: own.user.email ?? null,
      full_name: own.user.full_name ?? null,
    };
  }
  const { data } = await supabase.auth.getUser();
  const u = data.user;
  if (!u) return null;
  return {
    id: u.id,
    email: u.email ?? null,
    full_name: (u.user_metadata?.full_name as string | undefined) ?? null,
  };
}

export async function isAuthenticated(): Promise<boolean> {
  if (readSession()) return true;
  const { data } = await supabase.auth.getSession();
  return !!data.session;
}
