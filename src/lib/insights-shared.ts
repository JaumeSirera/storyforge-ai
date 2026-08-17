import { z } from "zod";

export const REPORT_ROLES = ["entrevistador", "terapeuta", "coordinador"] as const;
export type ReportRole = (typeof REPORT_ROLES)[number];

export const ROLE_GUIDES: Record<
  ReportRole,
  { label: string; audience: string; language: string; sections: string[] }
> = {
  entrevistador: {
    label: "Entrevistador / selección",
    audience: "responsable de selección que debe decidir sobre la idoneidad de una persona para un puesto",
    language: "Lenguaje de evaluación por competencias: evidencias conductuales, indicadores, ejemplos STAR. Nunca rasgos de personalidad ni datos sensibles.",
    sections: [
      "Competencias observadas con evidencia",
      "Señales a verificar en la siguiente entrevista",
      "Encaje con el rol: qué apoya y qué queda por comprobar",
    ],
  },
  terapeuta: {
    label: "Terapeuta / acompañamiento",
    audience: "profesional de acompañamiento psicológico o coaching que trabaja con la persona o el grupo",
    language: "Lenguaje descriptivo, no patologizante, centrado en patrones de interacción y recursos observados. Sin diagnósticos, etiquetas clínicas ni inferencias de salud.",
    sections: [
      "Patrones de interacción observados",
      "Recursos y estrategias que la persona o el grupo ya utiliza",
      "Temas a explorar en la próxima sesión",
    ],
  },
  coordinador: {
    label: "Coordinador / dinámica de equipo",
    audience: "responsable de equipo o formación que necesita mejorar la dinámica del grupo",
    language: "Lenguaje operativo de equipo: reparto de la palabra, toma de decisiones, gestión de desacuerdos, acuerdos de funcionamiento.",
    sections: [
      "Reparto de la palabra y de la iniciativa",
      "Cómo se toman las decisiones y se gestionan los desacuerdos",
      "Acuerdos de funcionamiento propuestos para la próxima reunión",
    ],
  },
};

export const InsightsSchema = z.object({
  headline: z.string().default(""),
  summary: z.string().default(""),
  observations: z.array(z.object({ fact: z.string().default(""), evidence: z.string().default("") })).default([]),
  hypotheses: z.array(z.object({
    hypothesis: z.string().default(""),
    basis: z.string().default(""),
    confidence: z.string().default("media"),
  })).default([]),
  participants: z.array(z.object({
    name: z.string().default(""),
    role: z.string().default(""),
    behaviours: z.array(z.string()).default([]),
  })).default([]),
  roleSections: z.array(z.object({
    title: z.string().default(""),
    points: z.array(z.string()).default([]),
  })).default([]),
  recommendations: z.array(z.string()).default([]),
  followUpQuestions: z.array(z.string()).default([]),
});

export type SessionInsights = z.infer<typeof InsightsSchema> & {
  generatedAt: string | null;
  role?: ReportRole | null;
};