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
import { externalStorage, isExternalFilesEnabled } from "./external-storage.server";

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

/** Fase 4 (claves de IA y ajustes de correo). Secreto EXTERNAL_API_PHASE4 = "1". */
const PHASE4_TABLES = new Set<string>(["user_api_keys", "email_settings"]);

function isExternal(table: string): boolean {
  if (process.env["EXTERNAL_API_PHASE4"] === "1" && PHASE4_TABLES.has(table)) return true;
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
      if (prop === "storage" && isExternalFilesEnabled()) {
        return externalStorage;
      }
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

/**
 * Cliente para las consultas del usuario firmado. Conserva el tipo original
 * cuando lo hay; si el llamante no lo tipa, se comporta como antes.
 */
export function assessDb<T>(context: { supabase: T }): T extends { from: any } ? T : any {
  if (!isExternalApiEnabled()) return context.supabase as never;
  return wrap(context.supabase as object, false) as never;
}



/** Cliente de servicio (equivale a la clave de servicio de Lovable Cloud). */
export async function assessAdminDb() {
  if (!isExternalApiEnabled()) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return supabaseAdmin;
  }
  // Con la base externa activa no hace falta la clave de servicio de Lovable
  // Cloud: el proxy redirige las tablas migradas y el almacenamiento a la API
  // propia. El cliente antiguo solo se usa como base para tablas no migradas.
  const base = {
    from: (table: string) => {
      throw new Error(`La tabla "${table}" aún no está migrada a la base propia`);
    },
  };
  return wrap(base, true) as never;
}

/** Alias genéricos (evaluaciones, simulaciones, partidas, informes y consumo). */
export const xdb = assessDb;
export const xAdminDb = assessAdminDb;
