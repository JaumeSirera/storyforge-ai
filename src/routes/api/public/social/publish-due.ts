import { createFileRoute } from "@tanstack/react-router";

/**
 * Tarea programada (cron de cPanel): publica con Ayrshare los capítulos cuya
 * fecha ya ha llegado. Protegida con SOCIAL_CRON_SECRET (?key=… o cabecera
 * x-cron-key).
 */
export const Route = createFileRoute("/api/public/social/publish-due")({
  server: {
    handlers: {
      GET: ({ request }) => run(request),
      POST: ({ request }) => run(request),
    },
  },
});

async function run(request: Request) {
  const secret = process.env["SOCIAL_CRON_SECRET"] ?? "";
  const url = new URL(request.url);
  const given = request.headers.get("x-cron-key") ?? url.searchParams.get("key") ?? "";
  if (!secret || given.length !== secret.length || given !== secret) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { externalRequest } = await import("@/lib/external-data.server");
  const { publishSocial, summarize } = await import("@/lib/social-publish.server");
  type Due = {
    id: string;
    body: string;
    links: { label: string; url: string }[];
    media: { path: string; kind: "imagen" | "video"; name: string }[];
    networks: string[];
    uploadpost_key: string | null;
    uploadpost_user: string | null;
    facebook_page_id: string | null;
  };
  // Sin token de usuario => modo servicio.
  const due = await externalRequest<Due[]>({ accessToken: "", path: "/social/due", query: { limit: 20 } });
  const done: { id: string; status: string }[] = [];
  for (const c of due) {
    let s: { status: "publicado" | "error"; result: string };
    try {
      s = summarize(
        await publishSocial(
          { key: c.uploadpost_key, profile: c.uploadpost_user ?? "", facebook_page_id: c.facebook_page_id ?? "" },
          c,
          c.networks,
        ),
      );
    } catch (e) {
      s = { status: "error", result: e instanceof Error ? e.message : String(e) };
    }
    await externalRequest({ accessToken: "", method: "POST", path: `/social/chapters/${c.id}/result`, body: s });
    done.push({ id: c.id, status: s.status });
  }
  return Response.json({ processed: done.length, done });
}
