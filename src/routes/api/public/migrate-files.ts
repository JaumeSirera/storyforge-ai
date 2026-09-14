import { createFileRoute } from "@tanstack/react-router";

/**
 * Copia los archivos guardados en Lovable Cloud (vídeos, escaneos, fotos,
 * logotipos y grabaciones) al servidor propio. Protegida con la clave
 * compartida (X-App-Token).
 */
const BUCKETS = ["assessments", "branding", "characters", "participants", "recordings", "videos"] as const;

export const Route = createFileRoute("/api/public/migrate-files")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["EXTERNAL_API_TOKEN"];
        if (!expected || request.headers.get("x-app-token") !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { isExternalFilesEnabled, externalStorage } = await import("@/lib/external-storage.server");
        if (!isExternalFilesEnabled()) {
          return Response.json({ error: "external files not enabled" }, { status: 503 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const report: Record<string, { copied: number; failed: number; errors: string[] }> = {};

        async function walk(bucket: string, prefix: string, depth: number): Promise<string[]> {
          if (depth > 6) return [];
          const { data, error } = await supabaseAdmin.storage
            .from(bucket)
            .list(prefix, { limit: 1000, sortBy: { column: "name", order: "asc" } });
          if (error || !data) return [];
          const files: string[] = [];
          for (const entry of data) {
            const path = prefix ? `${prefix}/${entry.name}` : entry.name;
            if (entry.id === null) files.push(...(await walk(bucket, path, depth + 1)));
            else files.push(path);
          }
          return files;
        }

        for (const bucket of BUCKETS) {
          const entry = { copied: 0, failed: 0, errors: [] as string[] };
          report[bucket] = entry;
          const paths = await walk(bucket, "", 0);

          for (const path of paths) {
            try {
              const { data: blob, error } = await supabaseAdmin.storage.from(bucket).download(path);
              if (error || !blob) throw new Error(error?.message ?? "descarga vacía");
              const result = await externalStorage.from(bucket).upload(path, blob, {
                contentType: blob.type || "application/octet-stream",
                upsert: true,
              });
              if (result.error) throw new Error(result.error.message);
              entry.copied += 1;
            } catch (err) {
              entry.failed += 1;
              const message = err instanceof Error ? err.message : String(err);
              if (entry.errors.length < 5) entry.errors.push(`${path}: ${message}`);
            }
          }
        }

        return Response.json(report);
      },
    },
  },
});
