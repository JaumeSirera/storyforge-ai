/**
 * Cliente de la API externa (PHP + MySQL) que vive en el servidor del cliente.
 *
 * Solo se activa cuando existen los secretos EXTERNAL_API_URL y EXTERNAL_API_TOKEN.
 * Mientras no existan, la aplicación sigue funcionando exactamente como ahora.
 *
 * Server-only: NUNCA importar en módulo desde un *.functions.ts; usar
 * `await import("@/lib/external-data.server")` dentro del handler.
 */

export type ExternalResource =
  | "assessments"
  | "assessment_candidates"
  | "assessment_submissions"
  | "assessment_annotations"
  | "assessment_collaborators"
  | "question_bank_items"
  | "question_bank_versions"
  | "candidate_invite_emails"
  | "exam_audit_log"
  | "simulations"
  | "simulation_characters"
  | "simulation_revisions"
  | "simulation_invitations"
  | "sessions"
  | "report_email_log"
  | "usage_events"
  | "capture_sessions"
  | "capture_participants"
  | "capture_recordings"
  | "capture_transcript_segments"
  | "capture_analyses"
  | "capture_scene_annotations"
  | "capture_hypothesis_reviews"
  | "capture_hypothesis_review_events"
  | "capture_consents"
  | "capture_invitations"
  | "capture_preferences"
  | "user_billing"
  | "redsys_payments"
  | "pricing_config";


export interface ExternalApiConfig {
  baseUrl: string;
  appToken: string;
}

export function getExternalApiConfig(): ExternalApiConfig | null {
  const baseUrl = process.env["EXTERNAL_API_URL"];
  const appToken = process.env["EXTERNAL_API_TOKEN"];
  if (!baseUrl || !appToken) return null;
  return { baseUrl: baseUrl.replace(/\/+$/, ""), appToken };
}

export function isExternalApiEnabled(): boolean {
  return getExternalApiConfig() !== null;
}

export class ExternalApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ExternalApiError";
  }
}

interface RequestOptions {
  /** Token del usuario firmado; la API lo usa para saber de quién son los datos. */
  accessToken: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

async function request<T>(options: RequestOptions): Promise<T> {
  const config = getExternalApiConfig();
  if (!config) {
    throw new ExternalApiError("La base de datos externa no está configurada", 503, "not_configured");
  }

  const url = new URL(`${config.baseUrl}/api/v1${options.path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      // Sin token de usuario => modo servicio: la clave compartida basta.
      ...(options.accessToken
        ? { Authorization: `Bearer ${options.accessToken}` }
        : { "X-Service": "1" }),
      "X-App-Token": config.appToken,
      "X-Identity-Url": process.env.SUPABASE_URL ?? "",
      "X-Identity-Key": process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
      Accept: "application/json",
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const payload = parsed as { error?: string; code?: string } | null;
    console.error(`[external-api] ${options.method ?? "GET"} ${url.pathname} -> ${response.status}: ${text}`);
    throw new ExternalApiError(
      payload?.error ?? `La API externa devolvió el estado ${response.status}`,
      response.status,
      payload?.code,
    );
  }

  const payload = parsed as { data?: T } | null;
  // Algunos endpoints (health) responden en la raíz, sin envoltorio "data".
  return (payload && "data" in payload ? payload.data : (parsed as T)) as T;
}

/** Petición libre a la API (rutas fuera del CRUD por recurso, p. ej. /auth/*). */
export function externalRequest<T>(options: RequestOptions): Promise<T> {
  return request<T>(options);
}

export const externalApi = {
  health(accessToken: string) {
    return request<{ ok: boolean; time: string }>({ accessToken, path: "/health" });
  },
  list<T>(
    accessToken: string,
    resource: ExternalResource,
    query: Record<string, string | number | boolean | undefined> = {},
  ) {
    return request<T[]>({ accessToken, path: `/${resource}`, query });
  },
  get<T>(accessToken: string, resource: ExternalResource, id: string) {
    return request<T>({ accessToken, path: `/${resource}/${id}` });
  },
  create<T>(accessToken: string, resource: ExternalResource, body: Record<string, unknown>) {
    return request<T>({ accessToken, method: "POST", path: `/${resource}`, body });
  },
  update<T>(
    accessToken: string,
    resource: ExternalResource,
    id: string,
    body: Record<string, unknown>,
  ) {
    return request<T>({ accessToken, method: "PATCH", path: `/${resource}/${id}`, body });
  },
  remove(accessToken: string, resource: ExternalResource, id: string) {
    return request<{ id: string; deleted: boolean }>({
      accessToken,
      method: "DELETE",
      path: `/${resource}/${id}`,
    });
  },
};
