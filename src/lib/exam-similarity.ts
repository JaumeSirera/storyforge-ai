/** Detección de respuestas muy parecidas entre aspirantes de una misma evaluación. */

export const SIMILARITY_THRESHOLD = 0.5;
export const MIN_WORDS = 8;

/** Extrae las respuestas escritas del texto de entrega ("Pregunta N: …\nRespuesta: …"). */
export function parseAnswers(text: string): Map<number, string> {
  const out = new Map<number, string>();
  for (const part of (text ?? "").split(/\n\n(?=Pregunta \d+: )/)) {
    const m = part.match(/^Pregunta (\d+): [\s\S]*?\nRespuesta: ([\s\S]*)$/);
    if (!m) continue;
    const body = m[2]
      .split("\n")
      .filter((l) => !l.startsWith("Opción elegida:"))
      .join(" ")
      .trim();
    if (body && body !== "(sin responder)") out.set(Number(m[1]), body);
  }
  return out;
}

function words(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function shingles(w: string[], n = 3) {
  const set = new Set<string>();
  for (let i = 0; i + n <= w.length; i++) set.add(w.slice(i, i + n).join(" "));
  return set;
}

/** Similitud (0–1) entre dos respuestas, por grupos de 3 palabras en común. */
export function answerSimilarity(a: string, b: string): number {
  const wa = words(a);
  const wb = words(b);
  if (wa.length < MIN_WORDS || wb.length < MIN_WORDS) return 0;
  const sa = shingles(wa);
  const sb = shingles(wb);
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

export interface SimilarPair {
  a: { id: string; name: string };
  b: { id: string; name: string };
  /** Preguntas (número) con respuestas parecidas y su similitud. */
  questions: { question: number; score: number }[];
  maxScore: number;
}

export function findSimilarPairs(
  subs: { id: string; name: string; text: string }[],
  threshold = SIMILARITY_THRESHOLD,
): SimilarPair[] {
  const parsed = subs.map((s) => ({ ...s, answers: parseAnswers(s.text) }));
  const pairs: SimilarPair[] = [];
  for (let i = 0; i < parsed.length; i++) {
    for (let j = i + 1; j < parsed.length; j++) {
      const qs: { question: number; score: number }[] = [];
      for (const [q, ans] of parsed[i].answers) {
        const other = parsed[j].answers.get(q);
        if (!other) continue;
        const score = answerSimilarity(ans, other);
        if (score >= threshold) qs.push({ question: q, score: Math.round(score * 100) / 100 });
      }
      if (qs.length)
        pairs.push({
          a: { id: parsed[i].id, name: parsed[i].name },
          b: { id: parsed[j].id, name: parsed[j].name },
          questions: qs,
          maxScore: Math.max(...qs.map((q) => q.score)),
        });
    }
  }
  return pairs.sort((x, y) => y.maxScore - x.maxScore);
}
