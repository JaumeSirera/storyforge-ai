import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAnyAuth } from "@/lib/require-auth";
import { AI_MODEL_IDS } from "./ai-models";

const AskInput = z.object({
  question: z.string().trim().min(1).max(2000),
  screen: z.string().max(80).default("Xandralyze"),
  model: z.enum(AI_MODEL_IDS).optional(),
  history: z
    .array(z.object({ from: z.enum(["user", "assistant"]), text: z.string().max(2000) }))
    .max(8)
    .default([]),
});

export type AssistantAnswer =
  | { ok: true; answer: string }
  | { ok: false; reason: "no-keys" | "error"; message: string };

/**
 * Pregunta libre al asistente: la responde la IA del propio usuario (sus claves,
 * con fallback de modelos), sabiendo cómo funciona la app y en qué pantalla está.
 */
export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireAnyAuth])
  .inputValidator((input: unknown) => AskInput.parse(input))
  .handler(async ({ data, context }): Promise<AssistantAnswer> => {
    const { loadUserKeys } = await import("./user-keys.functions");
    const { runWithTextModelFallback } = await import("./ai-gateway.server");
    const { helpKnowledge } = await import("./assistant-help");
    const { generateText } = await import("ai");

    const system = [
      "Eres la asistente personal de Xandralyze, una aplicación gratuita y de código abierto para crear simulaciones interactivas con vídeo, corregir exámenes con IA y grabar y analizar sesiones.",
      "Responde siempre en español de España, con frases cortas y claras, como si hablaras en voz alta. Máximo 110 palabras.",
      "No uses markdown, asteriscos, listas con símbolos ni emojis: tu respuesta se leerá en voz alta.",
      "Si te preguntan cómo usar la aplicación, básate en esta ayuda y nombra los botones y apartados tal como aparecen. Si no sabes algo de la app, dilo con sinceridad y no lo inventes.",
      "También puedes ayudar con tareas libres (redactar correos, ideas para una simulación, preguntas de examen, rúbricas…).",
      `El usuario está ahora en la pantalla «${data.screen}».`,
      "Ayuda de la aplicación:",
      helpKnowledge(),
    ].join("\n");

    const messages = [
      ...data.history.map((m) => ({
        role: m.from === "user" ? ("user" as const) : ("assistant" as const),
        content: m.text,
      })),
      { role: "user" as const, content: data.question },
    ];

    try {
      const keys = await loadUserKeys(context.supabase, context.userId);
      const result = await runWithTextModelFallback(
        keys,
        data.model,
        async (resolved) => {
          const { text } = await generateText({ model: resolved.model, system, messages });
          const clean = text.replace(/[*#`_]+/g, "").trim();
          if (!clean) throw new Error("Respuesta vacía");
          return clean;
        },
        { maxAttempts: 3, label: "assistant" },
      );
      return { ok: true, answer: result.value.slice(0, 2000) };
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      if (/Configura tu clave/i.test(msg)) {
        return {
          ok: false,
          reason: "no-keys",
          message:
            "Para contestarte a esto necesito tu propia IA. Pon tu clave de OpenAI o de Google Gemini en «Ajustes» y vuelve a preguntarme.",
        };
      }
      console.error("[assistant] error:", msg);
      return {
        ok: false,
        reason: "error",
        message: "Ahora mismo tu IA no me ha respondido. Prueba otra vez en un momento o revisa tu clave en «Probar IA».",
      };
    }
  });
