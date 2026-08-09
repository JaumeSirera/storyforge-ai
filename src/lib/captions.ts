// Subtitle (SRT / WebVTT) parsing + lookup helpers shared by player and editor.

export interface CaptionCue {
  start: number;
  end: number;
  text: string;
}

export interface CaptionTrack {
  /** Raw SRT or WebVTT content pasted by the author. */
  content: string;
  /** Human label shown in the player, e.g. "Español". */
  label?: string;
  /** BCP-47 language tag, e.g. "es". */
  lang?: string;
  /** Enabled by default when the scene starts. */
  defaultOn?: boolean;
}

function toSeconds(stamp: string): number {
  // Accepts 00:00:01,500 / 00:00:01.500 / 00:01.500
  const clean = stamp.trim().replace(",", ".");
  const parts = clean.split(":").map((p) => Number(p));
  if (parts.some((n) => Number.isNaN(n))) return NaN;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] ?? NaN;
}

const TIME_LINE = /(\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3}\s*-->\s*(\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3}/;

/** Parses SRT or WebVTT text into ordered cues. Invalid blocks are skipped. */
export function parseCaptions(raw: string | undefined | null): CaptionCue[] {
  if (!raw || !raw.trim()) return [];
  const text = raw.replace(/\r\n?/g, "\n").replace(/^\uFEFF/, "");
  const lines = text.split("\n");
  const cues: CaptionCue[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!TIME_LINE.test(line)) continue;
    const [rawStart, rawEnd] = line.split("-->");
    const start = toSeconds(rawStart);
    const end = toSeconds((rawEnd ?? "").split(/\s+/).filter(Boolean)[0] ?? "");
    if (Number.isNaN(start) || Number.isNaN(end)) continue;

    const body: string[] = [];
    let j = i + 1;
    for (; j < lines.length; j++) {
      if (lines[j].trim() === "") break;
      body.push(lines[j]);
    }
    i = j;
    const clean = body
      .join("\n")
      .replace(/<[^>]+>/g, "")
      .trim();
    if (clean) cues.push({ start, end, text: clean });
  }

  return cues.sort((a, b) => a.start - b.start);
}

/** Returns the cue active at `time` (seconds), or null. */
export function cueAt(cues: CaptionCue[], time: number): CaptionCue | null {
  if (!cues.length || typeof time !== "number" || Number.isNaN(time)) return null;
  for (const c of cues) {
    if (time >= c.start && time <= c.end) return c;
    if (c.start > time) break;
  }
  return null;
}

/** Detects the pasted format (for author feedback in the editor). */
export function captionFormat(raw: string | undefined | null): "vtt" | "srt" | "unknown" {
  if (!raw?.trim()) return "unknown";
  if (/^\uFEFF?WEBVTT/.test(raw.trim())) return "vtt";
  return TIME_LINE.test(raw) ? "srt" : "unknown";
}
