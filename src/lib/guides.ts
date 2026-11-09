export const SITE = "https://xandralyze.com";

export type Guide = {
  slug: string;
  category: string;
  backTo: "/educacion" | "/seleccion" | "/psicologia" | "/open-source";
  backLabel: string;
  title: string;
  h1: string;
  description: string;
  intro: string;
  stepsTitle: string;
  steps: [string, string][];
  tipsTitle: string;
  tips: string[];
  ctaText: string;
  ctaLabel: string;
  ctaHref: string;
};

export const guides: Guide[] = [
  {
    slug: "corregir-examenes-manuscritos-ia",
    category: "Evaluaciones escritas",
    backTo: "/educacion", backLabel: "Educación",
    title: "Cómo corregir exámenes manuscritos con IA paso a paso | Xandralyze",
    h1: "Cómo corregir exámenes manuscritos con IA paso a paso",
    description: "Guía práctica para corregir exámenes escritos a mano con IA: escaneo, lector OCR, rúbrica por competencias, revisión del docente y comentario para el alumno.",
    intro: "Corregir exámenes en papel lleva horas. Con un lector OCR y una rúbrica por competencias, la IA puede proponerte la nota y un comentario por alumno, y tú solo revisas. Así se hace.",
    stepsTitle: "Los 5 pasos",
    steps: [
      ["Escanea o fotografía los exámenes", "Usa buena luz, la hoja entera en el encuadre y sin sombras. Un escáner o una foto nítida del móvil sirven. Si el examen tiene varias páginas, súbelas en orden."],
      ["Deja que el lector OCR transcriba la letra", "La IA convierte la escritura a mano en texto. Revisa la transcripción en las palabras dudosas antes de corregir: una letra mal leída puede cambiar la nota."],
      ["Define la rúbrica por competencias", "Indica los criterios (contenido, argumentación, expresión, ortografía…) y cuántos puntos vale cada uno. Cuanto más concreta sea la rúbrica, más coherente será la corrección."],
      ["Revisa la propuesta de nota", "La IA propone una puntuación por criterio con su justificación y las evidencias del texto. Tú decides: ajusta lo que no compartas. La IA asiste, no sustituye al docente."],
      ["Entrega el comentario al alumno", "Cada examen genera un comentario con puntos fuertes y aspectos a mejorar, listo para compartir, y un informe que puedes guardar."],
    ],
    tipsTitle: "Consejos para una corrección fiable",
    tips: [
      "Corrige primero 2 o 3 exámenes a mano y compara: así compruebas que la rúbrica funciona.",
      "Las faltas de ortografía se detectan solo si la rúbrica las incluye como criterio.",
      "Con letra muy difícil o tachones, revisa siempre la transcripción.",
      "Xandralyze es gratis y de código abierto; la IA usa tu propia clave, y el coste depende del proveedor que elijas.",
    ],
    ctaText: "En la página de educación hay dos exámenes de ejemplo que puedes corregir al momento, sin cuenta.",
    ctaLabel: "Probar la corrección", ctaHref: "/educacion#demo-evaluacion",
  },
  {
    slug: "rubrica-evaluacion-competencias-ia",
    category: "Evaluaciones escritas",
    backTo: "/educacion", backLabel: "Educación",
    title: "Cómo crear una rúbrica de evaluación por competencias con IA | Xandralyze",
    h1: "Cómo crear una rúbrica de evaluación por competencias con IA",
    description: "Aprende a diseñar una rúbrica por competencias con criterios, niveles y pesos, y a usarla con IA para corregir de forma coherente y justificada.",
    intro: "La rúbrica es lo que hace que una corrección con IA sea justa: sin criterios claros, la IA improvisa. Con una buena rúbrica, cada nota queda explicada con evidencias del propio texto.",
    stepsTitle: "Cómo construirla en 5 pasos",
    steps: [
      ["Elige las competencias a evaluar", "Parte del objetivo de la prueba: comprensión, argumentación, uso del vocabulario, expresión escrita, ortografía… Entre 3 y 6 criterios suele ser suficiente."],
      ["Asigna un peso a cada criterio", "Reparte la nota según lo que más importe. Por ejemplo: contenido 40 %, argumentación 30 %, expresión 20 %, ortografía 10 %."],
      ["Describe los niveles de logro", "Para cada criterio, escribe qué significa excelente, adecuado, suficiente e insuficiente. Frases observables («cita al menos dos ejemplos») funcionan mejor que adjetivos («buena explicación»)."],
      ["Pide a la IA la nota con evidencias", "Al corregir, la IA puntúa cada criterio y cita el fragmento del examen que justifica la puntuación. Así puedes comprobar cada decisión."],
      ["Ajusta tras los primeros exámenes", "Revisa 2 o 3 correcciones. Si un criterio da resultados raros, reescribe su descripción y vuelve a corregir."],
    ],
    tipsTitle: "Errores habituales",
    tips: [
      "Criterios que se solapan (por ejemplo «claridad» y «expresión») hacen que se penalice dos veces lo mismo.",
      "Si no incluyes la ortografía como criterio, no contará en la nota.",
      "Guarda la rúbrica y reutilízala: así las notas entre grupos son comparables.",
      "La IA propone; la nota final la decide siempre el docente.",
    ],
    ctaText: "Prueba la corrección con rúbrica sobre dos exámenes de ejemplo, sin registrarte.",
    ctaLabel: "Ver la demostración", ctaHref: "/educacion#demo-evaluacion",
  },
  {
    slug: "simulador-entrevistas-seleccion-ia",
    category: "Selección gamificada",
    backTo: "/seleccion", backLabel: "Selección",
    title: "Cómo crear un simulador de entrevistas y situaciones con IA | Xandralyze",
    h1: "Cómo crear un simulador de entrevistas y situaciones con IA para selección",
    description: "Guía para crear una simulación interactiva en vídeo para procesos de selección: escenas, decisiones ramificadas, puntuación por competencias e informe del candidato.",
    intro: "Una entrevista tradicional mide lo que el candidato dice que haría. Una simulación de situaciones mide lo que decide cuando la escena ocurre. Con IA puedes montar una en minutos.",
    stepsTitle: "Los 5 pasos",
    steps: [
      ["Define el puesto y las competencias", "Describe el puesto (atención al cliente, ventas, mando intermedio…) y elige las competencias clave: empatía, resolución de problemas, comunicación, toma de decisiones."],
      ["Genera la historia y las escenas", "La IA propone una historia realista con escenas en vídeo: un cliente enfadado, un conflicto en el equipo, una urgencia. Revisa y ajusta el guion a tu empresa."],
      ["Crea el árbol de decisiones", "Tras cada escena el candidato elige qué hacer. Cada respuesta lleva a una escena distinta y suma o resta en las competencias que definiste."],
      ["Envía la simulación al candidato", "Comparte un enlace. El candidato la juega desde el móvil o el ordenador, sin instalar nada, y puede responder también de viva voz."],
      ["Revisa el informe competencial", "Al terminar obtienes la puntuación por competencia, las decisiones tomadas y la justificación de la IA. Úsalo como apoyo a la entrevista, no como decisión automática."],
    ],
    tipsTitle: "Consejos para que sea útil",
    tips: [
      "Usa situaciones que de verdad ocurren en el puesto: el candidato lo nota y responde con más naturalidad.",
      "Evita respuestas obviamente correctas: las mejores opciones tienen ventajas e inconvenientes.",
      "Informa al candidato de cómo se evalúa y pide su consentimiento si graba vídeo o voz.",
      "La decisión de contratación es siempre de una persona; la IA aporta evidencias.",
    ],
    ctaText: "Juega una simulación de ejemplo de atención hotelera, sin crear cuenta.",
    ctaLabel: "Probar la simulación", ctaHref: "/seleccion#demo",
  },
  {
    slug: "generador-examenes-ia-gratis",
    category: "Evaluaciones escritas",
    backTo: "/educacion", backLabel: "Educación",
    title: "Generador de exámenes con IA gratis: crea preguntas en minutos | Xandralyze",
    h1: "Cómo crear exámenes con un generador de preguntas con IA gratis",
    description: "Genera preguntas de examen con IA a partir de tu temario, guárdalas en un banco reutilizable por materia y etiquetas, y monta exámenes en minutos. Gratis y open source.",
    intro: "Preparar un examen desde cero lleva tiempo. Con un generador de preguntas con IA partes de tu propio temario, revisas lo que propone y guardas las buenas en un banco para reutilizarlas curso tras curso.",
    stepsTitle: "Los 5 pasos",
    steps: [
      ["Elige materia y área", "Indica la materia y el área del examen. Así las preguntas quedan clasificadas en el banco y luego las encuentras rápido."],
      ["Pega tu temario o texto base", "Opcionalmente añade el tema, unos apuntes o una lectura. La IA generará preguntas ajustadas a ese contenido en lugar de preguntas genéricas."],
      ["Escribe el encargo y el tipo de preguntas", "Explica qué quieres (por ejemplo, «preguntas de comprensión para 3.º de ESO») y marca los tipos de pregunta que necesitas y cuántas."],
      ["Revisa y guarda en el banco", "Lee cada pregunta antes de guardarla. Corrige lo que no encaje y añade etiquetas para reutilizarlas en otros exámenes."],
      ["Monta el examen", "Elige preguntas del banco, añade la rúbrica y comparte el examen por enlace (con tiempo límite, pantalla completa y registro antitrampas) o corrígelo en papel."],
    ],
    tipsTitle: "Consejos",
    tips: [
      "Cuanto más concreto sea el temario que aportas, más ajustadas serán las preguntas.",
      "Revisa siempre las respuestas correctas propuestas: la IA puede equivocarse.",
      "Usa etiquetas por unidad o trimestre para construir exámenes de recuperación en segundos.",
      "Es gratis; la IA funciona con tu propia clave de Google Gemini u OpenAI.",
    ],
    ctaText: "Mira cómo se corrige un examen con rúbrica en la demostración, sin registrarte.",
    ctaLabel: "Ver la demostración", ctaHref: "/educacion#demo-evaluacion",
  },
  {
    slug: "lector-ocr-examenes-escaneados",
    category: "Evaluaciones escritas",
    backTo: "/educacion", backLabel: "Educación",
    title: "Lector OCR de exámenes escaneados: de la letra a mano al texto | Xandralyze",
    h1: "Lector OCR para exámenes escaneados: cómo pasar la letra a mano a texto",
    description: "Cómo funciona un lector OCR con IA para exámenes escaneados o fotografiados: calidad de imagen, niveles de confianza, relectura y revisión antes de corregir.",
    intro: "Antes de corregir un examen manuscrito con IA hay que leerlo. El lector OCR convierte la letra a mano en texto, y de esa lectura depende que la nota sea justa.",
    stepsTitle: "Cómo obtener una buena lectura",
    steps: [
      ["Captura bien la página", "Foto o escaneo con luz uniforme, la hoja entera, recta y sin sombras. Evita el flash directo, que quema la tinta."],
      ["Sube todas las páginas en orden", "Si el examen ocupa varias hojas, súbelas en el orden correcto para que la transcripción sea continua."],
      ["Revisa los niveles de confianza", "La transcripción se divide en fragmentos con su nivel de confianza. Mira primero los de confianza baja: ahí suelen estar las palabras mal leídas."],
      ["Relee si hace falta", "Si una página sale mal (borrosa, girada), vuelve a lanzar la lectura o sube una imagen mejor antes de corregir."],
      ["Corrige con el texto ya revisado", "Con la transcripción revisada, la IA aplica la rúbrica y propone la nota con evidencias del propio texto."],
    ],
    tipsTitle: "Problemas habituales",
    tips: [
      "Tachones y flechas confunden al lector: revísalos a mano.",
      "El lápiz muy claro se lee peor que el bolígrafo; aumenta el contraste al escanear.",
      "Fórmulas y dibujos pueden transcribirse de forma incompleta; compruébalos.",
      "Las faltas de ortografía del alumno se conservan en la transcripción para poder evaluarlas.",
    ],
    ctaText: "Prueba la corrección de dos exámenes manuscritos de ejemplo, sin cuenta.",
    ctaLabel: "Probar la corrección", ctaHref: "/educacion#demo-evaluacion",
  },
  {
    slug: "examen-online-tiempo-limite",
    category: "Evaluaciones escritas",
    backTo: "/educacion", backLabel: "Educación",
    title: "Examen online con tiempo límite y antitrampas: guía de auditoría | Xandralyze",
    h1: "Cómo hacer un examen online con tiempo límite, antitrampas y auditoría",
    description: "Crea un examen online con tiempo límite, orden aleatorio, foto de identidad, pantalla completa, bloqueo de copiar y pegar, ritmo de escritura y detección de respuestas copiadas.",
    intro: "Un examen online con tiempo límite iguala las condiciones para todos. Si además registra cuándo el aspirante sale de la pestaña o intenta pegar texto, tienes evidencias para revisar cada entrega con criterio.",
    stepsTitle: "Los 8 pasos",
    steps: [
      ["Prepara las preguntas", "Escríbelas o tómalas del banco de preguntas. Añade la rúbrica con la que se corregirá. Cada aspirante verá las preguntas y las opciones en un orden distinto, siempre el mismo para él aunque recargue."],
      ["Fija el tiempo total", "Indica los minutos disponibles. El participante lo ve antes de empezar, junto con las normas del examen."],
      ["Envía un enlace personal", "Cada persona recibe su propio enlace. El examen no se abre, ni arranca el tiempo, hasta que pulsa «Comenzar examen»."],
      ["Foto de identidad", "Antes de empezar, el aspirante se hace una foto con la cámara. Si se niega o no tiene cámara puede continuar, y queda anotado. Tú ves la foto en su historial."],
      ["El examen se abre en pantalla completa", "Al comenzar se activa la pantalla completa. Copiar, cortar, pegar, arrastrar texto y el menú del botón derecho quedan bloqueados, y cada intento se anota."],
      ["Cuenta atrás, avisos y entrega automática", "Se muestra el tiempo restante. Si el aspirante sale de la pestaña, cambia de ventana o abandona la pantalla completa, ve un aviso y queda registrado cuántas veces y cuántos segundos estuvo fuera. También se mide el ritmo de escritura: se anotan los bloques de 40 caracteres o más que aparecen de golpe y la escritura de más de 500 caracteres por minuto. Al agotarse el tiempo, las respuestas se entregan solas."],
      ["Revisa el informe antitrampas", "En la lista de aspirantes cada entrega muestra «Sin incidencias», «Revisar» o «Riesgo alto», con el detalle de salidas, segundos fuera, pegados bloqueados y salidas de pantalla completa, además de la IP, el navegador y la hora de cada evento."],
      ["Busca respuestas parecidas", "En «Respuestas parecidas» se comparan todas las entregas: si dos aspirantes responden casi igual a la misma pregunta, aparecen juntos con el porcentaje de coincidencia."],
    ],
    tipsTitle: "Cómo interpretar el informe",
    tips: [
      "Una salida corta no prueba que se haya copiado: puede ser una notificación. Úsalo como indicio y revisa la respuesta.",
      "«Riesgo alto» aparece con 5 o más incidencias o con 2 minutos o más fuera del examen. Cada bloque de texto de golpe cuenta como incidencia.",
      "Un bloque de texto de golpe puede venir del dictado por voz o del autocompletado del móvil; compruébalo antes de sacar conclusiones.",
      "La comparación de respuestas solo tiene en cuenta respuestas de 8 palabras o más, para no marcar respuestas cortas que coinciden por fuerza.",
      "En iPhone el navegador no permite la pantalla completa; el resto de controles sigue funcionando.",
      "Avisa de las normas antes del examen: el aspirante las ve en la pantalla de inicio.",
      "Para selección de personal, usa el mismo examen y tiempo para todos y así los resultados serán comparables.",
    ],
    ctaText: "Prueba primero la corrección con rúbrica en la demostración, sin registrarte.",
    ctaLabel: "Ver la demostración", ctaHref: "/educacion#demo-evaluacion",
  },
  {
    slug: "video-interactivo-gamificado-educacion",
    category: "Simulaciones y vídeo interactivo",
    backTo: "/educacion", backLabel: "Educación",
    title: "Vídeo interactivo gamificado para educación: cómo crearlo gratis | Xandralyze",
    h1: "Cómo crear un vídeo interactivo gamificado para educación",
    description: "Convierte una historia en vídeo en una actividad gamificada: escenas, preguntas tras cada clip, decisiones ramificadas, estrellas, puntuación e informe por alumno.",
    intro: "Un vídeo que solo se mira se olvida. Si tras cada escena el alumno tiene que decidir o responder, y gana estrellas por ello, el vídeo pasa a ser una actividad que se aprende jugando.",
    stepsTitle: "Los 5 pasos",
    steps: [
      ["Elige el objetivo de aprendizaje", "Decide qué debe saber o saber hacer el alumno al terminar: un concepto, un procedimiento, una actitud ante un conflicto."],
      ["Genera la historia con IA", "Describe el tema y el nivel. La IA propone una historia dividida en escenas, con personajes y situaciones adaptadas a tus alumnos."],
      ["Añade preguntas tras cada escena", "Después de cada clip aparece una pregunta o decisión. Cada respuesta suma puntos y puede llevar a una escena distinta."],
      ["Comparte la actividad", "Los alumnos la juegan desde el móvil o el ordenador con un enlace, sin instalar nada."],
      ["Consulta el informe", "Al final ves la puntuación, las estrellas y las decisiones de cada alumno, y un perfil por competencias."],
    ],
    tipsTitle: "Ideas para el aula",
    tips: [
      "Escenas cortas (menos de un minuto) mantienen la atención.",
      "Las decisiones con consecuencias visibles enseñan más que las preguntas de tipo test.",
      "Úsalo para convivencia, orientación laboral, idiomas o prácticas de FP.",
    ],
    ctaText: "Juega una simulación interactiva de ejemplo, sin crear cuenta.",
    ctaLabel: "Probar la simulación", ctaHref: "/#demo",
  },
  {
    slug: "herramientas-ia-open-source-educacion",
    category: "Código abierto",
    backTo: "/open-source", backLabel: "Código abierto",
    title: "Herramientas de IA open source para educación con tu propia API | Xandralyze",
    h1: "Herramientas de IA open source para educación: usa tu propia clave de API",
    description: "Qué ventajas tiene una herramienta de IA de código abierto para docentes y centros, cómo funciona el modelo «trae tu propia API» y cómo colaborar en el proyecto.",
    intro: "Muchas herramientas de IA para educación cobran una suscripción y guardan los datos en servidores que no controlas. Una alternativa es usar software de código abierto con tu propia clave de IA.",
    stepsTitle: "Cómo empezar en 5 pasos",
    steps: [
      ["Crea una cuenta gratis", "Xandralyze es gratuito y su código está publicado con licencia AGPL-3.0."],
      ["Consigue tu clave de IA", "Crea una clave en Google Gemini u OpenAI. Pagas directamente al proveedor solo lo que uses, sin intermediarios."],
      ["Añádela en Ajustes", "Pega la clave y elige el proveedor de texto. Puedes probarla en la pantalla «Probar IA» antes de usarla."],
      ["Usa las herramientas", "Corrige exámenes manuscritos, genera preguntas, crea simulaciones en vídeo y revisa los informes."],
      ["Colabora si quieres", "Puedes solicitar ser colaborador y proponer mejoras; cada cambio lo aprueba el administrador del proyecto."],
    ],
    tipsTitle: "Por qué código abierto",
    tips: [
      "Puedes revisar cómo se tratan los datos: el código es público en GitHub.",
      "El coste depende de tu uso real con el proveedor, no de una cuota fija.",
      "Un centro puede instalarlo en su propio servidor.",
    ],
    ctaText: "Conoce cómo participar en el proyecto.",
    ctaLabel: "Ver el programa de colaboradores", ctaHref: "/open-source",
  },
];

