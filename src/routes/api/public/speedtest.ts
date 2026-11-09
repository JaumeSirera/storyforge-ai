import { createFileRoute } from "@tanstack/react-router";

/**
 * Prueba de conexión previa a una grabación: el navegador envía ~1 MB y mide
 * cuánto tarda. El contenido se descarta; no se guarda nada ni se devuelve
 * ningún dato privado. Se limita el tamaño para evitar abusos.
 */
const MAX_BYTES = 2 * 1024 * 1024;

export const Route = createFileRoute("/api/public/speedtest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const declared = Number(request.headers.get("content-length") ?? "0");
        if (declared > MAX_BYTES) return new Response("Demasiado grande", { status: 413 });
        const reader = request.body?.getReader();
        let received = 0;
        if (reader) {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            received += value.byteLength;
            if (received > MAX_BYTES) {
              await reader.cancel();
              return new Response("Demasiado grande", { status: 413 });
            }
          }
        }
        return Response.json({ received }, { headers: { "Cache-Control": "no-store" } });
      },
      GET: async () => new Response("ok", { headers: { "Cache-Control": "no-store" } }),
    },
  },
});
