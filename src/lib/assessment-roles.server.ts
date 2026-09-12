import {
  COLLABORATOR_ROLES,
  type AssessmentPermissions,
  type Collaborator,
  type CollaboratorRole,
} from "./assessment-roles-shared";
import { assessDb, assessAdminDb } from "./assessments-repo.server";

export type { AssessmentPermissions, Collaborator, CollaboratorRole };

const COLUMNS = "id, assessment_id, user_id, email, role, created_at";

function mapCollaborator(row: any): Collaborator {
  return {
    id: row.id,
    assessmentId: row.assessment_id,
    userId: row.user_id,
    email: row.email ?? "",
    role: (COLLABORATOR_ROLES as readonly string[]).includes(row.role)
      ? (row.role as CollaboratorRole)
      : "revisor",
    createdAt: row.created_at,
  };
}

const OWNER_PERMISSIONS: AssessmentPermissions = {
  isOwner: true,
  canView: true,
  canGrade: true,
  canAnnotate: true,
  canApprove: true,
  canManageCollaborators: true,
  role: "propietario",
};

const NO_PERMISSIONS: AssessmentPermissions = {
  isOwner: false,
  canView: false,
  canGrade: false,
  canAnnotate: false,
  canApprove: false,
  canManageCollaborators: false,
  role: null,
};

/** Calcula los permisos efectivos del usuario autenticado sobre una evaluación. */
export async function resolvePermissions(
  assessmentId: string,
  context: any,
): Promise<AssessmentPermissions> {
  const { data: owned } = await assessDb(context)
    .from("assessments")
    .select("id")
    .eq("id", assessmentId)
    .eq("owner_id", context.userId)
    .maybeSingle();
  if (owned) return OWNER_PERMISSIONS;

  const { data: collab } = await assessDb(context)
    .from("assessment_collaborators")
    .select("role")
    .eq("assessment_id", assessmentId)
    .eq("user_id", context.userId)
    .maybeSingle();
  if (!collab) return NO_PERMISSIONS;

  const role = mapCollaborator({ role: collab.role }).role;
  return {
    isOwner: false,
    canView: true,
    canGrade: role === "corrector",
    canAnnotate: role === "corrector" || role === "anotador",
    canApprove: role === "aprobador",
    canManageCollaborators: false,
    role,
  };
}

/** Igual que resolvePermissions pero partiendo de una entrega. */
export async function resolveSubmissionPermissions(submissionId: string, context: any) {
  const { data: row, error } = await assessDb(context)
    .from("assessment_submissions")
    .select("id, assessment_id")
    .eq("id", submissionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("Entrega no encontrada.");
  const permissions = await resolvePermissions(row.assessment_id, context);
  if (!permissions.canView) throw new Error("Entrega no encontrada.");
  return { assessmentId: row.assessment_id as string, permissions };
}

export async function assertAssessmentPermission(
  assessmentId: string,
  perm: "view" | "grade" | "annotate" | "approve" | "manage",
  context: any,
) {
  const permissions = await resolvePermissions(assessmentId, context);
  const ok =
    perm === "view"
      ? permissions.canView
      : perm === "grade"
        ? permissions.canGrade
        : perm === "annotate"
          ? permissions.canAnnotate
          : perm === "approve"
            ? permissions.canApprove
            : permissions.canManageCollaborators;
  if (!ok) throw new Error("No tienes permiso para esta acción en esta evaluación.");
  return permissions;
}

export async function assertSubmissionPermission(
  submissionId: string,
  perm: "view" | "grade" | "annotate" | "approve" | "manage",
  context: any,
) {
  const { assessmentId } = await resolveSubmissionPermissions(submissionId, context);
  const permissions = await assertAssessmentPermission(assessmentId, perm, context);
  return { assessmentId, permissions };
}

// ───────────────────────────── gestión de colaboradores ─────────────────────────────

export async function listCollaboratorsHandler(data: { assessmentId: string }, context: any) {
  const permissions = await assertAssessmentPermission(data.assessmentId, "view", context);
  const { data: rows, error } = await assessDb(context)
    .from("assessment_collaborators")
    .select(COLUMNS)
    .eq("assessment_id", data.assessmentId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return { collaborators: (rows ?? []).map(mapCollaborator), permissions };
}

export async function upsertCollaboratorHandler(
  data: { assessmentId: string; email: string; role: CollaboratorRole },
  context: any,
) {
  await assertAssessmentPermission(data.assessmentId, "manage", context);
  const email = data.email.trim().toLowerCase();

  const supabaseAdmin = await assessAdminDb();
  const { data: profile, error: pErr } = await supabaseAdmin
    .from("profiles")
    .select("id, email")
    .ilike("email", email)
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);
  if (!profile) throw new Error("No existe ninguna cuenta con ese email. Pídele que se registre primero.");
  if (profile.id === context.userId) throw new Error("Ya eres la persona propietaria de la evaluación.");

  const { data: row, error } = await assessDb(context)
    .from("assessment_collaborators")
    .upsert(
      {
        assessment_id: data.assessmentId,
        owner_id: context.userId,
        user_id: profile.id,
        email: profile.email ?? email,
        role: data.role,
      },
      { onConflict: "assessment_id,user_id" },
    )
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return { collaborator: mapCollaborator(row) };
}

export async function removeCollaboratorHandler(data: { id: string }, context: any) {
  const { error } = await assessDb(context)
    .from("assessment_collaborators")
    .delete()
    .eq("id", data.id)
    .eq("owner_id", context.userId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

// ───────────────────────────── aprobación de calificaciones ─────────────────────────────

export async function setSubmissionApprovalHandler(
  data: { id: string; decision: "pending" | "approved" | "rejected"; note?: string },
  context: any,
) {
  await assertSubmissionPermission(data.id, "approve", context);
  const { data: row, error } = await assessDb(context)
    .from("assessment_submissions")
    .update({
      approval_status: data.decision,
      approval_note: (data.note ?? "").slice(0, 1000),
      approved_by: data.decision === "pending" ? null : context.userId,
      approved_at: data.decision === "pending" ? null : new Date().toISOString(),
    })
    .eq("id", data.id)
    .select("id, approval_status, approval_note, approved_by, approved_at")
    .single();
  if (error) throw new Error(error.message);
  return {
    approval: {
      status: row.approval_status as "pending" | "approved" | "rejected",
      note: row.approval_note ?? "",
      approvedBy: row.approved_by ?? null,
      approvedAt: row.approved_at ?? null,
    },
  };
}
