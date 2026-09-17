/**
 * Contexto de la sesión propia (cuentas en el servidor del cliente).
 *
 * Sustituye progresivamente a `supabase.auth` en la interfaz. Mientras la
 * migración no esté completa, `enabled === false` significa que las cuentas
 * siguen en Lovable Cloud y las pantallas usan el flujo anterior.
 */

import React from "react";
import {
  clearSession,
  onSessionChange,
  readSession,
  storeSession,
  type StoredSession,
} from "./auth-session";
import {
  loginAccount,
  logoutAccount,
  ownAccountsStatus,
  registerAccount,
} from "./accounts.functions";
import type { AccountUser } from "./accounts.server";

interface AuthState {
  /** ¿Están activas las cuentas propias? */
  enabled: boolean;
  loading: boolean;
  user: AccountUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthState | null>(null);

export function OwnAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<StoredSession | null>(null);
  const [enabled, setEnabled] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setSession(readSession());
    const stop = onSessionChange(setSession);
    ownAccountsStatus()
      .then((status) => setEnabled(status.enabled))
      .catch(() => setEnabled(false))
      .finally(() => setLoading(false));
    return stop;
  }, []);

  const value = React.useMemo<AuthState>(
    () => ({
      enabled,
      loading,
      user: session?.user ?? null,
      async signIn(email, password) {
        storeSession(await loginAccount({ data: { email, password } }));
      },
      async signUp(email, password, fullName) {
        storeSession(
          await registerAccount({ data: { email, password, full_name: fullName } }),
        );
      },
      async signOut() {
        const current = readSession();
        clearSession();
        if (current) {
          await logoutAccount({ data: { refresh_token: current.refresh_token } }).catch(() => {});
        }
      },
    }),
    [enabled, loading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useOwnAuth(): AuthState {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useOwnAuth debe usarse dentro de OwnAuthProvider");
  return ctx;
}
