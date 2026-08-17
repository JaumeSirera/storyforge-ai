// Exportación del análisis de una sesión a JSON y CSV para integrarlo con otros sistemas
// (ATS, LMS, BI) y obtener trazabilidad minuto a minuto.

import type {
  InteractionNetwork,
  SessionMetrics,
  TranscriptSegment,
} from "./analyze-metrics";
import type { SceneAnnotation } from "./scene-annotations.functions";

export type ExportSource = {
  sessionId: string;
  sessionTitle: string;
  areaKey?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  segments: TranscriptSegment[];
  metrics: SessionMetrics | null;
  interactions: InteractionNetwork | null;
  annotations?: SceneAnnotation[];
  /** Resuelve la clave de hablante a un nombre legible. */
  speakerName: (key: string) => string;
};

/** Fila de trazabilidad por minuto de la sesión. */
export type MinuteRow = {
  minute: number;
  startSec: number;
  endSec: number;
  turns: number;
  speechSec: number;
  silenceSec: number;
  interruptions: number;
  speakers: string[];
  dominantSpeaker: string;
  words: number;
  text: string;
};

function round(n: number, d = 2) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

function overlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

function keyOf(s: TranscriptSegment) {
  return s.participantId ?? s.speakerLabel ?? "desconocido";
}

