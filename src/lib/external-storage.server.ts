/**
 * Puente de archivos: guarda y sirve los ficheros (vídeos, escaneos, fotos y
 * grabaciones) desde el servidor propio, con la misma forma de uso que antes.
 *
 * Solo se activa cuando existe el secreto EXTERNAL_FILES = "1" y la API externa
 * está configurada. Mientras no exista, todo sigue igual que ahora.
 *
 * Server-only: importar siempre con `await import(...)` dentro del handler.
 */

import { getExternalApiConfig } from "./external-data.server";

export function isExternalFilesEnabled(): boolean {
  return process.env["EXTERNAL_FILES"] === "1" && getExternalApiConfig() !== null;
}

type Res<T> = { data: T; error: { message: string } | null };

function cleanPath(path: string): string {
  return path.replace(/\\/g, "/").split("/").filter((p) => p && p !== "." && p !== "..").join("/");
}

async function apiFetch(path: string, init: RequestInit & { raw?: boolean } = {}) {
  const config = getExternalApiConfig();
  if (!config) throw new Error("La base de datos externa no está configurada");
  const headers = new Headers(init.headers);
  headers.set("X-App-Token", config.appToken);
  headers.set("X-Service", "1");
  headers.set("Accept", init.raw ? "*/*" : "application/json");
  const response = await fetch(`${config.baseUrl}/api/v1${path}`, { ...init, headers });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`La API de archivos devolvió ${response.status}: ${text.slice(0, 200)}`);
  }
  return response;
}

async function toBytes(body: unknown): Promise<{ bytes: ArrayBuffer; mime: string }> {
  if (body instanceof ArrayBuffer) return { bytes: body, mime: "application/octet-stream" };
  if (body instanceof Uint8Array) {
    return { bytes: body.slice().buffer as ArrayBuffer, mime: "application/octet-stream" };
  }
  if (typeof Blob !== "undefined" && body instanceof Blob) {
    return { bytes: await body.arrayBuffer(), mime: body.type || "application/octet-stream" };
  }
  if (typeof body === "string") {
    return { bytes: new TextEncoder().encode(body).buffer as ArrayBuffer, mime: "text/plain" };
  }
  throw new Error("Tipo de archivo no admitido");
}

/** Mismo repertorio de operaciones que se usa en la aplicación. */
function externalBucket(bucket: string) {
  return {
    async upload(
      path: string,
      body: unknown,
      options?: { contentType?: string; upsert?: boolean },
    ): Promise<Res<{ path: string } | null>> {
      try {
        const clean = cleanPath(path);
        const { bytes, mime } = await toBytes(body);
        await apiFetch(`/files/${bucket}/${clean}`, {
          method: "POST",
          headers: { "Content-Type": options?.contentType ?? mime },
          body: bytes,
        });
        return { data: { path: clean }, error: null };
      } catch (error) {
        return { data: null, error: { message: (error as Error).message } };
      }
    },

    async download(path: string): Promise<Res<Blob | null>> {
      try {
        const response = await apiFetch(`/files/${bucket}/${cleanPath(path)}`, { raw: true });
        return { data: await response.blob(), error: null };
      } catch (error) {
        return { data: null, error: { message: (error as Error).message } };
      }
    },

    async remove(paths: string[]): Promise<Res<{ path: string }[] | null>> {
      try {
        for (const path of paths) {
          await apiFetch(`/files/${bucket}/${cleanPath(path)}`, { method: "DELETE" });
        }
        return { data: paths.map((path) => ({ path })), error: null };
      } catch (error) {
        return { data: null, error: { message: (error as Error).message } };
      }
    },

    async createSignedUrl(path: string, expiresIn: number): Promise<Res<{ signedUrl: string } | null>> {
      try {
        const config = getExternalApiConfig();
        const response = await apiFetch("/files/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bucket, path: cleanPath(path), expires_in: expiresIn, mode: "read" }),
        });
        const payload = (await response.json()) as { data?: { token?: string } };
        const token = payload.data?.token ?? "";
        if (!token) throw new Error("No se ha podido firmar el enlace");
        return { data: { signedUrl: `${config!.baseUrl}/api/v1/file/${token}` }, error: null };
      } catch (error) {
        return { data: null, error: { message: (error as Error).message } };
      }
    },

    /** Enlace temporal de subida para el navegador (no expone la clave). */
    async createSignedUploadUrl(
      path: string,
      expiresIn = 3600,
    ): Promise<Res<{ signedUrl: string; path: string; token: string } | null>> {
      try {
        const config = getExternalApiConfig();
        const clean = cleanPath(path);
        const response = await apiFetch("/files/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bucket, path: clean, expires_in: expiresIn, mode: "write" }),
        });
        const payload = (await response.json()) as { data?: { token?: string } };
        const token = payload.data?.token ?? "";
        if (!token) throw new Error("No se ha podido firmar el enlace de subida");
        return {
          data: { signedUrl: `${config!.baseUrl}/api/v1/file/${token}`, path: clean, token },
          error: null,
        };
      } catch (error) {
        return { data: null, error: { message: (error as Error).message } };
      }
    },

    getPublicUrl(path: string) {
      const config = getExternalApiConfig();
      return { data: { publicUrl: `${config?.baseUrl ?? ""}/api/v1/files/${bucket}/${cleanPath(path)}` } };
    },
  };
}

/** Objeto con la misma forma que `client.storage`. */
export const externalStorage = {
  from: (bucket: string) => externalBucket(bucket),
};
