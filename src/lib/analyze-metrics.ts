// Métricas objetivas de interacción calculadas a partir de los segmentos de transcripción.
// Solo hechos observables: turnos, tiempo hablando, interrupciones, silencios y quién responde a quién.

export interface TranscriptSegment {
  id: string;
  recordingId: string;
  participantId: string | null;
  speakerLabel: string | null;
  startSec: number;
  endSec: number;
  text: string;
}

export interface SpeakerMetrics {
  /** participantId cuando está asignado; si no, la etiqueta de hablante. */
  key: string;
  participantId: string | null;
  speakerLabel: string | null;
  turns: number;
  talkTimeSec: number;
  talkSharePct: number;
  avgTurnSec: number;
  longestTurnSec: number;
  interruptionsMade: number;
  interruptionsReceived: number;
  wordCount: number;
  firstSpokeAtSec: number | null;
  /** Número de veces que inicia un tema tras un silencio largo. */
  topicStarts: number;
}

export interface SessionMetrics {
  totalSpeechSec: number;
  spanSec: number;
  silenceSec: number;
  silences: { startSec: number; endSec: number; durationSec: number }[];
  totalTurns: number;
  totalInterruptions: number;
  /** 0..1 — 1 = participación perfectamente repartida (índice de Gini invertido). */
  participationBalance: number;
  speakers: SpeakerMetrics[];
}

export interface InteractionEdge {
  from: string;
  to: string;
  count: number;
  /** Suma de segundos de las respuestas dirigidas. */
  secondsSec: number;
}

export interface InteractionNetwork {
  edges: InteractionEdge[];
}

/** Umbral (s) por debajo del cual una entrada solapada se considera interrupción. */
const OVERLAP_TOLERANCE = 0.25;
/** Hueco (s) a partir del cual se considera silencio del grupo. */
const SILENCE_GAP = 2;

function speakerKey(s: TranscriptSegment) {
  return s.participantId ?? s.speakerLabel ?? "desconocido";
}

function words(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function round(n: number, d = 2) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

export function computeSessionMetrics(segments: TranscriptSegment[]): {
  metrics: SessionMetrics;
  interactions: InteractionNetwork;
} {
  const ordered = [...segments]
    .map((s) => ({ ...s, startSec: Number(s.startSec) || 0, endSec: Number(s.endSec) || 0 }))
    .filter((s) => s.endSec >= s.startSec)
    .sort((a, b) => a.startSec - b.startSec);

  const acc = new Map<string, SpeakerMetrics>();
  const ensure = (s: TranscriptSegment): SpeakerMetrics => {
    const key = speakerKey(s);
    let m = acc.get(key);
    if (!m) {
      m = {
        key,
        participantId: s.participantId ?? null,
        speakerLabel: s.speakerLabel ?? null,
        turns: 0,
        talkTimeSec: 0,
        talkSharePct: 0,
        avgTurnSec: 0,
        longestTurnSec: 0,
        interruptionsMade: 0,
        interruptionsReceived: 0,
        wordCount: 0,
        firstSpokeAtSec: null,
        topicStarts: 0,
      };
      acc.set(key, m);
    }
    if (!m.participantId && s.participantId) m.participantId = s.participantId;
    return m;
  };

  const edges = new Map<string, InteractionEdge>();
  const silences: SessionMetrics["silences"] = [];
  let totalSpeechSec = 0;
  let totalInterruptions = 0;
  let prev: (TranscriptSegment & { key: string }) | null = null;

  for (const seg of ordered) {
    const key = speakerKey(seg);
    const m = ensure(seg);
    const dur = Math.max(0, seg.endSec - seg.startSec);

    m.turns += 1;
    m.talkTimeSec += dur;
    m.longestTurnSec = Math.max(m.longestTurnSec, dur);
    m.wordCount += words(seg.text);
    if (m.firstSpokeAtSec === null) m.firstSpokeAtSec = seg.startSec;
    totalSpeechSec += dur;

    if (prev) {
      const gap = seg.startSec - prev.endSec;
      if (prev.key !== key) {
        if (gap < -OVERLAP_TOLERANCE) {
          m.interruptionsMade += 1;
          ensure(prev).interruptionsReceived += 1;
          totalInterruptions += 1;
        }
        // Respuesta dirigida: quien habla justo después responde al turno anterior.
        if (gap <= SILENCE_GAP) {
          const id = `${key}→${prev.key}`;
          const e = edges.get(id) ?? { from: key, to: prev.key, count: 0, secondsSec: 0 };
          e.count += 1;
          e.secondsSec += dur;
          edges.set(id, e);
        }
      }
      if (gap > SILENCE_GAP) {
        silences.push({
          startSec: round(prev.endSec),
          endSec: round(seg.startSec),
          durationSec: round(gap),
        });
        m.topicStarts += 1;
      }
    } else {
      m.topicStarts += 1;
    }

    prev = { ...seg, key };
  }

  const speakers = [...acc.values()].map((m) => ({
    ...m,
    talkTimeSec: round(m.talkTimeSec),
    longestTurnSec: round(m.longestTurnSec),
    avgTurnSec: m.turns ? round(m.talkTimeSec / m.turns) : 0,
    talkSharePct: totalSpeechSec ? round((m.talkTimeSec / totalSpeechSec) * 100, 1) : 0,
    firstSpokeAtSec: m.firstSpokeAtSec === null ? null : round(m.firstSpokeAtSec),
  }));
  speakers.sort((a, b) => b.talkTimeSec - a.talkTimeSec);

  const spanSec = ordered.length
    ? round(Math.max(...ordered.map((s) => s.endSec)) - Math.min(...ordered.map((s) => s.startSec)))
    : 0;

  return {
    metrics: {
      totalSpeechSec: round(totalSpeechSec),
      spanSec,
      silenceSec: round(silences.reduce((a, s) => a + s.durationSec, 0)),
      silences,
      totalTurns: ordered.length,
      totalInterruptions,
      participationBalance: round(balance(speakers.map((s) => s.talkTimeSec)), 2),
      speakers,
    },
    interactions: { edges: [...edges.values()].sort((a, b) => b.count - a.count) },
  };
}

/** 1 - Gini: 1 = reparto equilibrado, 0 = una sola persona habla. */
function balance(values: number[]): number {
  const v = values.filter((x) => x > 0).sort((a, b) => a - b);
  const n = v.length;
  if (n <= 1) return n === 1 ? 1 : 0;
  const total = v.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  let cum = 0;
  for (let i = 0; i < n; i++) cum += (i + 1) * v[i]!;
  const gini = (2 * cum) / (n * total) - (n + 1) / n;
  return Math.max(0, Math.min(1, 1 - gini));
}

export function formatSec(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