export const guideUrl = (slug: string) => `${SITE}/guia/${slug}`;

export function guideHead(slug: string) {
  const g = guides.find((x) => x.slug === slug)!;
  const url = guideUrl(slug);
  return {
    meta: [
      { title: g.title }, { name: "description", content: g.description },
      { property: "og:title", content: g.title }, { property: "og:description", content: g.description },
      { property: "og:type", content: "article" }, { property: "og:url", content: url },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: url }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify([
        {
          "@context": "https://schema.org", "@type": "HowTo", name: g.h1, description: g.description, inLanguage: "es",
          step: g.steps.map(([name, text], i) => ({ "@type": "HowToStep", position: i + 1, name, text })),
        },
        {
          "@context": "https://schema.org", "@type": "Article", headline: g.h1, description: g.description, inLanguage: "es",
          mainEntityOfPage: url, author: { "@type": "Organization", name: "Xandralyze", url: SITE },
          publisher: { "@type": "Organization", name: "Xandralyze", url: SITE },
        },
        {
          "@context": "https://schema.org", "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Inicio", item: `${SITE}/` },
            { "@type": "ListItem", position: 2, name: "Guías", item: `${SITE}/guia` },
            { "@type": "ListItem", position: 3, name: g.h1, item: url },
          ],
        },
      ]),
    }],
  };
}
