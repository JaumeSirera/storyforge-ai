import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/** Provider apuntando al Lovable AI Gateway (compat OpenAI). Sólo lo usamos como fallback interno. */
export function createLovableAiGatewayProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable-ai-gateway",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: { "Lovable-API-Key": apiKey },
  });
}

/** Provider directo a OpenAI usando la clave del usuario. */
export function createOpenAIProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "openai",
    baseURL: "https://api.openai.com/v1",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}

/**
 * ¿Está activa la pasarela de IA de nuestro propio servidor?
 * Cuando lo está, no hace falta que el usuario ponga ninguna clave: la clave
 * vive en el .env del hosting y la petición se hace desde allí.
 */
export function ownAiEnabled(): boolean {
  return (
    process.env["EXTERNAL_AI"] === "1" &&
    !!process.env["EXTERNAL_API_URL"] &&
    !!process.env["EXTERNAL_API_TOKEN"]
  );
}

function createOwnAiProvider() {
  const base = process.env["EXTERNAL_API_URL"]!.replace(/\/+$/, "") + "/api/v1/ai";
  return createOpenAICompatible({
    name: "xandralyze-ai",
    baseURL: base,
    headers: {
      "X-App-Token": process.env["EXTERNAL_API_TOKEN"]!,
      "X-Service": "1",
      "User-Agent": "Xandralyze/1.0 (+https://xandralyze.com)",
    },
  });
}

/**
 * Provider de Gemini. Si la pasarela propia está activa, va por nuestro
 * servidor; si no, directo a Google con la clave del usuario.
 */
