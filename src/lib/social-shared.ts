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
  const clean = body.replace(/\*\*([\s\S]+?)\*\*/g, (_, t: string) => toUnicodeBold(t)).trim();
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

/** Negrita que se ve en todas las redes: letras Unicode "sans-serif bold". */
export function toUnicodeBold(text: string): string {
  const acc: Record<string, string> = { á: "a\u0301", é: "e\u0301", í: "i\u0301", ó: "o\u0301", ú: "u\u0301", Á: "A\u0301", É: "E\u0301", Í: "I\u0301", Ó: "O\u0301", Ú: "U\u0301", ñ: "n\u0303", Ñ: "N\u0303", ü: "u\u0308", Ü: "U\u0308" };
  return Array.from(text).map((ch) => {
    const base = acc[ch] ?? ch;
    return Array.from(base).map((c) => {
      const code = c.codePointAt(0)!;
      if (code >= 65 && code <= 90) return String.fromCodePoint(0x1d5d4 + code - 65);
      if (code >= 97 && code <= 122) return String.fromCodePoint(0x1d5ee + code - 97);
      if (code >= 48 && code <= 57) return String.fromCodePoint(0x1d7ec + code - 48);
      return c;
    }).join("");
  }).join("");
}
