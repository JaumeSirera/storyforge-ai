/**
 * Ayuda local del asistente: respuestas sobre el manejo de la app sin IA ni coste.
 * Las preguntas que no encajan aquí se tratan como «prompt libre» y las responde
 * la IA del propio usuario (con estas mismas explicaciones como contexto).
 */
export type HelpLink =
  | "/app/dashboard"
  | "/app/new"
  | "/app/simulations"
  | "/app/assessments"
  | "/app/assessments/bank"
  | "/app/capture"
  | "/app/settings"
  | "/app/ai-test"
  | "/app/contribute"
  | "/app/admin/social"
  | "/install";

export type HelpTopic = {
  id: string;
  question: string;
  keywords: string[];
  answer: string;
  /** Pantalla a la que lleva el botón «Ir a…». */
  link?: { to: HelpLink; label: string };
  /**
   * Vídeo grabado (color sobre máscara, como el saludo) que dice esta respuesta.
   * Si existe se reproduce en vez de la voz generada, con la cara entera moviéndose.
   */
  video?: string;
};

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: "crear-simulacion",
    question: "¿Cómo creo una simulación?",
    keywords: ["simulacion", "crear", "nueva", "historia", "escenas", "arbol", "decisiones", "juego"],
    answer:
      "Pulsa «Nueva» en el menú. Rellena cuatro pasos: el objetivo, el guion o contexto, los vídeos si los tienes y el modelo de IA. La IA prepara la historia, las escenas, las preguntas y el árbol de decisiones. Después la encontrarás en «Mis simulaciones», donde puedes revisarla y publicarla.",
    link: { to: "/app/new", label: "Crear simulación" },
    video: "/assistant/temas/crear-simulacion-alfa.mp4",
  },
  {
    id: "editar-simulacion",
    question: "¿Cómo reviso y publico una simulación?",
    keywords: ["editar", "editor", "revisar", "revision", "publicar", "publicada", "borrador", "criterios", "cambiar"],
    answer:
      "En «Mis simulaciones» abre la que quieras. Con «Editar simulación» cambias escenas, preguntas y respuestas. En «Criterios de evaluación» ajustas las competencias que se miden. Cuando esté lista, entra en «Revisión», juega el borrador y pulsa publicar. También puedes activar su página pública.",
    link: { to: "/app/simulations", label: "Ir a Mis simulaciones" },
  },
  {
    id: "invitar",
    question: "¿Cómo invito a un candidato?",
    keywords: ["invitar", "invitacion", "candidato", "enlace", "compartir", "alumno", "aspirante"],
    answer:
      "Abre la simulación en «Mis simulaciones» y baja hasta «Invitaciones privadas». Crea una invitación, elige cuántos días dura y cuántos usos permite, y envía el enlace. Cuando la persona termine, verás su informe en las sesiones de esa simulación.",
    link: { to: "/app/simulations", label: "Ir a Mis simulaciones" },
  },
  {
    id: "informes",
    question: "¿Dónde veo los informes y resultados?",
    keywords: ["informe", "informes", "resultado", "resultados", "pdf", "perfil", "competencial", "feedback", "puntuacion"],
    answer:
      "En la simulación, entra en «Sesiones y feedback». Ahí ves a cada persona con sus puntos, estrellas, competencias y tiempo por decisión. Abre una sesión para leer el informe completo, descargarlo en PDF o enviarlo por correo.",
    link: { to: "/app/simulations", label: "Ir a Mis simulaciones" },
  },
  {
    id: "practica-comparar",
    question: "¿Puedo practicar o comparar candidatos?",
    keywords: ["practica", "practicar", "comparar", "comparacion", "competencias", "ranking"],
    answer:
      "Sí. Con «Practicar (no cuenta)» juegas una simulación sin que aparezca en la lista del evaluador. Y en las sesiones de una simulación puedes comparar hasta cinco personas: puntos, estrellas, competencias y tiempo medio por decisión.",
    link: { to: "/app/simulations", label: "Ir a Mis simulaciones" },
  },
  {
    id: "corregir-examenes",
    question: "¿Cómo corrijo exámenes escaneados?",
    keywords: ["corregir", "correccion", "examen", "examenes", "escaneado", "foto", "manuscrito", "nota", "rubrica"],
    answer:
      "Entra en «Evaluaciones». Crea una evaluación con su título, la materia y la puntuación máxima, y revisa la rúbrica. Luego sube las fotos o escaneos de cada examen. La IA lee la letra, propone una nota con sus evidencias y un comentario. Tú revisas y decides la nota final.",
    link: { to: "/app/assessments", label: "Ir a Evaluaciones" },
  },
  {
    id: "examen-online",
    question: "¿Cómo hago un examen online con tiempo?",
    keywords: ["online", "tiempo", "limite", "trampas", "copiar", "integridad", "pantalla", "cronometro"],
    answer:
      "En «Evaluaciones» crea el examen y comparte el enlace con cada aspirante. Puedes poner tiempo límite: al acabarse se entrega solo. La app baraja preguntas y opciones, avisa si sale de la pestaña y marca respuestas muy parecidas. Son indicios para revisar, no pruebas.",
    link: { to: "/app/assessments", label: "Ir a Evaluaciones" },
  },
  {
    id: "banco-preguntas",
    question: "¿Cómo reutilizo preguntas en otro examen?",
    keywords: ["banco", "preguntas", "guardadas", "reutilizar", "reutilizo", "repetir"],
    answer:
      "Las preguntas que guardas van al «Banco de preguntas», dentro de «Evaluaciones». Marca las que quieras y pulsa «Crear evaluación con la selección» para montar un examen nuevo en un momento.",
    link: { to: "/app/assessments/bank", label: "Abrir el banco de preguntas" },
  },
  {
    id: "colaboradores-evaluacion",
    question: "¿Puedo corregir junto a otros profesores?",
    keywords: ["colaboradores", "profesores", "docentes", "companeros", "permisos", "equipo", "tribunal"],
    answer:
      "Sí. Dentro de una evaluación, en «Permisos y colaboradores», añade a otras personas por su correo y elige qué pueden hacer: solo ver, corregir o administrar. Todos trabajan sobre las mismas entregas.",
    link: { to: "/app/assessments", label: "Ir a Evaluaciones" },
  },
  {
    id: "grabacion",
    question: "¿Cómo grabo una sesión?",
    keywords: ["grabar", "grabacion", "camara", "microfono", "sesion", "consentimiento", "terapia", "entrevista"],
    answer:
      "Ve a «Grabaciones» y crea una nueva sesión. Antes de empezar, haz la prueba de cámara, micrófono y conexión. Cada participante acepta el consentimiento y puede descargarlo en PDF. Mientras grabas, la app guarda partes cada pocos minutos para no perder nada.",
    link: { to: "/app/capture", label: "Ir a Grabaciones" },
  },
  {
    id: "analizar-grabacion",
    question: "¿Cómo analizo una grabación?",
    keywords: ["analizar", "analizo", "analisis", "participacion", "conclusiones", "silencios", "interaccion", "grabacion", "voz"],
    answer:
      "Abre la sesión en «Grabaciones». En «Analizar» ves quién habla, cuánto y los silencios del grupo. «Escenas inteligentes» marca los momentos clave y «Conclusiones» resume lo importante. También puedes comparar varias sesiones entre sí.",
    link: { to: "/app/capture", label: "Ir a Grabaciones" },
  },
  {
    id: "claves-ia",
    question: "¿Dónde pongo mis claves de IA?",
    keywords: ["clave", "claves", "api", "key", "ia", "modelo", "proveedor", "openai", "gemini", "ajustes"],
    answer:
      "En «Ajustes», apartado «Proveedor de texto», elige tu proveedor y pega tu clave. Puedes añadir modelos de respaldo por si uno falla. Con el botón «Probar IA y fallback» compruebas que todo responde bien.",
    link: { to: "/app/settings", label: "Ir a Ajustes" },
  },
  {
    id: "probar-ia",
    question: "¿Cómo compruebo que mi IA funciona?",
    keywords: ["probar", "prueba", "fallback", "funciona", "respaldo", "falla"],
    answer:
      "Entra en «Probar IA». La app fuerza un fallo del primer modelo para comprobar que el de respaldo contesta. Verás qué modelo respondió y si hubo algún error con tu clave.",
    link: { to: "/app/ai-test", label: "Abrir Probar IA" },
  },
  {
    id: "movil",
    question: "¿Puedo usarla en el móvil?",
    keywords: ["movil", "telefono", "instalar", "android", "iphone", "app"],
    answer:
      "Sí. Pulsa «App móvil» en el menú y sigue los pasos para instalarla en tu pantalla de inicio. Funciona como una app más, sin pasar por ninguna tienda.",
    link: { to: "/install", label: "Instalar en el móvil" },
  },
  {
    id: "colaborar",
    question: "¿Cómo puedo colaborar en el proyecto?",
    keywords: ["colaborar", "colaborador", "open source", "codigo", "github", "contribuir", "gratis", "precio"],
    answer:
      "Xandralyze es gratis y de código abierto. En «Colaborar» puedes pedir ser colaborador. Cuando el administrador te apruebe, podrás proponer mejoras, y cada cambio se revisa antes de publicarse.",
    link: { to: "/app/contribute", label: "Ir a Colaborar" },
  },
  {
    id: "redes-sociales",
    question: "¿Cómo publico en redes sociales?",
    keywords: ["redes", "sociales", "facebook", "instagram", "linkedin", "youtube", "publicacion", "capitulo"],
    answer:
      "Solo para administradores: en «Admin», apartado «Redes sociales», creas las publicaciones, las programas en el calendario y eliges en qué redes salen. Con «Comprobar publicación» ves si cada red la ha publicado de verdad.",
    link: { to: "/app/admin/social", label: "Ir a Redes sociales" },
  },
  {
    id: "asistente",
    question: "¿Cómo te uso a ti?",
    keywords: ["asistente", "mover", "moverte", "minimizar", "ocultar", "molesta", "silenciar", "hablarte", "usarte"],
    answer:
      "Arrástrame con el ratón o el dedo a donde menos te moleste; recordaré el sitio. Pulsa sobre mí para abrir o cerrar el chat y usa el botón de minimizar para dejarme como una burbuja pequeña. Puedes escribirme, hablarme con el micrófono o quitarme la voz con el altavoz.",
  },
];

