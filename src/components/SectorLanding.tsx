import { guides } from "@/lib/guides";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, GraduationCap, Users, AudioLines, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger, SheetContent, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { PublicExamDemo } from "@/components/PublicExamDemo";
import { PublicDemo } from "@/components/PublicDemo";
import { SectorVideoBlock } from "@/components/LandingVideos";
import logo from "@/assets/logo-xandralyze.png";
import education from "@/assets/sector-education.jpg";
import recruitment from "@/assets/sector-recruitment.jpg";
import psychology from "@/assets/sector-psychology.jpg";

export const sectorLinks = [
  { to: "/educacion", label: "Educación", icon: GraduationCap },
  { to: "/seleccion", label: "Selección", icon: Users },
  { to: "/psicologia", label: "Psicología", icon: AudioLines },
] as const;

const sectors = {
  educacion: {
    eyebrow: "Universidades · Academias · Oposiciones",
    title: "Corrección de exámenes manuscritos con IA",
    seoTitle: "Corregir Exámenes con IA: Manuscritos, PDF y Orales | Xandralyze",
    description: "Corrige con IA exámenes escritos a mano, escaneados o en PDF aplicando tu rúbrica. Examen oral que se corrige solo, comentario para cada alumno y notas exportables a Excel. Gratis y open source.",
    image: education, alt: "Docente corrigiendo a bolígrafo un montón de exámenes escritos a mano junto a un portátil",
    action: "Crear una evaluación", demo: "demo-evaluacion",
    heading: "Corrige exámenes manuscritos y en PDF aplicando tu rúbrica",
    intro: "Para docentes que necesitan revisar respuestas extensas sin perder de vista qué se evalúa y por qué. La IA propone la nota y tú la revisas.",
    features: [
      ["Lector OCR de exámenes escaneados, en foto o PDF", "Sube fotos del móvil, páginas escaneadas o un PDF. La app transcribe lo escrito a mano y marca los fragmentos dudosos para que los revises."],
      ["Evaluación por competencias con rúbrica", "Define los criterios y el peso de cada apartado. Revisa la nota, las evidencias y la justificación antes de darla por válida."],
      ["Comentario personalizado para cada alumno", "En cada pregunta: si está bien o mal, la respuesta esperada, por qué y qué repasar. Eliges el tono y descargas el informe en PDF."],
      ["Examen oral que se corrige solo", "Añade preguntas orales al examen online: el alumno contesta hablando, su voz se convierte en texto y la IA lo corrige con tu rúbrica, sin contar las faltas del dictado."],
      ["Exportación de notas a Excel", "Descarga en una hoja las notas de todos los alumnos: nota, nota sobre 10, calificación, puntos por pregunta y desglose. Se abre en Excel, LibreOffice o Google Sheets."],
      ["Generador de exámenes con IA y examen online con tiempo", "Genera preguntas de desarrollo, test, verdadero/falso, numéricas u orales con tu propia clave de IA, reutiliza el banco de preguntas e invita por enlace a pruebas cronometradas con registro de incidencias."],
    ],
    steps: ["Prepara la prueba y la rúbrica", "Recoge las entregas escritas, en PDF u orales", "Revisa la corrección, exporta las notas y comparte el informe"],
    note: "La IA apoya la corrección: el docente conserva la revisión de la nota. El análisis de la letra se limita a aspectos observables, no a inferencias sobre personalidad o salud.",
  },
  seleccion: {
    eyebrow: "RR. HH. · Assessment centers · Formación",
    title: "Plataforma de selección gamificada para RR. HH.",
    seoTitle: "Plataforma de Selección Gamificada RR. HH. y Simulador de Entrevistas con IA | Xandralyze",
    description: "Plataforma de selección gamificada para RR. HH.: simulador de entrevistas situacionales con IA, assessment centers y software de análisis de comportamiento. Gratis y open source.",
    image: recruitment, alt: "Equipo participando en una dinámica profesional de assessment center",
    action: "Crear una simulación", demo: "demo",
    heading: "Simulador de entrevistas y situaciones con IA",
    intro: "Diseña escenarios para el puesto y combina decisiones individuales con dinámicas de grupo.",
    features: [
      ["Creador de simulaciones interactivas gratis", "Genera historias, preguntas y alternativas con IA. Cada decisión puede conducir al candidato a una escena diferente."],
      ["Puntos y competencias", "Configura criterios de evaluación y ofrece feedback. Revisa el desglose de puntuación y las evidencias de cada respuesta."],
      ["Software de análisis de comportamiento con IA", "Graba cámara, pantalla o varias cámaras con consentimiento y reúne decisiones y observaciones en un informe integrado."],
    ],
    steps: ["Define el puesto y las competencias", "Invita a participar en el escenario", "Revisa decisiones y evidencias"],
    note: "Los resultados sirven de apoyo al evaluador, no sustituyen el juicio profesional ni garantizan la idoneidad de una contratación.",
  },
  psicologia: {
    eyebrow: "Terapeutas · Psicólogos · Interacciones de voz",
    title: "Análisis de interacciones de voz para psicólogos y terapeutas",
    seoTitle: "Análisis de Interacciones de Voz para Psicólogos y Terapeutas | Xandralyze",
    description: "Revisa sesiones con transcripción, turnos de palabra y momentos relevantes. Organiza observaciones ancladas a la grabación para acompañar tu trabajo profesional.",
    image: psychology, alt: "Profesional escuchando a una persona durante una consulta",
    action: "Preparar una sesión", demo: null,
    heading: "De la conversación a la evidencia observable",
    intro: "Una herramienta de revisión de interacciones, no un sistema de diagnóstico clínico.",
    features: [
      ["Voz y participación", "Consulta la transcripción con hablantes y revisa tiempos de intervención, turnos e interrupciones."],
      ["Momentos y anotaciones", "Localiza escenas relevantes con marcas de tiempo y añade tus notas para contextualizar lo observado."],
      ["Consentimiento e informes", "Recoge la aceptación de la grabación y organiza evidencias en informes que puedes revisar antes de compartir."],
    ],
    steps: ["Recoge el consentimiento", "Graba y revisa la interacción", "Anota evidencias y prepara el informe"],
    note: "Xandralyze no diagnostica ni infiere salud mental o personalidad a partir de la voz. Su uso con datos sensibles requiere consentimiento, medidas de protección y revisión profesional.",
  },
} as const;

