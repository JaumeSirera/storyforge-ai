/**
 * Agrupa las pistas guardadas de una sesión en «tomas»: la pantalla y la cámara
 * del mismo participante grabadas a la vez. Las grabaciones largas guardan la
 * cámara por partes (cada pocos minutos); esas partes se encadenan en la misma
 * toma cuando cada una empieza justo donde acabó la anterior.
 */

export type RecTrack = {
  id: string;
  kind: string;
  durationSec?: number | null;
  syncOffsetMs: number;
  participantId?: string | null;
  createdAt: string;
};

export type Take<T extends RecTrack = RecTrack> = {
  key: string;
  participantId?: string | null;
  tracks: T[];
};

/** Pistas subidas a la vez (al parar) aparecen con pocos segundos de diferencia. */
const SAME_TAKE_MS = 120_000;
/** Las partes de cámara se suben cada ~5 min; dejamos margen por subidas lentas. */
const NEXT_PART_MS = 8 * 60_000;
/** Tolerancia entre el final de una parte y el inicio de la siguiente. */
const CONTIGUOUS_MS = 20_000;

const time = (r: RecTrack) => new Date(r.createdAt).getTime();

/** Partes de cámara de la toma, en orden de reproducción. */
export function cameraParts<T extends RecTrack>(take: Take<T>): T[] {
  return take.tracks.filter((t) => t.kind === "camera").sort((a, b) => a.syncOffsetMs - b.syncOffsetMs);
}

function continuesCamera(g: Take, r: RecTrack): boolean {
  if (r.kind !== "camera" || g.tracks.some((x) => x.kind === "screen")) return false;
  const parts = cameraParts(g);
  const last = parts[parts.length - 1];
  if (!last || !last.durationSec) return false;
  const gap = time(r) - time(last);
  const expectedStart = last.syncOffsetMs + last.durationSec * 1000;
  return gap >= 0 && gap < NEXT_PART_MS && Math.abs(r.syncOffsetMs - expectedStart) <= CONTIGUOUS_MS;
}

export function buildTakes<T extends RecTrack>(recordings: T[]): Take<T>[] {
  const takes: Take<T>[] = [];
  for (const r of [...recordings].sort((a, b) => time(a) - time(b))) {
    const pid = r.participantId ?? null;
    const latest = (g: Take<T>) => Math.max(...g.tracks.map(time));
    const target =
      takes.find((g) => g.participantId === pid && continuesCamera(g, r)) ??
      takes.find(
        (g) =>
          g.participantId === pid &&
          !g.tracks.some((x) => x.kind === r.kind) &&
          Math.abs(latest(g) - time(r)) < SAME_TAKE_MS,
      );
    if (target) target.tracks.push(r);
    else takes.push({ key: r.id, participantId: pid, tracks: [r] });
  }
  // Pantalla primero, luego la cámara en orden; tomas más recientes arriba.
  const order: Record<string, number> = { screen: 0, camera: 1, audio: 2 };
  for (const g of takes) {
    g.tracks.sort((a, b) => (order[a.kind] ?? 9) - (order[b.kind] ?? 9) || a.syncOffsetMs - b.syncOffsetMs);
  }
  return takes.reverse();
}