/** Temas sugeridos según la pantalla en la que está el usuario. */
const SCREEN_TOPICS: Array<{ prefix: string; ids: string[] }> = [
  { prefix: "/app/new", ids: ["crear-simulacion", "claves-ia", "editar-simulacion"] },
  { prefix: "/app/simulations", ids: ["editar-simulacion", "invitar", "informes", "practica-comparar"] },
  { prefix: "/app/play", ids: ["practica-comparar", "informes"] },
  { prefix: "/app/sessions", ids: ["informes", "practica-comparar"] },
  { prefix: "/app/assessments/bank", ids: ["banco-preguntas", "examen-online"] },
  { prefix: "/app/assessments", ids: ["corregir-examenes", "examen-online", "colaboradores-evaluacion", "banco-preguntas"] },
  { prefix: "/app/capture", ids: ["grabacion", "analizar-grabacion"] },
  { prefix: "/app/settings", ids: ["claves-ia", "probar-ia"] },
  { prefix: "/app/ai-test", ids: ["probar-ia", "claves-ia"] },
  { prefix: "/app/admin/social", ids: ["redes-sociales"] },
  { prefix: "/app/contribute", ids: ["colaborar"] },
];

const DEFAULT_TOPICS = ["crear-simulacion", "corregir-examenes", "grabacion", "claves-ia", "asistente"];

