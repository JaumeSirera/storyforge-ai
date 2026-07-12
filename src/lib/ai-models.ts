// Modelos de texto que el usuario puede elegir en la generación.
// El prefijo indica el proveedor con el que se llama directamente (con la clave del usuario):
//  - "openai/<id>"  → api.openai.com
//  - "google/<id>"  → generativelanguage.googleapis.com (endpoint OpenAI-compatible)

export const AI_MODELS = [
  {
    id: "google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    description: "Rápido y económico. Recomendado.",
    provider: "gemini" as const,
    nativeId: "gemini-2.5-flash",
  },
  {
    id: "google/gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    description: "Mayor calidad. Más caro.",
    provider: "gemini" as const,
    nativeId: "gemini-2.5-pro",
  },
  {
    id: "openai/gpt-5-mini",
    label: "GPT-5 Mini",
    description: "Coste contenido de OpenAI.",
    provider: "openai" as const,
    nativeId: "gpt-5-mini",
  },
  {
    id: "openai/gpt-5",
    label: "GPT-5",
    description: "Máxima calidad de OpenAI.",
    provider: "openai" as const,
    nativeId: "gpt-5",
  },
] as const;

export type AiModelId = (typeof AI_MODELS)[number]["id"];

export const DEFAULT_AI_MODEL: AiModelId = "google/gemini-2.5-flash";

export const AI_MODEL_IDS = AI_MODELS.map((m) => m.id) as [AiModelId, ...AiModelId[]];

export function resolveAiModel(id: AiModelId) {
  return AI_MODELS.find((m) => m.id === id) ?? AI_MODELS[0];
}
