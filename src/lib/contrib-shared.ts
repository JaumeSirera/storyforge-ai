export const PROPOSAL_KINDS = ["mejora", "funcion", "correccion", "contenido", "otro"] as const;
export type ProposalKind = (typeof PROPOSAL_KINDS)[number];

export const PROPOSAL_KIND_LABELS: Record<ProposalKind, string> = {
  mejora: "Mejora de algo existente",
  funcion: "Nueva función",
  correccion: "Corrección de un fallo",
  contenido: "Contenido o plantilla",
  otro: "Otro",
};

export const STATUS_LABELS: Record<string, string> = {
  pending: "En revisión",
  approved: "Aprobada",
  rejected: "Rechazada",
  revoked: "Retirada",
  changes: "Cambios solicitados",
};

export interface ContribRequest {
  id: string;
  user_id?: string;
  email?: string;
  full_name?: string | null;
  motivation: string;
  skills: string;
  github_user: string;
  status: string;
  admin_note: string | null;
  decided_at: string | null;
  created_at: string;
}

export interface ContribProposal {
  id: string;
  user_id?: string;
  email?: string;
  kind: ProposalKind;
  title: string;
  description: string;
  link: string;
  status: string;
  admin_note: string | null;
  decided_at: string | null;
  created_at: string;
}

export interface ContribMe {
  request: ContribRequest | null;
  is_collaborator: boolean;
  proposals: ContribProposal[];
}
