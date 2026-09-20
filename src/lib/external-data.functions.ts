import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireAnyAuth } from "@/lib/require-auth";

/**
 * Comprobación del estado de la base de datos externa (PHP + MySQL).
 * Devuelve si está configurada y si responde correctamente.
 */
export const checkExternalDatabase = createServerFn({ method: "GET" })
  .middleware([requireAnyAuth])
  .handler(async () => {
    const { getExternalApiConfig, externalApi, ExternalApiError } = await import(
      "./external-data.server"
    );

    const config = getExternalApiConfig();
    if (!config) {
      return {
        configured: false as const,
        ok: false,
        message:
          "Todavía no hay servidor externo configurado. La aplicación usa la base de datos actual.",
      };
    }

    const authHeader = getRequestHeader("authorization") ?? "";
    const accessToken = authHeader.replace(/^Bearer\s+/i, "");

    try {
      const health = await externalApi.health(accessToken);
      return {
        configured: true as const,
        ok: health.ok === true,
        message: health.ok
          ? "El servidor externo responde correctamente."
          : "El servidor externo respondió, pero no está listo.",
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error("[external-api] health check falló:", detail);
      const message =
        error instanceof ExternalApiError
          ? error.message
          : `No se ha podido contactar con el servidor externo: ${detail}`;
      return { configured: true as const, ok: false, message };
    }
  });
