/**
 * Sesión de las cuentas propias en el navegador.
 *
 * Guarda el token de acceso y el de refresco en localStorage y los renueva
 * automáticamente antes de que caduquen. Durante la transición conviven con la
 * sesión antigua de Lovable Cloud: si no hay sesión propia, el resto de la
 * aplicación sigue usando la anterior.
 */

import type { AccountSession, AccountUser } from "./accounts.server";

const KEY = "xandralyze.session";
const SKEW_MS = 60_000;

export interface StoredSession {
  access_token: string;
  refresh_token: string;
  /** Momento (ms epoch) en el que caduca el token de acceso. */
  expires_at: number;
  user: AccountUser;
}

type Listener = (session: StoredSession | null) => void;

const listeners = new Set<Listener>();
let cached: StoredSession | null | undefined;
let refreshing: Promise<StoredSession | null> | null = null;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function readSession(): StoredSession | null {
  if (!isBrowser()) return null;
  if (cached !== undefined) return cached;
  try {
    const raw = window.localStorage.getItem(KEY);
    cached = raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    cached = null;
  }
  return cached;
}

export function storeSession(session: AccountSession): StoredSession {
  const stored: StoredSession = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: Date.now() + Math.max(60, session.expires_in) * 1000,
    user: session.user,
  };
  cached = stored;
  if (isBrowser()) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(stored));
    } catch {
      /* almacenamiento no disponible */
    }
  }
  for (const listener of listeners) listener(stored);
  return stored;
}

export function clearSession(): void {
  cached = null;
  if (isBrowser()) {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* almacenamiento no disponible */
    }
  }
  for (const listener of listeners) listener(null);
}

export function onSessionChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Devuelve un token de acceso válido, renovándolo si está a punto de caducar.
 * Si el refresco falla, cierra la sesión.
 */
export async function getValidAccessToken(): Promise<string | null> {
  const session = readSession();
  if (!session) return null;
  if (session.expires_at - SKEW_MS > Date.now()) return session.access_token;

  // Si ya hay una renovación en curso (p. ej. esta misma llamada es la propia
  // renovación pasando por el middleware), no esperarla: evitaría un bloqueo.
  if (refreshing) return session.expires_at > Date.now() ? session.access_token : null;
  {
    refreshing = (async () => {
      try {
        const { refreshAccountSession } = await import("./accounts.functions");
        const fresh = await refreshAccountSession({ data: { refresh_token: session.refresh_token } });
        return storeSession(fresh);
      } catch {
        clearSession();
        return null;
      } finally {
        refreshing = null;
      }
    })();
  }
  const renewed = await refreshing!;
  return renewed?.access_token ?? null;
}
