// Catálogo de modelos de IA disponibles para generar simulaciones.
// Se usa tanto en el cliente (UI selector) como en el servidor (validación).

export const AI_MODELS = [
  {
    id: "google/gemini-3-flash-preview",
    label: "Gemini 3 Flash (rápido)",
    description: "Rápido y económico. Recomendado por defecto.",
  },
  {
    id: "google/gemini-3.5-flash",
    label: "Gemini 3.5 Flash",
    description: "Equilibrio entre velocidad y razonamiento.",
  },
  {
    id: "google/gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    description: "Mayor calidad para guiones complejos. Más caro.",
  },
  {
    id: "google/gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro (preview)",
    description: "Razonamiento más fuerte de Google. Coste alto.",
  },
  {
    id: "openai/gpt-5-mini",
    label: "GPT-5 Mini",
    description: "Buen razonamiento de OpenAI con coste contenido.",
  },
  {
    id: "openai/gpt-5",
    label: "GPT-5",
    description: "Máxima calidad de OpenAI. Coste elevado.",
  },
] as const;

export type AiModelId = (typeof AI_MODELS)[number]["id"];

export const DEFAULT_AI_MODEL: AiModelId = "google/gemini-3-flash-preview";

export const AI_MODEL_IDS = AI_MODELS.map((m) => m.id) as [AiModelId, ...AiModelId[]];