/** Preguntas frecuentes visibles por sector (también se marcan para buscadores). */
const sectorFaq: Partial<Record<keyof typeof sectors, [string, string][]>> = {
  educacion: [
    ["¿Cómo corregir exámenes de alumnos con inteligencia artificial gratis?", "Xandralyze es gratuito y de código abierto. Creas la prueba y la rúbrica, subes las entregas y la IA propone la nota y un comentario por pregunta que tú revisas. Funciona con tu propia clave de IA (por ejemplo, Google Gemini u OpenAI): la app no cobra, pero el proveedor que elijas puede cobrarte por su uso."],
    ["¿Se pueden corregir exámenes escritos a mano escaneados, en foto o en PDF?", "Sí. Puedes subir fotos hechas con el móvil, páginas escaneadas o un PDF. La app transcribe lo escrito a mano, indica la confianza de cada fragmento y te avisa de lo que conviene revisar. Si la letra es muy difícil, puedes corregir la transcripción antes de dar la nota por buena."],
    ["¿Cómo generar retroalimentación personalizada para cada estudiante?", "Cada respuesta corregida incluye si es correcta, parcial o incorrecta, la respuesta esperada, por qué, un comentario dirigido al alumno y un siguiente paso para mejorar. Puedes elegir el tono (formativo, breve, motivacional o técnico) y descargar el informe de cada alumno en PDF."],
    ["¿Puedo hacer un examen oral que se corrija solo?", "Sí. En el examen online puedes poner preguntas de tipo oral: el alumno responde hablando desde Chrome, Edge o Safari, el navegador convierte su voz en texto y la IA lo corrige con tu rúbrica sin tener en cuenta las faltas del dictado. Se guarda el texto, no el audio, y tú revisas la nota."],
    ["¿Puedo exportar las notas a Excel?", "Sí. El botón «Exportar notas» descarga una hoja con la nota de cada alumno, la nota sobre 10, la calificación, los puntos de cada pregunta y el desglose por contenido, estructura, lengua y letra. Se abre en Excel, LibreOffice o Google Sheets."],
    ["¿Qué pasa con la protección de datos de los alumnos (RGPD)?", "El centro o el docente sigue siendo responsable de cumplir la normativa con sus alumnos, así que conviene consultarlo con vuestro delegado de protección de datos. Lo que hace la app: las respuestas solo se envían al proveedor de IA que tú elijas con tu clave, puedes identificar a cada alumno con un código en lugar del nombre y, al ser código abierto, puedes revisar cómo funciona o instalarla en tu propio servidor."],
    ["¿Sirve para secundaria, FP, universidad u oposiciones?", "Sí, para cualquier nivel: tú defines las preguntas y la rúbrica. Admite preguntas de desarrollo, test, verdadero/falso, numéricas y orales, y para academias y oposiciones hay examen online con tiempo límite y registro de incidencias."],
  ],
};

