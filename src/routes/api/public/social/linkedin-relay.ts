import { createFileRoute } from "@tanstack/react-router";

/**
 * Publica en LinkedIn con la conexión original para el servidor propio
 * (xandralyze.com), que no tiene esa conexión. Solo acepta peticiones firmadas
 * con EXTERNAL_API_TOKEN y recientes (5 min).
 */
export const Route = createFileRoute("/api/public/social/linkedin-relay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyRelayBody, hasLinkedInConnection, publishToLinkedInDirect, loadLinkedInMedia } = await import("@/lib/linkedin.server");
        const raw = await request.text();
        const body = await verifyRelayBody(raw, request.headers.get("x-relay-signature") ?? "");
        if (!body) return Response.json({ error: "No autorizado" }, { status: 401 });
        if (!hasLinkedInConnection()) return Response.json({ error: "La conexión de LinkedIn no está disponible." }, { status: 503 });
        try {
          return Response.json(await publishToLinkedInDirect(body.text, await loadLinkedInMedia(body.media)));
        } catch (e) {
          return Response.json({ ok: false, detail: e instanceof Error ? e.message : String(e) });
        }
      },
    },
  },
});
