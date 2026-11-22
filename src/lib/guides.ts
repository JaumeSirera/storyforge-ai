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
  /** Optional in-depth sections rendered before the steps. */
  sections?: GuideSection[];
  /** Optional visible questions and answers rendered after the tips. */
  faq?: [string, string][];
};

export type GuideSection = {
  h2: string;
  paragraphs?: string[];
  list?: string[];
  table?: { caption: string; head: string[]; rows: string[][] };
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
      ["Escanea o fotografía los exámenes", "Usa buena luz, la hoja entera en el encuadre y sin sombras. Un escáner, una foto nítida del móvil o un PDF sirven. Si el examen tiene varias páginas, súbelas en orden."],
      ["Deja que el lector OCR transcriba la letra", "La IA convierte la escritura a mano en texto. Revisa la transcripción en las palabras dudosas antes de corregir: una letra mal leída puede cambiar la nota."],
      ["Define la rúbrica por competencias", "Indica los criterios (contenido, argumentación, expresión, ortografía…) y cuántos puntos vale cada uno. Cuanto más concreta sea la rúbrica, más coherente será la corrección."],
      ["Revisa la propuesta de nota", "La IA propone una puntuación por criterio con su justificación y las evidencias del texto. Tú decides: ajusta lo que no compartas. La IA asiste, no sustituye al docente."],
      ["Entrega el comentario y exporta las notas", "Cada examen genera un comentario con puntos fuertes y aspectos a mejorar y un informe en PDF. Con «Exportar notas» descargas una hoja con las notas de toda la clase, la nota sobre 10 y los puntos de cada pregunta, que abre Excel, LibreOffice o Google Sheets."],
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
    sections: [{
      h2: "Preguntas orales que se corrigen solas",
      paragraphs: [
        "Además de desarrollo, test, verdadero/falso y numéricas, puedes poner preguntas de tipo «Oral». El aspirante pulsa «Responder hablando» y contesta en voz alta; el navegador convierte su voz en texto mientras habla y no puede teclear la respuesta.",
        "Al entregar, la IA corrige esas respuestas con tu rúbrica igual que las escritas, pero sin tener en cuenta las faltas de ortografía o de puntuación del dictado. Se guarda el texto, no el audio. Funciona en Chrome, Edge y Safari; en otros navegadores el aspirante tiene que escribirla y la entrega indica que la escribió.",
      ],
    }],
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
  {
    slug: "rubrica-de-evaluacion-ejemplos",
    category: "Evaluaciones escritas",
    backTo: "/educacion", backLabel: "Educación",
    title: "Rúbrica de evaluación: qué es, tipos y 3 ejemplos listos para usar | Xandralyze",
    h1: "Rúbrica de evaluación: qué es, tipos y 3 ejemplos listos para usar",
    description: "Qué es una rúbrica de evaluación, tipos (analítica y holística), cómo hacerla paso a paso y 3 ejemplos completos: redacción, exposición oral y trabajo en equipo.",
    intro: "Una rúbrica de evaluación es una tabla que dice, antes de corregir, qué se va a valorar y qué hace falta para cada nota. Sirve para que la corrección sea justa, para que el alumnado sepa qué se espera de él y para que dos docentes pongan notas parecidas al mismo trabajo. Aquí tienes cómo hacerla y tres ejemplos que puedes copiar.",
    sections: [
      {
        h2: "Qué es una rúbrica de evaluación",
        paragraphs: [
          "Es una matriz con dos ejes: en las filas, los criterios que vas a valorar (por ejemplo contenido, organización o expresión); en las columnas, los niveles de logro (por ejemplo excelente, notable, suficiente e insuficiente). En cada casilla se describe qué se observa en un trabajo de ese nivel.",
          "La clave está en las descripciones: deben ser observables. «Usa al menos dos ejemplos para defender su idea» se puede comprobar; «buena argumentación» no.",
        ],
      },
      {
        h2: "Tipos de rúbrica",
        table: {
          caption: "Rúbrica analítica frente a holística",
          head: ["", "Analítica", "Holística"],
          rows: [
            ["Cómo es", "Puntúa cada criterio por separado", "Da una única valoración global"],
            ["Ventaja", "Explica de dónde sale la nota y qué mejorar", "Es rápida de aplicar"],
            ["Inconveniente", "Lleva más tiempo prepararla", "Da poca información al alumno"],
            ["Cuándo usarla", "Exámenes, trabajos y proyectos con nota", "Pruebas cortas o diagnósticas"],
          ],
        },
        paragraphs: ["Para corregir con IA conviene la analítica: cada criterio se puntúa por separado y la nota queda justificada con frases del propio trabajo."],
      },
      {
        h2: "Ejemplo 1: rúbrica de redacción o examen de desarrollo",
        table: {
          caption: "Rúbrica de redacción (sobre 10 puntos)",
          head: ["Criterio (peso)", "Excelente", "Adecuado", "Suficiente", "Insuficiente"],
          rows: [
            ["Contenido (40 %)", "Responde a todo lo pedido con datos correctos y ejemplos propios", "Responde a casi todo con algún dato impreciso", "Responde a lo básico sin ejemplos", "No responde a lo pedido o hay errores graves"],
            ["Organización (25 %)", "Introducción, desarrollo y conclusión claros y enlazados", "Estructura clara con algún salto", "Estructura reconocible pero desordenada", "Ideas sueltas sin orden"],
            ["Argumentación (20 %)", "Justifica cada idea con razones o ejemplos", "Justifica la mayoría de ideas", "Justifica alguna idea", "Afirma sin justificar"],
            ["Expresión y ortografía (15 %)", "Vocabulario preciso y sin faltas", "Vocabulario adecuado, 1 o 2 faltas", "Vocabulario sencillo, 3 a 5 faltas", "Frases confusas o más de 5 faltas"],
          ],
        },
      },
      {
        h2: "Ejemplo 2: rúbrica de exposición oral",
        table: {
          caption: "Rúbrica de exposición oral",
          head: ["Criterio", "4 · Excelente", "3 · Notable", "2 · Suficiente", "1 · Insuficiente"],
          rows: [
            ["Dominio del tema", "Explica sin leer y responde a las preguntas", "Explica con apoyo puntual de notas", "Lee buena parte de la exposición", "Lee todo o no domina el tema"],
            ["Claridad", "Se entiende todo a la primera", "Se entiende casi todo", "Hay partes confusas", "Cuesta seguir la exposición"],
            ["Apoyo visual", "Diapositivas claras que ayudan a entender", "Diapositivas correctas con mucho texto", "Diapositivas poco relacionadas", "Sin apoyo o lo dificulta"],
            ["Tiempo", "Se ajusta al tiempo indicado", "Se desvía menos de un minuto", "Se desvía entre 1 y 3 minutos", "Se desvía más de 3 minutos"],
          ],
        },
      },
      {
        h2: "Ejemplo 3: rúbrica de trabajo en equipo",
        table: {
          caption: "Rúbrica de trabajo en equipo",
          head: ["Criterio", "4", "3", "2", "1"],
          rows: [
            ["Participación", "Aporta ideas y tareas en todas las sesiones", "Aporta en casi todas", "Aporta cuando se le pide", "Apenas participa"],
            ["Responsabilidad", "Entrega su parte a tiempo y completa", "Entrega a tiempo con pequeños fallos", "Entrega tarde o incompleta", "No entrega su parte"],
            ["Colaboración", "Escucha, ayuda y resuelve desacuerdos", "Escucha y ayuda", "Trabaja aparte del grupo", "Dificulta el trabajo del grupo"],
          ],
        },
      },
    ],
    stepsTitle: "Cómo hacer una rúbrica de evaluación en 5 pasos",
    steps: [
      ["Parte del objetivo de la tarea", "Escribe en una frase qué debe demostrar el alumno. De ahí salen los criterios: si el objetivo es argumentar, la argumentación tiene que ser un criterio."],
      ["Elige entre 3 y 6 criterios", "Con menos te quedas corto; con más, la corrección se vuelve lenta y los criterios se solapan."],
      ["Reparte el peso de cada criterio", "Da más peso a lo que más importa. La suma debe ser 100 %."],
      ["Escribe los niveles con conductas observables", "Empieza por el nivel más alto y el más bajo; después rellena los intermedios. Usa cantidades y ejemplos concretos."],
      ["Pruébala con 2 o 3 trabajos reales", "Si dos trabajos muy distintos sacan la misma nota, o un criterio siempre sale igual, reescribe su descripción."],
    ],
    tipsTitle: "Errores habituales al hacer una rúbrica",
    tips: [
      "Criterios que se solapan, como «claridad» y «expresión»: se penaliza dos veces lo mismo.",
      "Niveles con adjetivos vagos («bien», «regular») que cada persona interpreta a su manera.",
      "No enseñarla al alumnado antes de la tarea: pierde la mitad de su utilidad.",
      "Dar el mismo peso a todo cuando no todo importa igual.",
    ],
    faq: [
      ["¿Cuántos niveles debe tener una rúbrica?", "Lo habitual son 4. Con un número par se evita que todo acabe en el nivel del medio."],
      ["¿Cómo se pasa una rúbrica a nota sobre 10?", "Multiplica el nivel obtenido en cada criterio por su peso y suma. Por ejemplo, con 4 niveles: (nivel ÷ 4) × peso × 10, y sumas todos los criterios."],
      ["¿Se puede corregir con IA usando una rúbrica?", "Sí. En Xandralyze pegas tu rúbrica, la IA propone la puntuación de cada criterio citando la frase del examen que la justifica, y tú revisas y decides la nota final."],
    ],
    ctaText: "Usa una de estas rúbricas para corregir dos exámenes de ejemplo al momento, sin registrarte.",
    ctaLabel: "Probar la corrección con rúbrica", ctaHref: "/educacion#demo-evaluacion",
  },
  {
    slug: "entrevista-por-competencias-preguntas",
    category: "Selección gamificada",
    backTo: "/seleccion", backLabel: "Selección",
    title: "Entrevista por competencias: 30 preguntas, método STAR y cómo puntuar | Xandralyze",
    h1: "Entrevista por competencias: 30 preguntas con el método STAR y cómo puntuarlas",
    description: "Qué es una entrevista por competencias, 30 preguntas agrupadas por competencia, cómo usar el método STAR y una escala para puntuar las respuestas de cada candidato.",
    intro: "En una entrevista por competencias no se pregunta «¿cómo eres?», sino «cuéntame una vez en la que…». La idea es sencilla: lo que alguien hizo en una situación real predice mejor lo que hará que lo que dice que haría. Aquí tienes 30 preguntas listas para usar, cómo escuchar las respuestas y cómo puntuarlas de forma comparable.",
    sections: [
      {
        h2: "Qué es una entrevista por competencias",
        paragraphs: [
          "Es una entrevista estructurada en la que se eligen antes las competencias del puesto (por ejemplo trabajo en equipo u orientación al cliente) y se hacen preguntas sobre situaciones pasadas en las que el candidato tuvo que demostrarlas.",
          "Al hacer las mismas preguntas a todos y puntuarlas con la misma escala, se pueden comparar candidatos con menos sesgo que en una conversación libre.",
        ],
      },
      {
        h2: "El método STAR",
        paragraphs: ["Una buena respuesta tiene cuatro partes. Si falta alguna, pregunta por ella."],
        list: [
          "Situación: dónde estaba y qué pasaba.",
          "Tarea: qué le tocaba hacer a él o ella.",
          "Acción: qué hizo exactamente (en primera persona, no «el equipo»).",
          "Resultado: qué pasó después y qué aprendió.",
        ],
      },
      {
        h2: "Preguntas de trabajo en equipo",
        list: [
          "Cuéntame una vez en la que tu equipo no se ponía de acuerdo. ¿Qué hiciste tú?",
          "Háblame de un proyecto en el que dependías del trabajo de otros. ¿Cómo lo coordinaste?",
          "Describe una situación en la que un compañero no cumplía su parte.",
          "Cuéntame una ocasión en la que ayudaste a alguien del equipo sin que te lo pidieran.",
          "Háblame de un logro de equipo del que estés orgulloso. ¿Cuál fue tu aportación?",
        ],
      },
      {
        h2: "Preguntas de resolución de problemas",
        list: [
          "Cuéntame el problema más difícil que has resuelto en el trabajo.",
          "Describe una vez en la que tuviste que decidir sin tener toda la información.",
          "Háblame de un error tuyo. ¿Cómo lo detectaste y qué hiciste?",
          "Cuéntame una ocasión en la que mejoraste un proceso que no funcionaba.",
          "Describe una situación en la que la primera solución que probaste falló.",
        ],
      },
      {
        h2: "Preguntas de orientación al cliente",
        list: [
          "Cuéntame una vez en la que atendiste a un cliente muy enfadado.",
          "Háblame de una ocasión en la que no pudiste dar al cliente lo que pedía.",
          "Describe algo que hiciste por un cliente que iba más allá de lo que te tocaba.",
          "Cuéntame cómo detectaste una necesidad del cliente que él no había dicho.",
          "Háblame de una queja que te ayudó a cambiar tu forma de trabajar.",
        ],
      },
      {
        h2: "Preguntas de comunicación",
        list: [
          "Cuéntame una vez en la que tuviste que explicar algo complejo a alguien sin conocimientos.",
          "Describe una conversación difícil que tuviste con un responsable.",
          "Háblame de una ocasión en la que un malentendido causó un problema. ¿Cómo lo resolviste?",
          "Cuéntame una vez en la que tuviste que convencer a alguien que no estaba de acuerdo.",
          "Describe cómo diste una mala noticia a un compañero o cliente.",
        ],
      },
      {
        h2: "Preguntas de liderazgo",
        list: [
          "Cuéntame una vez en la que tuviste que motivar a un equipo desanimado.",
          "Háblame de una decisión impopular que tomaste.",
          "Describe cómo repartiste tareas en un proyecto con poco tiempo.",
          "Cuéntame una ocasión en la que tuviste que corregir el trabajo de alguien.",
          "Háblame de una persona a la que ayudaste a mejorar profesionalmente.",
        ],
      },
      {
        h2: "Preguntas de adaptación al cambio",
        list: [
          "Cuéntame un cambio importante en tu trabajo que no esperabas. ¿Cómo lo llevaste?",
          "Describe una vez en la que tuviste que aprender algo nuevo muy rápido.",
          "Háblame de una ocasión en la que cambiaron las prioridades a mitad de un proyecto.",
          "Cuéntame una vez en la que trabajaste con personas muy distintas a ti.",
          "Describe una situación en la que tuviste que cambiar de opinión.",
        ],
      },
      {
        h2: "Cómo puntuar las respuestas",
        table: {
          caption: "Escala de puntuación por competencia",
          head: ["Puntos", "Qué se observa en la respuesta"],
          rows: [
            ["4", "Ejemplo concreto y reciente, con las cuatro partes STAR, acciones propias claras y resultado medible"],
            ["3", "Ejemplo concreto con acciones propias; el resultado es poco preciso"],
            ["2", "Ejemplo genérico o hipotético («yo haría…»), o habla del equipo sin decir qué hizo"],
            ["1", "No da ningún ejemplo o la conducta descrita va en contra de la competencia"],
          ],
        },
        paragraphs: ["Puntúa justo después de cada respuesta y anota la frase que te ha llevado a esa puntuación. Así puedes comparar candidatos y explicar la decisión."],
      },
    ],
    stepsTitle: "Cómo preparar una entrevista por competencias en 5 pasos",
    steps: [
      ["Elige 3 o 4 competencias del puesto", "Pregunta a quien dirigirá a la persona qué conductas distinguen a alguien que lo hace bien. No intentes evaluar diez competencias en una hora."],
      ["Escoge 2 preguntas por competencia", "Usa las de esta guía como base y adáptalas al puesto. Haz las mismas preguntas a todos los candidatos."],
      ["Prepara preguntas de seguimiento", "«¿Qué hiciste tú exactamente?», «¿Qué pasó después?», «¿Qué harías distinto?». Sirven para completar el STAR."],
      ["Puntúa con una escala común", "Usa la escala de 1 a 4 y anota evidencias. Si entrevistáis varias personas, puntuad por separado y luego comparad."],
      ["Complétala con una prueba práctica", "La entrevista mide lo que el candidato cuenta. Una simulación o caso práctico muestra lo que hace ante una situación del puesto."],
    ],
    tipsTitle: "Errores que conviene evitar",
    tips: [
      "Aceptar respuestas hipotéticas («yo intentaría…») como si fueran ejemplos reales.",
      "Dejarse llevar por la primera impresión o por lo bien que habla el candidato.",
      "Hacer preguntas distintas a cada persona: después no se pueden comparar.",
      "Preguntar por la vida personal, la edad o los planes familiares: no aporta nada a la competencia y puede ser discriminatorio.",
    ],
    faq: [
      ["¿Cuánto dura una entrevista por competencias?", "Entre 45 y 60 minutos para 3 o 4 competencias, con unos 10 a 15 minutos por competencia."],
      ["¿Qué diferencia hay con una entrevista tradicional?", "En la tradicional se pregunta por opiniones y planes; en la de competencias, por hechos pasados, y se puntúa con una escala común."],
      ["¿Se puede hacer online?", "Sí. Además, en Xandralyze puedes completarla con una simulación en vídeo en la que el candidato toma decisiones en una situación real del puesto y recibe una puntuación por competencias."],
    ],
    ctaText: "Prueba una simulación de selección de ejemplo y mira el informe por competencias que genera, sin crear cuenta.",
    ctaLabel: "Ver la simulación de ejemplo", ctaHref: "/seleccion",
  },
  {
    slug: "assessment-center-ejercicios",
    category: "Selección gamificada",
    backTo: "/seleccion", backLabel: "Selección",
    title: "Assessment center: qué es, ejercicios con ejemplos y cómo hacerlo online | Xandralyze",
    h1: "Assessment center: qué es, ejercicios con ejemplos y cómo hacerlo online",
    description: "Qué es un assessment center, los 6 ejercicios más usados (bandeja de entrada, role play, dinámica de grupo, caso práctico…), cómo diseñarlo y cómo hacerlo online.",
    intro: "Un assessment center es una jornada de selección en la que varios candidatos hacen ejercicios que imitan situaciones reales del puesto mientras varios evaluadores observan y puntúan sus conductas. En vez de preguntar «¿sabes negociar?», se le pone a negociar. Aquí tienes en qué consiste, los ejercicios más habituales y cómo hacer una versión online.",
    sections: [
      {
        h2: "Qué es un assessment center",
        paragraphs: [
          "Es un método de evaluación, no un lugar. Combina varios ejercicios para que cada competencia se observe más de una vez y por más de un evaluador. Se usa sobre todo para mandos, puestos comerciales, programas de talento joven y promociones internas.",
          "Su fuerza está en la combinación: un candidato puede tener un mal momento en un ejercicio, pero si una conducta aparece en tres ejercicios distintos, es una señal fiable.",
        ],
      },
      {
        h2: "Los 6 ejercicios más habituales",
        table: {
          caption: "Ejercicios típicos de un assessment center",
          head: ["Ejercicio", "En qué consiste", "Qué mide"],
          rows: [
            ["Bandeja de entrada (in-basket)", "Correos, avisos y tareas pendientes que hay que priorizar y resolver en un tiempo limitado", "Organización, priorización, toma de decisiones"],
            ["Role play", "Conversación simulada con un actor: un cliente enfadado, un empleado que rinde poco, una negociación", "Comunicación, orientación al cliente, liderazgo"],
            ["Dinámica de grupo", "Varios candidatos resuelven juntos un problema o deben llegar a un acuerdo", "Trabajo en equipo, influencia, escucha"],
            ["Caso práctico", "Análisis de una situación de empresa con datos y propuesta de solución", "Análisis, resolución de problemas, criterio"],
            ["Presentación", "Exponer ante el tribunal la solución del caso u otro tema", "Comunicación, capacidad de convencer"],
            ["Entrevista por competencias", "Preguntas sobre situaciones pasadas reales", "Todas las competencias del puesto"],
          ],
        },
        paragraphs: ["Muchos procesos añaden además pruebas psicotécnicas o cuestionarios de personalidad, pero lo propio del assessment center son los ejercicios de situación."],
      },
      {
        h2: "La matriz de competencias por ejercicio",
        paragraphs: ["Antes de diseñar nada, se cruza cada competencia con los ejercicios en los que se va a observar. Cada competencia debería aparecer al menos en dos ejercicios."],
        table: {
          caption: "Ejemplo de matriz para un puesto de jefe de equipo",
          head: ["Competencia", "Bandeja", "Role play", "Dinámica", "Caso"],
          rows: [
            ["Toma de decisiones", "✓", "", "✓", "✓"],
            ["Liderazgo", "", "✓", "✓", ""],
            ["Comunicación", "", "✓", "✓", "✓"],
            ["Organización", "✓", "", "", "✓"],
          ],
        },
      },
      {
        h2: "Cómo hacer un assessment center online",
        paragraphs: [
          "La bandeja de entrada, el caso práctico y la entrevista se trasladan bien a videollamada o a una plataforma. El role play necesita un actor conectado o una simulación. La dinámica de grupo online funciona con grupos pequeños y un evaluador por cada dos o tres candidatos.",
          "Una alternativa más escalable es la simulación interactiva en vídeo: el candidato ve escenas de una situación del puesto, decide qué hacer en cada momento y la historia cambia según sus decisiones. Todos pasan por la misma situación, se registra cada decisión y su tiempo, y se obtiene una puntuación por competencias que se puede comparar.",
        ],
      },
    ],
    stepsTitle: "Cómo diseñar un assessment center en 5 pasos",
    steps: [
      ["Analiza el puesto", "Habla con quien lo dirige y con personas que lo hacen bien. Elige de 4 a 6 competencias y descríbelas como conductas observables."],
      ["Construye la matriz", "Decide qué ejercicios usarás y asegúrate de que cada competencia se observa al menos dos veces."],
      ["Diseña ejercicios realistas", "Usa situaciones que de verdad pasan en el puesto: los mismos tipos de correos, clientes y problemas."],
      ["Forma a los evaluadores", "Deben anotar conductas («interrumpió dos veces», «propuso un plan con plazos») y no impresiones. Cada uno puntúa por separado."],
      ["Integra las puntuaciones", "Al final, los evaluadores ponen en común sus notas por competencia y acuerdan una valoración con evidencias. Da feedback a cada candidato."],
    ],
    tipsTitle: "Consejos para que funcione",
    tips: [
      "Más ejercicios no es mejor: con 3 o 4 bien diseñados suele bastar.",
      "Separa observar de valorar: primero se anota lo que pasó, después se puntúa.",
      "Informa a los candidatos de cómo será la jornada; reduce los nervios y mejora la imagen de la empresa.",
      "Revisa al cabo de unos meses si las puntuaciones coincidieron con el rendimiento real de quienes entraron.",
    ],
    faq: [
      ["¿Cuánto dura un assessment center?", "Entre medio día y un día completo en formato presencial. Online se suele repartir en sesiones más cortas."],
      ["¿Cómo se prepara un candidato para un assessment center?", "Repasando situaciones reales en las que demostró las competencias del puesto, practicando la priorización de tareas y escuchando más que hablando en la dinámica de grupo."],
      ["¿Qué diferencia hay con las pruebas psicotécnicas?", "Los psicotécnicos miden aptitudes con tests; el assessment center observa conductas en situaciones que imitan el trabajo."],
    ],
    ctaText: "Mira cómo es una simulación de selección en vídeo y el informe por competencias que genera, sin crear cuenta.",
    ctaLabel: "Ver la simulación de ejemplo", ctaHref: "/seleccion",
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