export function sectorHead(sector: keyof typeof sectors) {
  const page = sectors[sector];
  const title = page.seoTitle;
  const url = `https://xandralyze.com/${sector}`;
  const faq = sectorFaq[sector];
  return {
    meta: [{ title }, { name: "description", content: page.description }, { property: "og:title", content: title }, { property: "og:description", content: page.description }, { property: "og:type", content: "website" }, { property: "og:url", content: url }, { name: "twitter:card", content: "summary_large_image" }, { property: "og:image", content: "https://xandralyze.com/og-xandralyze.png" }, { property: "og:image:width", content: "1200" }, { property: "og:image:height", content: "630" }, { name: "twitter:image", content: "https://xandralyze.com/og-xandralyze.png" }],
    links: [{ rel: "canonical", href: url }],
    scripts: faq
      ? [{
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org", "@type": "FAQPage", inLanguage: "es",
            mainEntity: faq.map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } })),
          }),
        }]
      : [],
  };
}

export function SectorLanding({ sector }: { sector: keyof typeof sectors }) {
  const page = sectors[sector];
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold"><img src={logo} alt="" width={36} height={36} className="h-9 w-9 object-contain" />Xandralyze</Link>
          <nav aria-label="Sectores" className="hidden items-center gap-6 text-sm md:flex">{sectorLinks.map((item) => <Link key={item.to} to={item.to} className={item.to === `/${sector}` ? "font-semibold text-primary" : "text-muted-foreground hover:text-foreground"}>{item.label}</Link>)}<Link to="/guia" className="text-muted-foreground hover:text-foreground">Guías</Link><Link to="/contacto" className="text-muted-foreground hover:text-foreground">Contacto</Link><Button asChild size="sm"><Link to="/auth">Entrar</Link></Button></nav>
          <Sheet><SheetTrigger asChild><Button variant="ghost" size="icon" aria-label="Abrir menú" className="md:hidden"><Menu /></Button></SheetTrigger><SheetContent aria-describedby={undefined}><SheetTitle>Xandralyze</SheetTitle><nav className="mt-6 flex flex-col gap-5" aria-label="Sectores móvil">{sectorLinks.map((item) => <SheetClose asChild key={item.to}><Link to={item.to}>{item.label}</Link></SheetClose>)}<SheetClose asChild><Link to="/guia">Guías</Link></SheetClose><SheetClose asChild><Link to="/contacto">Contacto</Link></SheetClose><SheetClose asChild><Link to="/auth">Entrar</Link></SheetClose></nav></SheetContent></Sheet>
        </div>
      </header>
      <main>
        <section className="relative isolate overflow-hidden border-b border-border">
          <img src={page.image} alt={page.alt} width={1536} height={1024} className="absolute inset-0 -z-20 h-full w-full object-cover object-right" />
          <div className="sector-hero-scrim absolute inset-0 -z-10" />
          <div className="mx-auto max-w-7xl px-6 py-16 md:py-24">
            <div className="max-w-xl">
              <p className="text-sm font-semibold text-primary">Xandralyze / {page.eyebrow}</p>
              <h1 className="mt-5 text-balance text-4xl font-bold leading-tight tracking-normal md:text-5xl">{page.title}</h1>
              <p className="mt-6 text-lg leading-relaxed text-muted-foreground">{page.description}</p>
              <div className="mt-8 flex flex-wrap gap-3"><Button asChild size="lg"><Link to="/auth">{page.action}<ArrowRight /></Link></Button>{page.demo && <Button asChild variant="outline" size="lg"><a href={`#${page.demo}`}>Probar sin registro</a></Button>}</div>
              <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground"><Check className="h-4 w-4 text-success" />Gratis · Open source · Tu propia clave de IA</p>
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-6 py-16">
          <h2 className="text-3xl tracking-normal">{page.heading}</h2><p className="mt-3 max-w-2xl text-muted-foreground">{page.intro}</p>
          <div className="mt-10 grid gap-8 md:grid-cols-3">{page.features.map(([title, body], i) => <article key={title} className="border-t border-border pt-6"><span className="text-sm font-semibold text-primary">0{i + 1}</span><h3 className="mt-3 text-xl tracking-normal">{title}</h3><p className="mt-3 leading-relaxed text-muted-foreground">{body}</p></article>)}</div>
        </section>
        <SectorVideoBlock sector={sector} />
        {guides.some((g) => g.backTo === `/${sector}`) && <section className="mx-auto flex max-w-7xl flex-col gap-2 px-6 pb-4"><h2 className="text-xl tracking-normal">Guías</h2>{guides.filter((g) => g.backTo === `/${sector}`).map((g) => <a key={g.slug} href={`/guia/${g.slug}`} className="inline-flex items-center gap-2 font-medium text-primary hover:underline">{g.h1}<ArrowRight className="h-4 w-4" /></a>)}</section>}
        {sector === "educacion" && <PublicExamDemo />}
        {sector === "seleccion" && <PublicDemo />}
        {sectorFaq[sector] && <section className="mx-auto max-w-4xl px-6 py-16" aria-labelledby="faq-title"><h2 id="faq-title" className="text-3xl tracking-normal">Preguntas frecuentes</h2><dl className="mt-8 space-y-6">{sectorFaq[sector]!.map(([q, a]) => <div key={q} className="border-t border-border pt-5"><dt className="text-lg font-semibold">{q}</dt><dd className="mt-2 leading-relaxed text-muted-foreground">{a}</dd></div>)}</dl></section>}
        <section className="border-b border-border bg-secondary/40"><div className="mx-auto max-w-7xl px-6 py-16"><h2 className="text-3xl tracking-normal">Un flujo que puedes revisar</h2><ol className="mt-8 grid gap-8 md:grid-cols-3">{page.steps.map((step, i) => <li key={step} className="flex items-start gap-3"><span className="font-semibold text-primary">{i + 1}.</span><span className="font-medium">{step}</span></li>)}</ol><p className="mt-10 max-w-3xl border-l-2 border-primary pl-4 text-sm leading-relaxed text-muted-foreground">{page.note}</p></div></section>
        <section className="mx-auto max-w-7xl px-6 py-16"><h2 className="text-3xl tracking-normal">Xandralyze es de código abierto</h2><p className="mt-3 max-w-2xl text-muted-foreground">Plataforma gratuita bajo licencia AGPL-3.0. El uso de IA requiere tu propia clave y puede tener costes del proveedor que elijas.</p><div className="mt-6 flex flex-wrap gap-3"><Button asChild><Link to="/auth">Empezar<ArrowRight /></Link></Button><Button asChild variant="outline"><Link to="/open-source">Conocer el proyecto</Link></Button></div></section>
      </main>
      <footer className="border-t border-border"><div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-6 px-6 py-8 text-sm text-muted-foreground"><Link to="/">Xandralyze</Link><nav aria-label="Otros sectores" className="flex flex-wrap gap-6">{sectorLinks.map((item) => <Link key={item.to} to={item.to}>{item.label}</Link>)}</nav></div></footer>
    </div>
  );
}