/** Agrupa la sesión en tramos de un minuto con métricas y texto de cada tramo. */
export function buildMinuteTimeline(src: ExportSource): MinuteRow[] {
  const segs = [...src.segments]
    .map((s) => ({ ...s, startSec: Number(s.startSec) || 0, endSec: Number(s.endSec) || 0 }))
    .filter((s) => s.endSec >= s.startSec)
    .sort((a, b) => a.startSec - b.startSec);
  if (segs.length === 0) return [];

  const spanSec = Math.max(
    src.metrics?.spanSec ?? 0,
    segs[segs.length - 1]!.endSec,
  );
  const totalMinutes = Math.max(1, Math.ceil(spanSec / 60));
  const silences = src.metrics?.silences ?? [];

  const rows: MinuteRow[] = [];
  for (let m = 0; m < totalMinutes; m++) {
    const startSec = m * 60;
    const endSec = Math.min(spanSec, startSec + 60);
    const inWindow = segs.filter((s) => overlap(s.startSec, s.endSec, startSec, endSec) > 0);

    const speechByKey = new Map<string, number>();
    let speechSec = 0;
    let words = 0;
    const texts: string[] = [];
    for (const s of inWindow) {
      const dur = overlap(s.startSec, s.endSec, startSec, endSec);
      speechSec += dur;
      const k = keyOf(s);
      speechByKey.set(k, (speechByKey.get(k) ?? 0) + dur);
      if (s.text?.trim()) {
        texts.push(`${src.speakerName(k)}: ${s.text.trim()}`);
        words += s.text.trim().split(/\s+/).filter(Boolean).length;
      }
    }

    const silenceSec = silences.reduce(
      (acc, sil) => acc + overlap(sil.startSec, sil.endSec, startSec, endSec),
      0,
    );

    // Interrupciones: entradas que solapan el turno anterior dentro de este minuto.
    let interruptions = 0;
    for (let i = 1; i < segs.length; i++) {
      const cur = segs[i]!;
      const prev = segs[i - 1]!;
      if (cur.startSec < startSec || cur.startSec >= endSec) continue;
      if (keyOf(cur) !== keyOf(prev) && cur.startSec < prev.endSec - 0.25) interruptions++;
    }

    const dominant = [...speechByKey.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

    rows.push({
      minute: m + 1,
      startSec,
      endSec: round(endSec),
      turns: inWindow.filter((s) => s.startSec >= startSec && s.startSec < endSec).length,
      speechSec: round(speechSec),
      silenceSec: round(silenceSec),
      interruptions,
      speakers: [...speechByKey.keys()].map(src.speakerName),
      dominantSpeaker: dominant ? src.speakerName(dominant) : "",
      words,
      text: texts.join(" | "),
    });
  }
  return rows;
}

/** Objeto completo del análisis, listo para consumir por otro sistema. */
export function buildAnalysisJson(src: ExportSource) {
  return {
    schema: "playnalyze.analysis.v1",
    exportedAt: new Date().toISOString(),
    session: {
      id: src.sessionId,
      title: src.sessionTitle,
      areaKey: src.areaKey ?? null,
      startedAt: src.startedAt ?? null,
      endedAt: src.endedAt ?? null,
    },
    metrics: src.metrics
      ? {
          ...src.metrics,
          speakers: src.metrics.speakers.map((s) => ({ ...s, name: src.speakerName(s.key) })),
        }
      : null,
    interactions: (src.interactions?.edges ?? []).map((e) => ({
      ...e,
      fromName: src.speakerName(e.from),
      toName: src.speakerName(e.to),
    })),
    minuteTimeline: buildMinuteTimeline(src),
    segments: src.segments.map((s) => ({
      id: s.id,
      recordingId: s.recordingId,
      participantId: s.participantId,
      speakerLabel: s.speakerLabel,
      speakerName: src.speakerName(keyOf(s)),
      startSec: Number(s.startSec) || 0,
      endSec: Number(s.endSec) || 0,
      minute: Math.floor((Number(s.startSec) || 0) / 60) + 1,
      text: s.text,
    })),
    annotations: (src.annotations ?? []).map((a) => ({
      sceneIndex: a.sceneIndex,
      sceneTitle: a.sceneTitle,
      startSec: a.startSec,
      endSec: a.endSec,
      note: a.note,
      tags: a.tags,
    })),
  };
}

function csvCell(value: unknown): string {
  const s =
    value === null || value === undefined
      ? ""
      : Array.isArray(value)
        ? value.join("; ")
        : String(value);
  return `"${s.replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
}

/** Convierte filas a CSV con BOM para que Excel respete los acentos. */
export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))];
  return `\uFEFF${lines.join("\r\n")}`;
}

export function minuteCsv(src: ExportSource): string {
  const rows = buildMinuteTimeline(src);
  return toCsv(
    [
      "minuto",
      "inicio_sec",
      "fin_sec",
      "turnos",
      "segundos_hablando",
      "segundos_silencio",
      "interrupciones",
      "palabras",
      "hablante_dominante",
      "hablantes",
      "transcripcion",
    ],
    rows.map((r) => [
      r.minute,
      r.startSec,
      r.endSec,
      r.turns,
      r.speechSec,
      r.silenceSec,
      r.interruptions,
      r.words,
      r.dominantSpeaker,
      r.speakers,
      r.text,
    ]),
  );
}

export function segmentsCsv(src: ExportSource): string {
  return toCsv(
    [
      "id",
      "minuto",
      "inicio_sec",
      "fin_sec",
      "duracion_sec",
      "hablante",
      "participante_id",
      "etiqueta_hablante",
      "grabacion_id",
      "texto",
    ],
    src.segments.map((s) => {
      const start = Number(s.startSec) || 0;
      const end = Number(s.endSec) || 0;
      return [
        s.id,
        Math.floor(start / 60) + 1,
        round(start),
        round(end),
        round(end - start),
        src.speakerName(keyOf(s)),
        s.participantId ?? "",
        s.speakerLabel ?? "",
        s.recordingId,
        s.text,
      ];
    }),
  );
}

export function speakersCsv(src: ExportSource): string {
  const speakers = src.metrics?.speakers ?? [];
  return toCsv(
    [
      "hablante",
      "clave",
      "turnos",
      "segundos_hablando",
      "porcentaje_habla",
      "turno_medio_sec",
      "turno_mas_largo_sec",
      "interrupciones_hechas",
      "interrupciones_recibidas",
      "palabras",
      "primera_intervencion_sec",
      "inicios_de_tema",
    ],
    speakers.map((s) => [
      src.speakerName(s.key),
      s.key,
      s.turns,
      s.talkTimeSec,
      s.talkSharePct,
      s.avgTurnSec,
      s.longestTurnSec,
      s.interruptionsMade,
      s.interruptionsReceived,
      s.wordCount,
      s.firstSpokeAtSec ?? "",
      s.topicStarts,
    ]),
  );
}

export function interactionsCsv(src: ExportSource): string {
  return toCsv(
    ["de", "a", "clave_de", "clave_a", "veces", "segundos"],
    (src.interactions?.edges ?? []).map((e) => [
      src.speakerName(e.from),
      src.speakerName(e.to),
      e.from,
      e.to,
      e.count,
      e.secondsSec,
    ]),
  );
}

function slug(text: string) {
  return (
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "sesion"
  );
}

/** Descarga un texto como archivo en el navegador. */
export function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type CsvKind = "minutes" | "segments" | "speakers" | "interactions";

const CSV_BUILDERS: Record<CsvKind, (src: ExportSource) => string> = {
  minutes: minuteCsv,
  segments: segmentsCsv,
  speakers: speakersCsv,
  interactions: interactionsCsv,
};

export function exportAnalysisJson(src: ExportSource) {
  downloadText(
    `analisis-${slug(src.sessionTitle)}.json`,
    JSON.stringify(buildAnalysisJson(src), null, 2),
    "application/json",
  );
}

export function exportAnalysisCsv(src: ExportSource, kind: CsvKind) {
  downloadText(
    `analisis-${slug(src.sessionTitle)}-${kind}.csv`,
    CSV_BUILDERS[kind](src),
    "text/csv",
  );
}
