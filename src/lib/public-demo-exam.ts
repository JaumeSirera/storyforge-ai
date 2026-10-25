// Datos locales de la demostración de evaluación escrita (sin cuenta ni servidor).
export type ExamCriterion = { key: string; label: string; max: number };
export type ExamSample = {
  id: string;
  student: string;
  text: string;
  scores: Record<string, number>;
  evidence: Record<string, string>;
  handwriting: string;
  feedback: string;
};

export const examQuestion =
  "Explica las causas principales de la Revolución Francesa (1789). Extensión orientativa: 10-12 líneas.";

export const examRubric: ExamCriterion[] = [
  { key: "content", label: "Contenido y rigor", max: 4 },
  { key: "structure", label: "Estructura y argumentación", max: 3 },
  { key: "language", label: "Expresión y ortografía", max: 2 },
  { key: "presentation", label: "Presentación y legibilidad", max: 1 },
];

export const examSamples: ExamSample[] = [
  {
    id: "lucia",
    student: "Alumna A (ficticia)",
    text:
      "La Revolución Francesa tuvo causas económicas, sociales y políticas. Francia estaba en bancarrota por las guerras y los gastos de la corte, y el pueblo pagaba muchos impuestos mientras la nobleza y el clero no pagaban. Además, las malas cosechas de 1788 subieron el precio del pan. Las ideas de la Ilustración, como las de Rousseau y Montesquieu, criticaban el poder absoluto del rey. Por último, la convocatoria de los Estados Generales y el juramento del Juego de Pelota hicieron estallar el conflicto.",
    scores: { content: 3.5, structure: 2.5, language: 2, presentation: 1 },
    evidence: {
      content: "Cita crisis fiscal, privilegios, malas cosechas e Ilustración con autores concretos.",
      structure: "Ordena las causas por tipo y cierra con el detonante; falta una conclusión propia.",
      language: "Sin faltas detectadas; vocabulario histórico adecuado.",
      presentation: "Letra regular y márgenes limpios.",
    },
    handwriting: "Trazo firme y uniforme, inclinación constante. Legibilidad alta.",
    feedback: "Muy buena respuesta. Para llegar al 10, añade una conclusión que relacione las causas entre sí.",
  },
  {
    id: "marcos",
    student: "Alumno B (ficticio)",
    text:
      "La revolucion francesa fue porque la gente estava harta del rey Luis XVI y tomaron la Bastilla. El rey gastava mucho dinero y havia hambre. Luego le cortaron la cabeza al rey y vino Napoleon.",
    scores: { content: 1.5, structure: 1, language: 0.5, presentation: 0.5 },
    evidence: {
      content: "Menciona gasto y hambre, pero confunde causas con consecuencias (Bastilla, ejecución, Napoleón).",
      structure: "Relato cronológico sin agrupar causas; no hay argumentación.",
      language: "Faltas: «revolucion», «estava», «gastava», «havia», «Napoleon».",
      presentation: "Tachones en la segunda línea; letra irregular al final.",
    },
    handwriting: "Trazo irregular y apretado al final, posible prisa. Legibilidad media.",
    feedback: "Distingue causas de consecuencias y repasa el uso de b/v y las tildes. Organiza la respuesta en causas económicas, sociales y políticas.",
  },
];

export function examGrade(sample: ExamSample): number {
  const total = examRubric.reduce((sum, c) => sum + Math.min(sample.scores[c.key] ?? 0, c.max), 0);
  return Math.round(total * 10) / 10;
}

export function examLevel(grade: number): string {
  if (grade >= 9) return "Sobresaliente";
  if (grade >= 7) return "Notable";
  if (grade >= 6) return "Bien";
  if (grade >= 5) return "Suficiente";
  return "Insuficiente";
}
