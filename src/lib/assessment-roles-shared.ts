export const COLLABORATOR_ROLES = ["corrector", "anotador", "aprobador", "revisor"] as const;
export type CollaboratorRole = (typeof COLLABORATOR_ROLES)[number];

export const COLLABORATOR_ROLE_LABELS: Record<CollaboratorRole, string> = {
  corrector: "Corrector (corrige y anota)",
  anotador: "Anotador (solo marcas y comentarios)",
  aprobador: "Aprobador (valida la calificación)",
  revisor: "Revisor (solo lectura)",
};

export interface AssessmentPermissions {
  isOwner: boolean;
  canView: boolean;
  canGrade: boolean;
  canAnnotate: boolean;
  canApprove: boolean;
  canManageCollaborators: boolean;
  role: CollaboratorRole | "propietario" | null;
}

export interface Collaborator {
  id: string;
  assessmentId: string;
  userId: string;
  email: string;
  role: CollaboratorRole;
  createdAt: string;
}
