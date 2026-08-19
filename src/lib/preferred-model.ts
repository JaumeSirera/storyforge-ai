import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AI_MODELS, DEFAULT_AI_MODEL, type AiModelId } from "./ai-models";
import { getMyApiKeys, saveMyApiKeys } from "./user-keys.functions";

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
 * Modelo de IA elegido por el usuario.
 * - Se guarda en el navegador para que se mantenga entre sesiones.
 * - Se sincroniza con el backend al iniciar sesión, de modo que la misma
 *   preferencia aparece en web y móvil sin reconfigurar los selects.
 */
export function usePreferredAiModel() {
  const [model, setModelState] = useState<AiModelId>(DEFAULT_AI_MODEL);
  const [hydrated, setHydrated] = useState(false);
  const localRef = useRef<AiModelId | null>(null);
  const loadKeys = useServerFn(getMyApiKeys);
  const saveKeys = useServerFn(saveMyApiKeys);

  // 1) Restaurar de inmediato lo guardado en el navegador.
  useEffect(() => {
    const stored = readPreferredAiModel();
    localRef.current = stored;
    if (stored) setModelState(stored);
    setHydrated(true);
  }, []);

  // 2) Sincronizar con el backend: gana el valor del servidor si existe;
  //    si no hay nada guardado allí, subimos la preferencia local.
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    (async () => {
      try {
        const remote = await loadKeys();
        if (cancelled) return;
        const remoteModel = remote?.preferredModel;
        if (isValid(remoteModel)) {
          setModelState(remoteModel);
          writePreferredAiModel(remoteModel);
        } else if (localRef.current) {
          await saveKeys({ data: { preferredModel: localRef.current } });
        }
      } catch {
        /* sin sesión o sin red: seguimos con la preferencia local */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, loadKeys, saveKeys]);

  const setModel = useCallback(
    (id: AiModelId) => {
      setModelState(id);
      writePreferredAiModel(id);
      localRef.current = id;
      void saveKeys({ data: { preferredModel: id } }).catch(() => {
        /* la preferencia local ya quedó guardada */
      });
    },
    [saveKeys],
  );

  return { model, setModel, hydrated };
}
