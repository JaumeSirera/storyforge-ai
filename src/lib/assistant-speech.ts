/**
 * Trocea una respuesta para leerla en voz alta por partes: la primera es corta
 * (una frase) para que la asistente empiece a hablar enseguida mientras se
 * prepara el resto.
 */
export function splitForSpeech(text: string, firstMax = 120, max = 280): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?¿¡:;\n]+[.!?:;]+["»”)]*\s*|[^.!?:;]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [clean];
  const out: string[] = [];
  let cur = "";
  const limit = () => (out.length === 0 ? firstMax : max);
  const push = () => {
    if (cur) out.push(cur);
    cur = "";
  };
  for (const s of sentences) {
    // Frase demasiado larga: se corta por comas o espacios.
    const pieces = s.length > limit() ? cutLong(s, limit()) : [s];
    for (const p of pieces) {
      if (!cur) cur = p;
      else if (cur.length + 1 + p.length <= limit()) cur += " " + p;
      else {
        push();
        cur = p;
      }
      if (out.length === 0 && cur.length >= 40) push(); // la primera parte, cuanto antes
    }
  }
  push();
  return out;
}

function cutLong(s: string, max: number): string[] {
  const out: string[] = [];
  let rest = s;
  while (rest.length > max) {
    let at = rest.lastIndexOf(", ", max);
    if (at < max * 0.4) at = rest.lastIndexOf(" ", max);
    if (at <= 0) at = max;
    out.push(rest.slice(0, at + (rest[at] === "," ? 1 : 0)).trim());
    rest = rest.slice(at + 1).trim();
  }
  if (rest) out.push(rest);
  return out;
}
