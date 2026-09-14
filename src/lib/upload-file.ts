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

  const link = await signFileUpload({ data: { bucket, path } }).catch(() => null);
  if (link) {
    const response = await fetch(link.uploadUrl, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body,
    });
    if (!response.ok) {
      throw new Error(`No se ha podido subir el archivo (${response.status})`);
    }
    return;
  }

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, body, { contentType, upsert: options?.upsert ?? false });
  if (error) throw new Error(error.message);
}

/** Sube usando un enlace ya firmado (invitados a una captura). */
export async function uploadWithTicket(
  bucket: Bucket,
  ticket: { path: string; uploadToken?: string; uploadUrl?: string },
  body: Blob,
  contentType: string,
): Promise<void> {
  if (ticket.uploadUrl) {
    const response = await fetch(ticket.uploadUrl, {
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
