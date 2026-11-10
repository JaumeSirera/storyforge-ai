/**
 * Ayuda local del asistente: respuestas sobre el manejo de la app sin IA ni coste.
 * Las preguntas que no encajan aquí se tratan como «prompt libre».
 */
export type HelpTopic = {
  id: string;
  question: string;
  keywords: string[];
  answer: string;
};

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: "crear-simulacion",
    question: "¿Cómo creo una simulación?",
    keywords: ["simulacion", "crear", "nueva", "historia", "escenas", "arbol", "decisiones", "juego"],
    answer:
      "Pulsa «Nueva» en el menú. Rellena cuatro pasos: el objetivo, el guion o contexto, los vídeos si los tienes y el modelo de IA. La IA prepara la historia, las escenas, las preguntas y el árbol de decisiones. Después la encontrarás en «Mis simulaciones», donde puedes revisarla y publicarla.",
  },
  {
    id: "invitar",
    question: "¿Cómo invito a un candidato?",
    keywords: ["invitar", "invitacion", "candidato", "enlace", "compartir", "alumno", "aspirante"],
    answer:
      "Abre la simulación en «Mis simulaciones» y baja hasta «Invitaciones privadas». Crea una invitación, elige cuántos días dura y cuántos usos permite, y envía el enlace. Cuando la persona termine, verás su informe en las sesiones de esa simulación.",
  },
  {
    id: "corregir-examenes",
    question: "¿Cómo corrijo exámenes escaneados?",
    keywords: ["corregir", "correccion", "examen", "examenes", "escaneado", "foto", "manuscrito", "nota", "rubrica"],
    answer:
      "Entra en «Evaluaciones». Crea una evaluación con su título, la materia y la puntuación máxima, y revisa la rúbrica. Luego sube las fotos o escaneos de cada examen. La IA lee la letra, propone una nota con sus evidencias y un comentario. Tú revisas y decides la nota final.",
  },
  {
    id: "examen-online",
    question: "¿Cómo hago un examen online con tiempo?",
    keywords: ["online", "tiempo", "limite", "trampas", "copiar", "integridad", "pantalla", "cronometro"],
    answer:
      "En «Evaluaciones» crea el examen y comparte el enlace con cada aspirante. Puedes poner tiempo límite: al acabarse se entrega solo. La app baraja preguntas y opciones, avisa si sale de la pestaña y marca respuestas muy parecidas. Son indicios para revisar, no pruebas.",
  },
  {
    id: "grabacion",
    question: "¿Cómo grabo una sesión?",
    keywords: ["grabar", "grabacion", "camara", "microfono", "sesion", "consentimiento", "terapia", "entrevista"],
    answer:
      "Ve a «Grabaciones» y crea una nueva sesión. Antes de empezar, haz la prueba de cámara, micrófono y conexión. Cada participante acepta el consentimiento y puede descargarlo en PDF. Mientras grabas, la app guarda partes cada pocos minutos para no perder nada.",
  },
  {
    id: "claves-ia",
    question: "¿Dónde pongo mis claves de IA?",
    keywords: ["clave", "claves", "api", "key", "ia", "modelo", "proveedor", "openai", "gemini", "ajustes"],
    answer:
      "En «Ajustes», apartado «Proveedor de texto», elige tu proveedor y pega tu clave. Puedes añadir modelos de respaldo por si uno falla. Con el botón «Probar IA y fallback» compruebas que todo responde bien.",
  },
  {
    id: "practica-comparar",
    question: "¿Puedo practicar o comparar candidatos?",
    keywords: ["practica", "practicar", "comparar", "comparacion", "competencias", "ranking"],
    answer:
      "Sí. Con «Practicar (no cuenta)» juegas una simulación sin que aparezca en la lista del evaluador. Y en las sesiones de una simulación puedes comparar hasta cinco personas: puntos, estrellas, competencias y tiempo medio por decisión.",
  },
  {
    id: "movil",
    question: "¿Puedo usarla en el móvil?",
    keywords: ["movil", "telefono", "instalar", "android", "iphone", "app"],
    answer:
      "Sí. Pulsa «App móvil» en el menú y sigue los pasos para instalarla en tu pantalla de inicio. Funciona como una app más, sin pasar por ninguna tienda.",
  },
  {
    id: "colaborar",
    question: "¿Cómo puedo colaborar en el proyecto?",
    keywords: ["colaborar", "colaborador", "open source", "codigo", "github", "contribuir", "gratis", "precio"],
    answer:
      "Xandralyze es gratis y de código abierto. En «Colaborar» puedes pedir ser colaborador. Cuando el administrador te apruebe, podrás proponer mejoras, y cada cambio se revisa antes de publicarse.",
  },
];

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Devuelve el tema de ayuda que mejor encaja, o null si es un prompt libre. */
export function findHelpTopic(question: string): HelpTopic | null {
  const q = ` ${normalizeText(question)} `;
  let best: HelpTopic | null = null;
  let bestScore = 0;
  for (const topic of HELP_TOPICS) {
    let score = 0;
    for (const kw of topic.keywords) {
      if (q.includes(` ${kw} `) || q.includes(` ${kw}s `)) score += kw.includes(" ") ? 2 : 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = topic;
    }
  }
  return bestScore >= 1 ? best : null;
}
