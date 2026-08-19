import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { AI_MODEL_IDS } from "./ai-models";

const TestInput = z.object({
  model: z.enum(AI_MODEL_IDS),
  /** Cuántos modelos de la cadena se fuerzan a fallar antes de dejar responder. */
  forceFailures: z.number().int().min(0).max(3).default(1),
});

export type AiFallbackAttempt = {
  order: number;
  provider: string;
  modelId: string;
  status: "forzado-fallo" | "error" | "ok";
  detail: string;
};

export type AiFallbackTestResult = {
  attempts: AiFallbackAttempt[];
  requestedModel: string;
  usedProvider: string | null;
  usedModel: string | null;
  fellBack: boolean;
  answer: string | null;
  ok: boolean;
  error: string | null;
};

/**
 * Prueba de fallback: fuerza el fallo de los primeros modelos de la cadena y
 * comprueba que el siguiente modelo disponible responde de verdad.
 */
export const testAiFallback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TestInput.parse(input))
  .handler(async ({ data, context }): Promise<AiFallbackTestResult> => {
    const { loadUserKeys } = await import("./user-keys.functions");
    const { runWithTextModelFallback } = await import("./ai-gateway.server");
    const { generateText } = await import("ai");

    const keys = await loadUserKeys(context.supabase, context.userId);
    const attempts: AiFallbackAttempt[] = [];
    let index = 0;

    try {
      const result = await runWithTextModelFallback(
        keys,
        data.model,
        async (resolved) => {
          const order = ++index;
          if (order <= data.forceFailures) {
            attempts.push({
              order,
              provider: resolved.provider,
              modelId: resolved.nativeId,
              status: "forzado-fallo",
              detail: "Fallo simulado para comprobar el fallback",
            });
            throw new Error("Fallo simulado (prueba de fallback)");
          }
          try {
            const { text } = await generateText({
              model: resolved.model,
              prompt:
                "Responde exactamente con esta frase, sin añadir nada más: Fallback operativo.",
            });
            attempts.push({
              order,
              provider: resolved.provider,
              modelId: resolved.nativeId,
              status: "ok",
              detail: text.trim().slice(0, 200) || "(respuesta vacía)",
            });
            return text.trim();
          } catch (err: any) {
            attempts.push({
              order,
              provider: resolved.provider,
              modelId: resolved.nativeId,
              status: "error",
              detail: String(err?.message ?? err).slice(0, 300),
            });
            throw err;
          }
        },
        { maxAttempts: data.forceFailures + 3, label: "ai-test" },
      );

      return {
        attempts,
        requestedModel: data.model,
        usedProvider: result.used.provider,
        usedModel: result.used.nativeId,
        fellBack: result.fellBack,
        answer: result.value,
        ok: true,
        error: null,
      };
    } catch (err: any) {
      return {
        attempts,
        requestedModel: data.model,
        usedProvider: null,
        usedModel: null,
        fellBack: attempts.length > 1,
        answer: null,
        ok: false,
        error: String(err?.message ?? err).slice(0, 400),
      };
    }
  });
