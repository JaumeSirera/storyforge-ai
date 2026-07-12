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

/** Provider directo a Google Gemini (endpoint OpenAI-compatible) con la clave del usuario. */
export function createGeminiProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}

import type { AiModelId } from "./ai-models";
import { resolveAiModel } from "./ai-models";
import type { UserApiKeys } from "./user-keys.functions";

/**
 * Devuelve `{ model }` listo para pasar a `generateText` / `generateObject`
 * usando la clave del usuario y el proveedor que corresponda al modelo pedido.
 * Si el usuario no tiene la clave del proveedor solicitado, cae al proveedor que sí tenga configurado.
 * Si no tiene ninguna, lanza un error claro para redirigir a Ajustes.
 */
export function resolveUserTextModel(userKeys: UserApiKeys, requestedId?: AiModelId) {
  const requested = requestedId ? resolveAiModel(requestedId) : undefined;

  const canOpenAI = !!userKeys.openaiKey;
  const canGemini = !!userKeys.geminiKey;

  let provider: "openai" | "gemini";
  if (requested) {
    // Respeta el modelo pedido si el usuario tiene su clave; si no, intenta el otro.
    if (requested.provider === "openai" && canOpenAI) provider = "openai";
    else if (requested.provider === "gemini" && canGemini) provider = "gemini";
    else if (canOpenAI) provider = "openai";
    else if (canGemini) provider = "gemini";
    else throw missingKeysError();
  } else {
    if (userKeys.textProvider === "openai" && canOpenAI) provider = "openai";
    else if (userKeys.textProvider === "gemini" && canGemini) provider = "gemini";
    else if (canOpenAI) provider = "openai";
    else if (canGemini) provider = "gemini";
    else throw missingKeysError();
  }

  if (provider === "openai") {
    const p = createOpenAIProvider(userKeys.openaiKey!);
    const nativeId =
      requested && requested.provider === "openai" ? requested.nativeId : "gpt-5-mini";
    return { model: p(nativeId), provider, nativeId };
  }

  const p = createGeminiProvider(userKeys.geminiKey!);
  const nativeId =
    requested && requested.provider === "gemini" ? requested.nativeId : "gemini-2.5-flash";
  return { model: p(nativeId), provider, nativeId };
}

function missingKeysError() {
  return new Error(
    "Configura tu clave de OpenAI o Google Gemini en Ajustes para generar contenido con IA.",
  );
}