/** Devuelve los temas más útiles para la pantalla actual, seguidos del resto. */
export function topicsForPath(pathname: string): HelpTopic[] {
  const match = SCREEN_TOPICS.find((s) => pathname.startsWith(s.prefix));
  const first = match?.ids ?? DEFAULT_TOPICS;
  const byId = new Map(HELP_TOPICS.map((t) => [t.id, t]));
  const ordered = first.map((id) => byId.get(id)).filter((t): t is HelpTopic => !!t);
  for (const t of HELP_TOPICS) if (!ordered.includes(t)) ordered.push(t);
  return ordered;
}

/** Nombre de la pantalla actual para dar contexto a la IA. */
export function screenName(pathname: string): string {
  const names: Array<[string, string]> = [
    ["/app/dashboard", "Inicio"],
    ["/app/new", "Nueva simulación"],
    ["/app/simulations", "Mis simulaciones"],
    ["/app/play", "Jugando una simulación"],
    ["/app/sessions", "Sesión de una simulación"],
    ["/app/assessments/bank", "Banco de preguntas"],
    ["/app/assessments", "Evaluaciones"],
    ["/app/capture", "Grabaciones"],
    ["/app/settings", "Ajustes"],
    ["/app/ai-test", "Probar IA"],
    ["/app/contribute", "Colaborar"],
    ["/app/admin/social", "Admin · Redes sociales"],
    ["/app/admin", "Admin"],
    ["/install", "App móvil"],
  ];
  return names.find(([p]) => pathname.startsWith(p))?.[1] ?? "Xandralyze";
}

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

/**
 * Decide si una pregunta escrita se contesta con la ayuda local (gratis, al
 * instante) o se pasa a la IA del usuario. Una sola palabra clave en una frase
 * larga suele ser un encargo libre («escríbeme un correo para invitar…»).
 */
export function localAnswerFor(question: string): HelpTopic | null {
  const topic = findHelpTopic(question);
  if (!topic) return null;
  const q = ` ${normalizeText(question)} `;
  const score = topic.keywords.filter((kw) => q.includes(` ${kw} `) || q.includes(` ${kw}s `)).length;
  const words = normalizeText(question).split(" ").filter(Boolean).length;
  return score >= 2 || words <= 6 ? topic : null;
}

/** Texto de ayuda completo para dárselo a la IA como contexto. */
export function helpKnowledge(): string {
  return HELP_TOPICS.map((t) => `- ${t.question} ${t.answer}`).join("\n");
}
