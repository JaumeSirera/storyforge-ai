import { createFileRoute } from "@tanstack/react-router";

/**
 * Pasarela de archivos en el mismo dominio de la web: el navegador sube y
 * descarga a través de aquí con un enlace temporal firmado, sin problemas de
 * dominios cruzados. La firma del enlace es la que protege el acceso.
 */
async function forward(request: Request, splat: string | undefined) {
  const { getExternalApiConfig } = await import("@/lib/external-data.server");
  const config = getExternalApiConfig();
  if (!config || !splat) return new Response("No disponible", { status: 404 });
  const headers = new Headers();
  const ct = request.headers.get("content-type");
  if (ct) headers.set("Content-Type", ct);
  headers.set("User-Agent", "Xandralyze/1.0 (+https://xandralyze.com)");
  const upstream = await fetch(`${config.baseUrl}/api/v1/file/${splat}`, {
    method: request.method,
    headers,
    body: request.method === "POST" ? await request.arrayBuffer() : undefined,
  });
  const out = new Headers();
  for (const h of ["content-type", "content-length", "content-disposition", "cache-control"]) {
    const v = upstream.headers.get(h);
    if (v) out.set(h, v);
  }
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

export const Route = createFileRoute("/api/file/$")({
  server: {
    handlers: {
      GET: ({ request, params }) => forward(request, params._splat),
      POST: ({ request, params }) => forward(request, params._splat),
    },
  },
});
