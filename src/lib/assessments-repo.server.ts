/**
 * Selector de base de datos para el módulo de evaluaciones.
 *
 * Si existen los secretos EXTERNAL_API_URL y EXTERNAL_API_TOKEN, las tablas de
 * evaluaciones se leen y escriben en la base de datos propia (PHP + MySQL). El
 * resto de tablas (cuentas, correo, simulaciones) siguen en Lovable Cloud.
 *
 * Server-only.
 */

import { getRequestHeader } from "@tanstack/react-start/server";
import { isExternalApiEnabled, type ExternalResource } from "./external-data.server";
import { externalTable } from "./external-db.server";

const EXTERNAL_TABLES = new Set<string>([
  "assessments",
  "assessment_candidates",
  "assessment_submissions",
  "assessment_annotations",
  "assessment_collaborators",
  "question_bank_items",
  "question_bank_versions",
  "candidate_invite_emails",
  "exam_audit_log",
]);

type AnyClient = {
  from: (table: string) => unknown;
  storage: unknown;
};

function currentAccessToken(): string {
  try {
    return (getRequestHeader("authorization") ?? "").replace(/^Bearer\s+/i, "");
  } catch {
    return "";
  }
}

function wrap<T extends AnyClient>(client: T, service: boolean): T {
  const accessToken = service ? "" : currentAccessToken();
  const ctx = { accessToken, service: service || accessToken === "" };
  return {
    ...client,
    from(table: string) {
      if (EXTERNAL_TABLES.has(table)) {
        return externalTable(table as ExternalResource, ctx);
      }
      return client.from(table);
    },
    get storage() {
      return client.storage;
    },
  } as unknown as T;
}

/** Cliente para las consultas del usuario firmado. */
export function assessDb<T extends AnyClient>(context: { supabase: T }): T {
  if (!isExternalApiEnabled()) return context.supabase;
  return wrap(context.supabase, false);
}

/** Cliente de servicio (equivale a la clave de servicio de Lovable Cloud). */
export async function assessAdminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!isExternalApiEnabled()) return supabaseAdmin;
  return wrap(supabaseAdmin as unknown as AnyClient, true) as unknown as typeof supabaseAdmin;
}
