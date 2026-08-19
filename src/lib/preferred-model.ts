import { useCallback, useEffect, useState } from "react";
import { AI_MODELS, DEFAULT_AI_MODEL, type AiModelId } from "./ai-models";

const STORAGE_KEY = "xandralyze.preferred-ai-model";

function isValid(id: unknown): id is AiModelId {
  return typeof id === "string" && AI_MODELS.some((m) => m.id === id);
}

/** Lee el modelo preferido guardado en el navegador (solo cliente). */
export function readPreferredAiModel(): AiModelId | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isValid(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writePreferredAiModel(id: AiModelId) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore quota errors */
  }
}

/**
 * Modelo de IA elegido por el usuario, persistido en el navegador para que se
 * mantenga entre sesiones y no haya que reconfigurar los selects.
 */
export function usePreferredAiModel() {
  const [model, setModelState] = useState<AiModelId>(DEFAULT_AI_MODEL);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readPreferredAiModel();
    if (stored) setModelState(stored);
    setHydrated(true);
  }, []);

  const setModel = useCallback((id: AiModelId) => {
    setModelState(id);
    writePreferredAiModel(id);
  }, []);

  return { model, setModel, hydrated };
}
