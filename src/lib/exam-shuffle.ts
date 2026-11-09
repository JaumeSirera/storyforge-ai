/** Orden aleatorio estable por aspirante: misma semilla (token) = mismo orden tras recargar. */
function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: string) {
  let a = hashSeed(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const out = items.slice();
  const r = rng(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Baraja preguntas y, dentro de cada una, sus opciones. */
export function shuffleExamQuestions<Q extends { id: string; options: { id: string }[] }>(
  questions: readonly Q[],
  seed: string,
): Q[] {
  return seededShuffle(questions, `${seed}:q`).map((q) => ({
    ...q,
    options: seededShuffle(q.options, `${seed}:o:${q.id}`),
  }));
}
