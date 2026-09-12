import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Copia puntual de las tablas de evaluaciones desde Lovable Cloud a la base
 * de datos externa (PHP + MySQL), conservando los identificadores.
 *
 * Es idempotente: si una fila ya existe en la base externa se actualiza.
 */
const TABLES = [
  "assessments",
  "assessment_candidates",
  "assessment_submissions",
  "assessment_annotations",
  "assessment_collaborators",
  "question_bank_items",
  "question_bank_versions",
  "candidate_invite_emails",
  "exam_audit_log",
] as const;

type Table = (typeof TABLES)[number];

export const migrateAssessmentsToExternal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { externalApi, isExternalApiEnabled } = await import("./external-data.server");
    if (!isExternalApiEnabled()) {
      throw new Error("La base de datos externa no está configurada.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const report: Record<string, { copied: number; updated: number; failed: number; errors: string[] }> = {};

    for (const table of TABLES) {
      const entry = { copied: 0, updated: 0, failed: 0, errors: [] as string[] };
      report[table] = entry;

      const { data, error } = await supabaseAdmin.from(table).select("*");
      if (error) {
        entry.errors.push(error.message);
        continue;
      }

      for (const row of (data ?? []) as Array<Record<string, unknown>>) {
        const id = String(row["id"]);
        try {
          const existing = await externalApi
            .get<Record<string, unknown> | null>("", table as Table, id)
            .catch(() => null);

          if (existing && existing["id"]) {
            await externalApi.update("", table as Table, id, row);
            entry.updated += 1;
            continue;
          }

          await externalApi.create("", table as Table, row);
          entry.copied += 1;
          // Segundo paso: campos que solo se aceptan al actualizar.
          await externalApi.update("", table as Table, id, row).catch(() => undefined);
        } catch (err) {
          entry.failed += 1;
          const message = err instanceof Error ? err.message : String(err);
          if (entry.errors.length < 5) entry.errors.push(`${id}: ${message}`);
        }
      }
    }

    return report;
  });
