// Modelos de texto que el usuario puede elegir en la generación.
// El prefijo indica el proveedor con el que se llama directamente (con la clave del usuario):
//  - "openai/<id>"  → api.openai.com
//  - "google/<id>"  → generativelanguage.googleapis.com (endpoint OpenAI-compatible)
// Los ids son también válidos en el gateway de Lovable (fallback de plataforma).

export const AI_MODELS = [
  // ---------- Google Gemini (última generación) ----------
  {
    id: "google/gemini-3.7-flash",
    label: "Gemini 3.7 Flash",
    description: "Última generación. Rápido, potente y económico. Recomendado.",
    provider: "gemini" as const,
    nativeId: "gemini-3.7-flash",
    generation: "nuevo" as const,
  },
  {
    id: "google/gemini-3.6-flash",
    label: "Gemini 3.6 Flash",
    description: "Muy eficiente para guiones, preguntas e informes.",
    provider: "gemini" as const,
    nativeId: "gemini-3.6-flash",
    generation: "nuevo" as const,
  },
  {
    id: "google/gemini-3.5-flash",
    label: "Gemini 3.5 Flash",
    description: "Equilibrio entre calidad y coste.",
    provider: "gemini" as const,
    nativeId: "gemini-3.5-flash",
    generation: "nuevo" as const,
  },
  {
    id: "google/gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro (preview)",
    description: "Razonamiento avanzado para simulaciones complejas.",
    provider: "gemini" as const,
    nativeId: "gemini-3.1-pro-preview",
    generation: "nuevo" as const,
  },
  {
    id: "google/gemini-3.1-flash-lite",
    label: "Gemini 3.1 Flash Lite",
    description: "El más económico. Ideal para tareas simples y volumen alto.",
    provider: "gemini" as const,
    nativeId: "gemini-3.1-flash-lite",
    generation: "nuevo" as const,
  },
  {
    id: "google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    description: "Generación anterior. Estable y barato.",
    provider: "gemini" as const,
    nativeId: "gemini-2.5-flash",
    generation: "clásico" as const,
  },
  {
    id: "google/gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    description: "Generación anterior de mayor calidad.",
    provider: "gemini" as const,
    nativeId: "gemini-2.5-pro",
    generation: "clásico" as const,
  },

  // ---------- OpenAI (última generación) ----------
  {
    id: "openai/gpt-5.6-sol",
    label: "GPT-5.6 Sol",
    description: "Modelo insignia de OpenAI. Máxima calidad narrativa.",
    provider: "openai" as const,
    nativeId: "gpt-5.6-sol",
    generation: "nuevo" as const,
  },
  {
    id: "openai/gpt-5.6-terra",
    label: "GPT-5.6 Terra",
    description: "Gran calidad con coste moderado. Buen día a día.",
    provider: "openai" as const,
    nativeId: "gpt-5.6-terra",
    generation: "nuevo" as const,
  },
  {
    id: "openai/gpt-5.6-luna",
    label: "GPT-5.6 Luna",
    description: "Rápido y barato para tareas sencillas.",
    provider: "openai" as const,
    nativeId: "gpt-5.6-luna",
    generation: "nuevo" as const,
  },
  {
    id: "openai/gpt-5.5",
    label: "GPT-5.5",
    description: "Razonamiento y código de nivel frontera.",
    provider: "openai" as const,
    nativeId: "gpt-5.5",
    generation: "nuevo" as const,
  },
  {
    id: "openai/gpt-5.4",
    label: "GPT-5.4",
    description: "Frontera más asequible para análisis largos.",
    provider: "openai" as const,
    nativeId: "gpt-5.4",
    generation: "nuevo" as const,
  },
  {
    id: "openai/gpt-5.4-mini",
    label: "GPT-5.4 Mini",
    description: "Coste contenido con buena capacidad.",
    provider: "openai" as const,
    nativeId: "gpt-5.4-mini",
    generation: "nuevo" as const,
  },
  {
    id: "openai/gpt-5.4-nano",
    label: "GPT-5.4 Nano",
    description: "El más rápido y económico de OpenAI.",
    provider: "openai" as const,
    nativeId: "gpt-5.4-nano",
    generation: "nuevo" as const,
  },
  {
    id: "openai/gpt-5-mini",
    label: "GPT-5 Mini",
    description: "Generación anterior, coste contenido.",
    provider: "openai" as const,
    nativeId: "gpt-5-mini",
    generation: "clásico" as const,
  },
  {
    id: "openai/gpt-5",
    label: "GPT-5",
    description: "Generación anterior de máxima calidad.",
    provider: "openai" as const,
    nativeId: "gpt-5",
    generation: "clásico" as const,
  },
] as const;

export type AiModelId = (typeof AI_MODELS)[number]["id"];

// Por defecto se mantienen los modelos que ya se usaban antes (generación estable).
export const DEFAULT_AI_MODEL: AiModelId = "google/gemini-2.5-flash";

export const AI_MODEL_IDS = AI_MODELS.map((m) => m.id) as [AiModelId, ...AiModelId[]];

export function resolveAiModel(id: AiModelId) {
  return AI_MODELS.find((m) => m.id === id) ?? AI_MODELS[0];
}

/**
 * Orden de preferencia para el fallback automático: si un modelo nuevo falla,
 * se intenta el siguiente (misma familia, luego generación estable).
 */
export const GEMINI_FALLBACK_CHAIN: AiModelId[] = [
  "google/gemini-3.7-flash",
  "google/gemini-3.5-flash",
  "google/gemini-2.5-flash",
];

export const OPENAI_FALLBACK_CHAIN: AiModelId[] = [
  "openai/gpt-5.4-mini",
  "openai/gpt-5-mini",
  "openai/gpt-5",
];
