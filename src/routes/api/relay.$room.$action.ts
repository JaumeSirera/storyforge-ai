import { createFileRoute } from "@tanstack/react-router";

/** Pasarela de la conexión en directo (grabaciones multicámara) hacia la API propia. */
export const Route = createFileRoute("/api/relay/$room/$action")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!/^(send|poll|leave)$/.test(params.action) || !/^[A-Za-z0-9_-]{8,190}$/.test(params.room)) {
          return new Response("No válido", { status: 400 });
        }
        const { getExternalApiConfig } = await import("@/lib/external-data.server");
        const config = getExternalApiConfig();
        if (!config) return Response.json({ error: "No configurado" }, { status: 503 });
        const body = await request.text();
        if (body.length > 250_000) return new Response("Demasiado grande", { status: 413 });
        const upstream = await fetch(
          `${config.baseUrl}/api/v1/relay/${params.room}/${params.action}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-App-Token": config.appToken,
              "User-Agent": "Xandralyze/1.0 (+https://xandralyze.com)",
            },
            body,
          },
        );
        return new Response(await upstream.text(), {
          status: upstream.status,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
