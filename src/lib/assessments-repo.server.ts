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

/**
 * Fase 2 (simulaciones, partidas, informes y consumo). Solo se activa cuando
 * el secreto EXTERNAL_API_PHASE2 vale "1", es decir, cuando el servidor propio
 * ya tiene creadas estas tablas.
 */
const PHASE2_TABLES = new Set<string>([
  "simulations",
  "simulation_characters",
  "simulation_revisions",
  "simulation_invitations",
  "sessions",
  "report_email_log",
  "usage_events",
]);

/**
 * Fase 3 (grabaciones de captura y facturación). Se activa con el secreto
 * EXTERNAL_API_PHASE3 = "1".
 */
const PHASE3_TABLES = new Set<string>([
  "capture_sessions",
  "capture_participants",
  "capture_recordings",
  "capture_transcript_segments",
  "capture_analyses",
  "capture_scene_annotations",
  "capture_hypothesis_reviews",
  "capture_hypothesis_review_events",
  "capture_consents",
  "capture_invitations",
  "capture_preferences",
  "user_billing",
  "redsys_payments",
  "pricing_config",
]);

function isExternal(table: string): boolean {
  if (EXTERNAL_TABLES.has(table)) return true;
  if (process.env["EXTERNAL_API_PHASE2"] === "1" && PHASE2_TABLES.has(table)) return true;
  return process.env["EXTERNAL_API_PHASE3"] === "1" && PHASE3_TABLES.has(table);
}


/* eslint-disable @typescript-eslint/no-explicit-any */

function currentAccessToken(): string {
  try {
    return (getRequestHeader("authorization") ?? "").replace(/^Bearer\s+/i, "");
  } catch {
    return "";
  }
}

/**
 * Devuelve un cliente con la misma forma que el de Lovable Cloud, pero que
 * redirige a la base externa las tablas ya migradas. El resto (cuentas,
 * archivos, correo, capturas) sigue igual.
 */
function wrap<T extends object>(client: T, service: boolean): T {
  const accessToken = service ? "" : currentAccessToken();
  const ctx = { accessToken, service: service || accessToken === "" };
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === "from") {
        return (table: string): any =>
          isExternal(table)
            ? externalTable(table as ExternalResource, ctx)
            : (target as any).from(table);
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? (value as any).bind(target) : value;
    },
  }) as T;
}

/** Cliente para las consultas del usuario firmado. */
export function assessDb(context: { supabase: any }): any {
  if (!isExternalApiEnabled()) return context.supabase;
  return wrap(context.supabase, false);
}

/** Cliente de servicio (equivale a la clave de servicio de Lovable Cloud). */
export async function assessAdminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!isExternalApiEnabled()) return supabaseAdmin;
  return wrap(supabaseAdmin, true);
}

/** Alias genéricos (evaluaciones, simulaciones, partidas, informes y consumo). */
export const xdb = assessDb;
export const xAdminDb = assessAdminDb;
