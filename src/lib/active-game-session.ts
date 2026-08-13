/**
 * Registro de la simulación en curso: permite que el indicador global de
 * grabación aborte la simulación cuando el usuario detiene y guarda la toma.
 */
const KEY = "pn-active-game-session";

export function setActiveGameSession(sessionId: string) {
  try {
    localStorage.setItem(KEY, sessionId);
  } catch {
    /* almacenamiento no disponible */
  }
}

export function getActiveGameSession(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearActiveGameSession(sessionId?: string) {
  try {
    if (sessionId && localStorage.getItem(KEY) !== sessionId) return;
    localStorage.removeItem(KEY);
  } catch {
    /* almacenamiento no disponible */
  }
}