export function createGeminiProvider(apiKey: string) {
  if (ownAiEnabled()) return createOwnAiProvider();
  return createOpenAICompatible({
    name: "gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}

import type { AiModelId } from "./ai-models";
import { resolveAiModel, GEMINI_FALLBACK_CHAIN, OPENAI_FALLBACK_CHAIN } from "./ai-models";
import type { UserApiKeys } from "./user-keys.functions";

/**
 * Devuelve `{ model }` listo para pasar a `generateText` / `generateObject`
 * usando la clave del usuario y el proveedor que corresponda al modelo pedido.
 * Si el usuario no tiene la clave del proveedor solicitado, cae al proveedor que sí tenga configurado.
 * Si no tiene ninguna, lanza un error claro para redirigir a Ajustes.
 */
export function resolveUserTextModel(userKeys: UserApiKeys, requestedId?: AiModelId) {
  const requested = requestedId ? resolveAiModel(requestedId) : undefined;

  // Con la pasarela propia activa, tanto Gemini como OpenAI van por nuestro servidor.
  const canOpenAI = !!userKeys.openaiKey || ownAiEnabled();
  const canGemini = !!userKeys.geminiKey || ownAiEnabled();
  const canLovable = !!userKeys.lovableKey;

  let provider: "openai" | "gemini" | "lovable";
  if (requested) {
    if (requested.provider === "openai" && canOpenAI) provider = "openai";
    else if (requested.provider === "gemini" && canGemini) provider = "gemini";
    else if (canOpenAI) provider = "openai";
    else if (canGemini) provider = "gemini";
    else if (canLovable) provider = "lovable";
    else throw missingKeysError();
  } else {
    if (userKeys.textProvider === "openai" && canOpenAI) provider = "openai";
    else if (userKeys.textProvider === "gemini" && canGemini) provider = "gemini";
    else if (userKeys.textProvider === "lovable" && canLovable) provider = "lovable";
    else if (canOpenAI) provider = "openai";
    else if (canGemini) provider = "gemini";
    else if (canLovable) provider = "lovable";
    else throw missingKeysError();
  }

  if (provider === "openai") {
    const p = createOpenAIProvider(userKeys.openaiKey!);
    const nativeId =
      requested && requested.provider === "openai" ? requested.nativeId : "gpt-5-mini";
    return { model: p(nativeId), provider, nativeId };
  }

  if (provider === "gemini") {
    const p = createGeminiProvider(userKeys.geminiKey ?? "");
    const nativeId =
      requested && requested.provider === "gemini" ? requested.nativeId : "gemini-3.8-flash";
    return { model: p(nativeId), provider, nativeId };
  }

  // Lovable AI Gateway (platform pays via LOVABLE_API_KEY)
  const p = createLovableAiGatewayProvider(userKeys.lovableKey!);
  const nativeId = requested ? requested.id : "google/gemini-3.8-flash";
  return { model: p(nativeId), provider, nativeId };
}

function missingKeysError() {
  return new Error(
    "Configura tu clave de OpenAI o Google Gemini en Ajustes para generar contenido con IA.",
  );
}

// ---------------------------------------------------------------------------
// Fallback automático de modelos
// ---------------------------------------------------------------------------

export type ResolvedTextModel = {
  model: ReturnType<ReturnType<typeof createOpenAIProvider>>;
  provider: "openai" | "gemini" | "lovable";
  nativeId: string;
};

/**
 * Construye la lista ordenada de modelos a intentar: primero el pedido,
 * después alternativas del mismo proveedor, luego del otro proveedor con clave,
 * y por último el gateway de la plataforma. Permite que un modelo nuevo que
 * falle (404, rate limit, error del proveedor) no rompa el flujo del juego.
 */
export function resolveUserTextModelChain(
  userKeys: UserApiKeys,
  requestedId?: AiModelId,
): ResolvedTextModel[] {
  const requested = requestedId ? resolveAiModel(requestedId) : undefined;
  const canOpenAI = !!userKeys.openaiKey;
  const canGemini = !!userKeys.geminiKey || ownAiEnabled();
  const canLovable = !!userKeys.lovableKey;
  if (!canOpenAI && !canGemini && !canLovable) throw missingKeysError();

  const openaiProvider = canOpenAI ? createOpenAIProvider(userKeys.openaiKey!) : null;
  const geminiProvider = canGemini ? createGeminiProvider(userKeys.geminiKey ?? "") : null;
  const lovableProvider = canLovable ? createLovableAiGatewayProvider(userKeys.lovableKey!) : null;

  const chain: ResolvedTextModel[] = [];
  const seen = new Set<string>();

  const push = (provider: ResolvedTextModel["provider"], nativeId: string) => {
    const key = `${provider}:${nativeId}`;
    if (seen.has(key)) return;
    const p =
      provider === "openai" ? openaiProvider : provider === "gemini" ? geminiProvider : lovableProvider;
    if (!p) return;
    seen.add(key);
    chain.push({ provider, nativeId, model: p(nativeId) });
  };

  const openaiChain = OPENAI_FALLBACK_CHAIN;
  const geminiChain = GEMINI_FALLBACK_CHAIN;

  // 1. Modelo solicitado (si hay clave del proveedor).
  if (requested) push(requested.provider, requested.nativeId);

  // 2. Alternativas del proveedor preferido.
  const preferred: Array<"openai" | "gemini"> =
    requested?.provider === "openai" || userKeys.textProvider === "openai"
      ? ["openai", "gemini"]
      : ["gemini", "openai"];

  for (const prov of preferred) {
    for (const id of prov === "openai" ? openaiChain : geminiChain) {
      push(prov, resolveAiModel(id).nativeId);
    }
  }

  // 3. Gateway de la plataforma como último recurso.
  if (requested) push("lovable", requested.id);
  push("lovable", "google/gemini-3.8-flash");
  push("lovable", "google/gemini-3.5-flash");

  return chain;
}

/**
 * Ejecuta `run` con el primer modelo disponible y, si falla, reintenta con los
 * siguientes de la cadena. Devuelve también qué modelo terminó funcionando.
 */
export async function runWithTextModelFallback<T>(
  userKeys: UserApiKeys,
  requestedId: AiModelId | undefined,
  run: (resolved: ResolvedTextModel) => Promise<T>,
  options?: { maxAttempts?: number; label?: string },
): Promise<{ value: T; used: ResolvedTextModel; attempts: number; fellBack: boolean }> {
  const chain = resolveUserTextModelChain(userKeys, requestedId);
  const maxAttempts = Math.max(1, Math.min(options?.maxAttempts ?? 3, chain.length));
  const label = options?.label ?? "ai";
  let lastError: unknown;

  for (let i = 0; i < maxAttempts; i++) {
    const candidate = chain[i]!;
    try {
      const value = await run(candidate);
      if (i > 0) {
        console.warn(
          `[${label}] fallback aplicado: se usó ${candidate.provider}/${candidate.nativeId} tras ${i} intento(s) fallido(s)`,
        );
      }
      return { value, used: candidate, attempts: i + 1, fellBack: i > 0 };
    } catch (err: any) {
      lastError = err;
      console.error(
        `[${label}] modelo ${candidate.provider}/${candidate.nativeId} falló: ${err?.message ?? err}`,
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("No se pudo generar con ningún modelo de IA disponible.");
}

