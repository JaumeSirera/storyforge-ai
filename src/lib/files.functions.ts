/**
 * Subida de archivos desde el navegador.
 *
 * Cuando los archivos viven en el servidor propio, el navegador pide aquí un
 * enlace temporal de subida (no ve nunca la clave compartida). Si los archivos
 * siguen en Lovable Cloud, devuelve null y se sube como siempre.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAnyAuth } from "@/lib/require-auth";

const BUCKETS = ["assessments", "branding", "characters", "participants", "recordings", "videos"] as const;

export const signFileUpload = createServerFn({ method: "POST" })
  .middleware([requireAnyAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        bucket: z.enum(BUCKETS),
        path: z.string().min(3).max(500),
      })
      .parse(v),
  )
  .handler(async ({ data, context }): Promise<{ uploadUrl: string; path: string } | null> => {
    const { isExternalFilesEnabled, externalStorage } = await import("./external-storage.server");
    if (!isExternalFilesEnabled()) return null;
    // Cada usuario solo puede escribir dentro de su propia carpeta.
    if (!data.path.startsWith(`${context.userId}/`)) {
      throw new Error("Ruta de archivo no válida");
    }
    const { data: signed, error } = await externalStorage
      .from(data.bucket)
      .createSignedUploadUrl(data.path);
    if (error || !signed) throw new Error(error?.message ?? "No se ha podido preparar la subida");
    return { uploadUrl: signed.signedUrl, path: signed.path };
  });

export const signFileDownload = createServerFn({ method: "POST" })
  .middleware([requireAnyAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        bucket: z.enum(BUCKETS),
        path: z.string().min(3).max(500),
      })
      .parse(v),
  )
  .handler(async ({ data, context }): Promise<{ url: string } | null> => {
    const { isExternalFilesEnabled, externalStorage } = await import("./external-storage.server");
    if (!isExternalFilesEnabled()) return null;
    if (!data.path.startsWith(`${context.userId}/`)) {
      throw new Error("Ruta de archivo no válida");
    }
    const { data: signed, error } = await externalStorage
      .from(data.bucket)
      .createSignedUrl(data.path, 3600);
    if (error || !signed) throw new Error(error?.message ?? "No se ha podido preparar la descarga");
    return { url: signed.signedUrl };
  });
