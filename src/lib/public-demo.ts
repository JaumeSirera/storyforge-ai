import type { Story, EvaluationCriterion } from "./story-types";

export const demoCriteria: EvaluationCriterion[] = [
  { key: "empathy", label: "Empatía", description: "Escuchar y reconocer la necesidad del cliente." },
  { key: "resolution", label: "Resolución", description: "Proponer una solución concreta y viable." },
];

export const demoStory: Story = {
  startNodeId: "reception",
  nodes: {
    reception: {
      id: "reception", title: "Una reserva que no aparece", video: { type: "none" },
      narrative: "Un huésped llega tras un viaje largo. Su reserva no aparece en el sistema y el hotel está casi completo.",
      question: {
        text: "¿Cómo respondes al huésped?",
        choices: [
          { id: "listen", label: "Escucho, me disculpo y reviso su confirmación.", feedback: "Reconocer su preocupación y verificar los datos genera confianza.", points: 50, competencies: { empathy: 50 }, next: "solution" },
          { id: "dismiss", label: "Le digo que contacte con la agencia que hizo la reserva.", feedback: "Derivar el problema sin comprobarlo deja al huésped sin ayuda. Todavía puedes reconducir la situación.", points: 10, competencies: { empathy: 10 }, next: "recover" },
        ],
      },
    },
    solution: {
      id: "solution", title: "Encuentra una alternativa", video: { type: "none" },
      narrative: "La confirmación es válida. Queda una habitación de categoría superior disponible.",
      question: {
        text: "¿Qué solución propones?",
        choices: [
          { id: "upgrade", label: "Compruebo la autorización y ofrezco la habitación sin coste extra.", feedback: "Resuelves el problema con una alternativa concreta, respetando los límites de tu puesto.", points: 50, competencies: { resolution: 50 }, next: null },
          { id: "wait", label: "Le pido que espere, sin darle un plazo ni una alternativa.", feedback: "La incertidumbre aumenta su frustración. Una alternativa y un plazo claro habrían mejorado la respuesta.", points: 10, competencies: { resolution: 10 }, next: null },
        ],
      },
    },
    recover: {
      id: "recover", title: "Recupera la confianza", video: { type: "none" },
      narrative: "El huésped muestra su confirmación y pide hablar con alguien que pueda ayudarle.",
      question: {
        text: "¿Cómo reconduces la situación?",
        choices: [
          { id: "take-charge", label: "Asumo la gestión y busco una alternativa con la persona responsable.", feedback: "Asumir la gestión permite recuperar la confianza y avanzar hacia una solución.", points: 50, competencies: { resolution: 50 }, next: null },
          { id: "insist", label: "Insisto en que lo resuelva por su cuenta con la agencia.", feedback: "No ofrecer ayuda ni alternativas deja el conflicto sin resolver.", points: 0, competencies: { resolution: 0 }, next: null },
        ],
      },
    },
  },
};

export function demoStars(score: number) {
  return score >= 100 ? 3 : score >= 60 ? 2 : score > 0 ? 1 : 0;
}