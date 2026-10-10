/**
 * Sube un archivo al almacén que esté activo: el servidor propio (con enlace
 * temporal) o el almacenamiento de Lovable Cloud. Se usa desde el navegador.
 */

import { supabase } from "@/integrations/supabase/client";
import { signFileUpload } from "./files.functions";

type Bucket = "assessments" | "branding" | "characters" | "participants" | "recordings" | "videos";

export async function uploadFile(
  bucket: Bucket,
  path: string,
  body: Blob,
  options?: { contentType?: string; upsert?: boolean },
): Promise<void> {
  const contentType = options?.contentType || body.type || "application/octet-stream";

  const link = await signFileUpload({ data: { bucket, path } });
  if (link) {
    const response = await fetch(sameOrigin(link.uploadUrl), {
      method: "POST",
      headers: { "Content-Type": contentType },
      body,
    });
    if (!response.ok) {
      const t = await response.text().catch(() => "");
      throw new Error(`No se ha podido subir el archivo (${response.status}) ${t.slice(0, 160)}`);
    }
    return;
  }

  throw new Error("El almacén de archivos del servidor propio no está activo (revisa EXTERNAL_FILES=1 en las variables del hosting).");
}

/** Sube usando un enlace ya firmado (invitados a una captura). */
function sameOrigin(url: string) {
  const i = url.indexOf("/api/v1/file/");
  return i >= 0 ? `/api/file/${url.slice(i + 13)}` : url;
}

export async function uploadWithTicket(
  bucket: Bucket,
  ticket: { path: string; uploadToken?: string; uploadUrl?: string },
  body: Blob,
  contentType: string,
): Promise<void> {
  if (ticket.uploadUrl) {
    const response = await fetch(sameOrigin(ticket.uploadUrl), {
      method: "POST",
      headers: { "Content-Type": contentType },
      body,
    });
    if (!response.ok) throw new Error(`No se ha podido subir el archivo (${response.status})`);
    return;
  }
  const { error } = await supabase.storage
    .from(bucket)
    .uploadToSignedUrl(ticket.path, ticket.uploadToken ?? "", body, { contentType });
  if (error) throw new Error(error.message);
}
