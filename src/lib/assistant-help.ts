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
  /** Pasos detallados que se muestran por escrito (no se leen en voz alta). */
  details?: string[];
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
    details: [
      "Pulsa «Nueva» en el menú lateral.",
      "Objetivo: escribe qué quieres evaluar o enseñar (por ejemplo, atención al cliente ante una queja) y para quién es.",
      "Guion o contexto: pega tu historia o deja que la IA la invente a partir del objetivo. Cuanto más concreto, mejor.",
      "Vídeos: si tienes grabaciones, súbelas; si no, la simulación funciona con escenas de texto e imágenes.",
      "Modelo de IA: elige el de tu clave en «Ajustes». Si falla, se usa el de respaldo.",
      "Pulsa generar y espera un momento: la IA crea escenas, preguntas, respuestas y el árbol de decisiones.",
      "Ábrela en «Mis simulaciones» para revisarla antes de publicarla.",
    ],
  },
  {
    id: "editar-simulacion",
    question: "¿Cómo reviso y publico una simulación?",
    keywords: ["editar", "editor", "revisar", "revision", "publicar", "publicada", "borrador", "criterios", "cambiar"],
    answer:
      "En «Mis simulaciones» abre la que quieras. Con «Editar simulación» cambias escenas, preguntas y respuestas. En «Criterios de evaluación» ajustas las competencias que se miden. Cuando esté lista, entra en «Revisión», juega el borrador y pulsa publicar. También puedes activar su página pública.",
    link: { to: "/app/simulations", label: "Ir a Mis simulaciones" },
    details: [
      "Abre «Mis simulaciones» y pulsa la simulación.",
      "«Editar simulación»: cambia el texto de cada escena, las preguntas, las respuestas y a qué escena lleva cada una.",
      "«Criterios de evaluación»: añade, quita o da más peso a las competencias.",
      "«Revisión»: juega el borrador como lo haría un candidato y comprueba que todos los caminos tienen final.",
      "Pulsa «Publicar». Solo las publicadas pueden recibir candidatos.",
      "Opcional: activa la página pública para compartirla con un enlace abierto.",
    ],
  },
  {
    id: "invitar",
    question: "¿Cómo invito a un candidato?",
    keywords: ["invitar", "invitacion", "candidato", "enlace", "compartir", "alumno", "aspirante"],
    answer:
      "Abre la simulación en «Mis simulaciones» y baja hasta «Invitaciones privadas». Crea una invitación, elige cuántos días dura y cuántos usos permite, y envía el enlace. Cuando la persona termine, verás su informe en las sesiones de esa simulación.",
    link: { to: "/app/simulations", label: "Ir a Mis simulaciones" },
    details: [
      "Abre la simulación publicada en «Mis simulaciones».",
      "Baja hasta «Invitaciones privadas» y pulsa crear invitación.",
      "Elige cuántos días será válida y cuántas veces se puede usar.",
      "Copia el enlace y envíalo por correo, WhatsApp o como prefieras.",
      "El candidato no necesita crear cuenta: abre el enlace y empieza.",
      "Cuando termine, su resultado aparece en «Sesiones y feedback».",
    ],
  },
  {
    id: "informes",
    question: "¿Dónde veo los informes y resultados?",
    keywords: ["informe", "informes", "resultado", "resultados", "pdf", "perfil", "competencial", "feedback", "puntuacion"],
    answer:
      "En la simulación, entra en «Sesiones y feedback». Ahí ves a cada persona con sus puntos, estrellas, competencias y tiempo por decisión. Abre una sesión para leer el informe completo, descargarlo en PDF o enviarlo por correo.",
    link: { to: "/app/simulations", label: "Ir a Mis simulaciones" },
    details: [
      "Abre la simulación y entra en «Sesiones y feedback».",
      "Verás cada persona con puntos, estrellas, competencias y tiempo por decisión.",
      "Pulsa una sesión para ver el informe completo: decisiones tomadas, perfil competencial y recomendaciones.",
      "Usa «Descargar PDF» para guardarlo o «Enviar por correo» para mandárselo.",
    ],
  },
  {
    id: "practica-comparar",
    question: "¿Puedo practicar o comparar candidatos?",
    keywords: ["practica", "practicar", "comparar", "comparacion", "competencias", "ranking"],
    answer:
      "Sí. Con «Practicar (no cuenta)» juegas una simulación sin que aparezca en la lista del evaluador. Y en las sesiones de una simulación puedes comparar hasta cinco personas: puntos, estrellas, competencias y tiempo medio por decisión.",
    link: { to: "/app/simulations", label: "Ir a Mis simulaciones" },
    details: [
      "Para practicar: en la simulación pulsa «Practicar (no cuenta)». Esa partida no aparece en la lista del evaluador.",
      "Para comparar: en «Sesiones y feedback» marca hasta cinco personas.",
      "Pulsa comparar y verás una tabla con puntos, estrellas, competencias y tiempo medio por decisión.",
      "El mejor valor de cada fila aparece destacado.",
    ],
  },
  {
    id: "corregir-examenes",
    question: "¿Cómo corrijo exámenes escaneados?",
    keywords: ["corregir", "correccion", "examen", "examenes", "escaneado", "foto", "manuscrito", "nota", "rubrica"],
    answer:
      "Entra en «Evaluaciones». Crea una evaluación con su título, la materia y la puntuación máxima, y revisa la rúbrica. Luego sube las fotos o escaneos de cada examen. La IA lee la letra, propone una nota con sus evidencias y un comentario. Tú revisas y decides la nota final.",
    link: { to: "/app/assessments", label: "Ir a Evaluaciones" },
    details: [
      "Entra en «Evaluaciones» y pulsa crear evaluación.",
      "Pon título, materia, curso y puntuación máxima.",
      "Revisa la rúbrica que propone la IA y ajusta criterios y puntos.",
      "Sube las fotos o escaneos de cada examen (una o varias páginas por alumno).",
      "La IA lee la letra, propone nota con evidencias por criterio y un comentario.",
      "Revisa cada entrega, cambia lo que no te convenza y guarda la nota final.",
      "Descarga el informe en PDF si lo necesitas.",
    ],
  },
  {
    id: "examen-online",
    question: "¿Cómo hago un examen online con tiempo?",
    keywords: ["online", "tiempo", "limite", "trampas", "copiar", "integridad", "pantalla", "cronometro"],
    answer:
      "En «Evaluaciones» crea el examen y comparte el enlace con cada aspirante. Puedes poner tiempo límite: al acabarse se entrega solo. La app baraja preguntas y opciones, avisa si sale de la pestaña y marca respuestas muy parecidas. Son indicios para revisar, no pruebas.",
    link: { to: "/app/assessments", label: "Ir a Evaluaciones" },
    details: [
      "En «Evaluaciones» crea el examen con sus preguntas (o genéralas con la IA).",
      "Activa el tiempo límite si quieres: al acabarse, se entrega solo.",
      "Opcional: pide foto de identidad al empezar.",
      "Comparte el enlace con cada aspirante.",
      "Durante el examen: preguntas y opciones barajadas, pantalla completa y bloqueo de copiar y pegar.",
      "Al revisar: verás salidas de pestaña, tiempo fuera, ritmo de escritura y respuestas parecidas entre aspirantes.",
      "Recuerda: son indicios para revisar, no pruebas.",
    ],
  },
  {
    id: "banco-preguntas",
    question: "¿Cómo reutilizo preguntas en otro examen?",
    keywords: ["banco", "preguntas", "guardadas", "reutilizar", "reutilizo", "repetir"],
    answer:
      "Las preguntas que guardas van al «Banco de preguntas», dentro de «Evaluaciones». Marca las que quieras y pulsa «Crear evaluación con la selección» para montar un examen nuevo en un momento.",
    link: { to: "/app/assessments/bank", label: "Abrir el banco de preguntas" },
    details: [
      "Al crear o revisar un examen, guarda las preguntas que te gusten en el banco.",
      "Entra en «Evaluaciones» › «Banco de preguntas».",
      "Busca o filtra y marca las que quieras.",
      "Pulsa «Crear evaluación con la selección»; luego ajusta título y tiempo.",
    ],
  },
  {
    id: "colaboradores-evaluacion",
    question: "¿Puedo corregir junto a otros profesores?",
    keywords: ["colaboradores", "profesores", "docentes", "companeros", "permisos", "equipo", "tribunal"],
    answer:
      "Sí. Dentro de una evaluación, en «Permisos y colaboradores», añade a otras personas por su correo y elige qué pueden hacer: solo ver, corregir o administrar. Todos trabajan sobre las mismas entregas.",
    link: { to: "/app/assessments", label: "Ir a Evaluaciones" },
    details: [
      "Abre la evaluación y entra en «Permisos y colaboradores».",
      "Escribe el correo de la otra persona (debe tener cuenta).",
      "Elige su permiso: ver, corregir o administrar.",
      "Guarda: verá la evaluación en su lista y podrá trabajar sobre las mismas entregas.",
      "Puedes cambiar o quitar el permiso cuando quieras.",
    ],
  },
  {
    id: "grabacion",
    question: "¿Cómo grabo una sesión?",
    keywords: ["grabar", "grabacion", "camara", "microfono", "sesion", "consentimiento", "terapia", "entrevista"],
    answer:
      "Ve a «Grabaciones» y crea una nueva sesión. Antes de empezar, haz la prueba de cámara, micrófono y conexión. Cada participante acepta el consentimiento y puede descargarlo en PDF. Mientras grabas, la app guarda partes cada pocos minutos para no perder nada.",
    link: { to: "/app/capture", label: "Ir a Grabaciones" },
    details: [
      "Ve a «Grabaciones» y pulsa nueva sesión.",
      "Ponle nombre y elige el tipo (entrevista, terapia, dinámica de grupo…).",
      "Haz la prueba previa de cámara, micrófono y conexión.",
      "Cada participante acepta el consentimiento; puede descargar su recibo en PDF.",
      "Pulsa grabar. Cada pocos minutos se sube una parte, así no se pierde nada si se corta.",
      "Al terminar, la sesión aparece en la lista con todas sus partes juntas.",
    ],
  },
  {
    id: "analizar-grabacion",
    question: "¿Cómo analizo una grabación?",
    keywords: ["analizar", "analizo", "analisis", "participacion", "conclusiones", "silencios", "interaccion", "grabacion", "voz"],
    answer:
      "Abre la sesión en «Grabaciones». En «Analizar» ves quién habla, cuánto y los silencios del grupo. «Escenas inteligentes» marca los momentos clave y «Conclusiones» resume lo importante. También puedes comparar varias sesiones entre sí.",
    link: { to: "/app/capture", label: "Ir a Grabaciones" },
    details: [
      "Abre la sesión en «Grabaciones».",
      "«Analizar»: quién habla, cuánto tiempo y los silencios del grupo.",
      "«Escenas inteligentes»: los momentos clave marcados en la línea de tiempo.",
      "«Conclusiones»: resumen con lo más importante.",
      "Marca varias sesiones para compararlas entre sí.",
    ],
  },
  {
    id: "claves-ia",
    question: "¿Dónde pongo mis claves de IA?",
    keywords: ["clave", "claves", "api", "key", "ia", "modelo", "proveedor", "openai", "gemini", "ajustes"],
    answer:
      "En «Ajustes», apartado «Proveedor de texto», elige tu proveedor y pega tu clave. Puedes añadir modelos de respaldo por si uno falla. Con el botón «Probar IA y fallback» compruebas que todo responde bien.",
    link: { to: "/app/settings", label: "Ir a Ajustes" },
    details: [
      "Entra en «Ajustes».",
      "En «Proveedor de texto» elige tu proveedor (OpenAI, Gemini…) y pega tu clave.",
      "Elige el modelo principal y añade modelos de respaldo.",
      "Para voz natural, pega también tu clave de OpenAI o ElevenLabs.",
      "Guarda y pulsa «Probar IA y fallback».",
    ],
  },
  {
    id: "probar-ia",
    question: "¿Cómo compruebo que mi IA funciona?",
    keywords: ["probar", "prueba", "fallback", "funciona", "respaldo", "falla"],
    answer:
      "Entra en «Probar IA». La app fuerza un fallo del primer modelo para comprobar que el de respaldo contesta. Verás qué modelo respondió y si hubo algún error con tu clave.",
    link: { to: "/app/ai-test", label: "Abrir Probar IA" },
    details: [
      "Entra en «Probar IA».",
      "Pulsa probar: la app hace fallar el primer modelo a propósito.",
      "Comprueba que el modelo de respaldo contesta.",
      "Si sale un error, revisa la clave en «Ajustes»: suele ser una clave caducada o sin saldo.",
    ],
  },
  {
    id: "movil",
    question: "¿Puedo usarla en el móvil?",
    keywords: ["movil", "telefono", "instalar", "android", "iphone", "app"],
    answer:
      "Sí. Pulsa «App móvil» en el menú y sigue los pasos para instalarla en tu pantalla de inicio. Funciona como una app más, sin pasar por ninguna tienda.",
    link: { to: "/install", label: "Instalar en el móvil" },
    details: [
      "Pulsa «App móvil» en el menú.",
      "iPhone: abre la web en Safari, pulsa compartir y «Añadir a pantalla de inicio».",
      "Android: en Chrome pulsa «Instalar app» o el menú › «Añadir a pantalla de inicio».",
      "Se abrirá como una app más, sin pasar por la tienda.",
    ],
  },
  {
    id: "colaborar",
    question: "¿Cómo puedo colaborar en el proyecto?",
    keywords: ["colaborar", "colaborador", "open source", "codigo", "github", "contribuir", "gratis", "precio"],
    answer:
      "Xandralyze es gratis y de código abierto. En «Colaborar» puedes pedir ser colaborador. Cuando el administrador te apruebe, podrás proponer mejoras, y cada cambio se revisa antes de publicarse.",
    link: { to: "/app/contribute", label: "Ir a Colaborar" },
    details: [
      "Entra en «Colaborar» y envía tu solicitud.",
      "El administrador la revisa y, si la aprueba, recibes el rol de colaborador.",
      "Desde entonces puedes enviar propuestas de mejora.",
      "Cada propuesta se revisa antes de publicarse. El código está en GitHub.",
    ],
  },
  {
    id: "asistente",
    question: "¿Cómo te uso a ti?",
    keywords: ["asistente", "mover", "moverte", "minimizar", "ocultar", "molesta", "silenciar", "hablarte", "usarte"],
    answer:
      "Arrástrame con el ratón o el dedo a donde menos te moleste; recordaré el sitio. Pulsa sobre mí para abrir o cerrar el chat y usa el botón de minimizar para dejarme como una burbuja pequeña. Puedes escribirme, hablarme con el micrófono o quitarme la voz con el altavoz.",
    details: [
      "Moverme: arrástrame a cualquier sitio; recordaré dónde me dejaste.",
      "Minimizarme: pulsa «–» y quedaré como una burbuja.",
      "Abrir o cerrar el chat: pulsa sobre mí.",
      "Hablarme: pulsa el micrófono, habla y vuelve a pulsarlo para enviar.",
      "Quitar la voz: pulsa el altavoz.",
    ],
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
