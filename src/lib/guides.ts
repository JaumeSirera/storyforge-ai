export const SITE = "https://xandralyze.com";

export type Guide = {
  slug: string;
  category: string;
  backTo: "/educacion" | "/seleccion" | "/psicologia";
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
