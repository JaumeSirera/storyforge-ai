/** Datos compartidos del estudio de redes sociales (navegador y servidor). */

export const SOCIAL_NETWORKS = [
  { id: "instagram", name: "Instagram", limit: 2200, needsMedia: true },
  { id: "x", name: "X (Twitter)", limit: 280, needsMedia: false },
  { id: "linkedin", name: "LinkedIn", limit: 3000, needsMedia: false },
  { id: "facebook", name: "Facebook", limit: 5000, needsMedia: false },
  { id: "tiktok", name: "TikTok", limit: 2200, needsMedia: true },
  { id: "threads", name: "Threads", limit: 500, needsMedia: false },
  { id: "youtube", name: "YouTube", limit: 5000, needsMedia: true },
] as const;

export type SocialNetworkId = (typeof SOCIAL_NETWORKS)[number]["id"];
export const SOCIAL_NETWORK_IDS = SOCIAL_NETWORKS.map((n) => n.id) as [SocialNetworkId, ...SocialNetworkId[]];

export function networkName(id: string): string {
  return SOCIAL_NETWORKS.find((n) => n.id === id)?.name ?? id;
}

export const FREQUENCIES = [
  { value: 1, label: "Cada día" },
  { value: 3, label: "Cada 3 días" },
  { value: 7, label: "Cada semana" },
  { value: 14, label: "Cada 2 semanas" },
  { value: 30, label: "Cada mes" },
];

export const STATUS_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  programado: "Programado",
  publicado: "Publicado",
  error: "Error",
};

export interface SocialLink {
  label: string;
  url: string;
}

export interface SocialMedia {
  /** Ruta en el almacén de archivos (contenedor "videos"). */
  path: string;
  kind: "imagen" | "video";
  name: string;
}

export interface SocialStorySummary {
  id: string;
  title: string;
  networks: SocialNetworkId[];
  every_days: number;
  chapters: number;
  published: number;
  scheduled: number;
  errors: number;
  updated_at: string;
}

export interface SocialChapter {
  id: string;
  story_id: string;
  position: number;
  title: string;
  body: string;
  links: SocialLink[];
  media: SocialMedia[];
  scheduled_at: string | null;
  status: "pendiente" | "programado" | "publicado" | "error";
  result: string | null;
  published_at: string | null;
}

export interface SocialStoryFull {
  story: { id: string; title: string; networks: SocialNetworkId[]; every_days: number; source_text: string | null };
  chapters: SocialChapter[];
}

export interface SocialQueueItem {
  id: string;
  story_id: string;
  story_title: string;
  title: string;
  status: SocialChapter["status"];
  scheduled_at: string;
  published_at: string | null;
  result: string | null;
  networks: SocialNetworkId[];
}

/** Texto final que se publica: cuerpo + enlaces. */
export function composePost(body: string, links: SocialLink[]): string {
  const clean = body.replace(/\*\*(.+?)\*\*/g, "$1").trim();
  const extra = links
    .filter((l) => l.url.trim())
    .map((l) => (l.label.trim() ? `${l.label.trim()}: ${l.url.trim()}` : l.url.trim()));
  return [clean, ...extra].join("\n\n");
}

/** Fechas de publicación a partir de un inicio y una frecuencia en días. */
export function buildSchedule(count: number, startIso: string, everyDays: number): string[] {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) throw new Error("Fecha de inicio no válida");
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i * everyDays);
    return d.toISOString();
  });
}
