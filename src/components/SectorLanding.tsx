import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, GraduationCap, Users, AudioLines, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger, SheetContent, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { PublicExamDemo } from "@/components/PublicExamDemo";
import { PublicDemo } from "@/components/PublicDemo";
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
    description: "Evalúa respuestas escritas con tu rúbrica y reúne nota, evidencias y comentarios en un informe revisable. Del examen en papel al feedback para cada alumno.",
    image: education, alt: "Revisión de exámenes manuscritos en una mesa de trabajo",
    action: "Crear una evaluación", demo: "demo-evaluacion",
    heading: "Tu criterio, aplicado a cada entrega",
    intro: "Para docentes que necesitan revisar respuestas extensas sin perder de vista qué se evalúa y por qué.",
    features: [
      ["Manuscritos y escaneos", "Sube fotos o páginas escaneadas y trabaja con la transcripción y las respuestas de cada alumno."],
      ["Rúbricas y evidencias", "Define los criterios y el peso de cada apartado. Revisa la nota y la justificación antes de darla por válida."],
      ["Universidades y oposiciones", "Prepara pruebas por competencias, reutiliza preguntas del banco e invita a los aspirantes por enlace."],
    ],
    steps: ["Prepara la prueba y la rúbrica", "Recoge las entregas escritas", "Revisa la corrección y comparte el informe"],
    note: "La IA apoya la corrección: el docente conserva la revisión de la nota. El análisis de la letra se limita a aspectos observables, no a inferencias sobre personalidad o salud.",
  },
  seleccion: {
    eyebrow: "RR. HH. · Assessment centers · Formación",
    title: "Assessment centers y selección gamificada",
    description: "Lleva a tus candidatos a situaciones profesionales interactivas. Observa sus decisiones, revisa las competencias y conecta los resultados con evidencias de la sesión.",
    image: recruitment, alt: "Equipo participando en una dinámica profesional de assessment center",
    action: "Crear una simulación", demo: "demo",
    heading: "Más contexto que una respuesta de entrevista",
    intro: "Diseña escenarios para el puesto y combina decisiones individuales con dinámicas de grupo.",
    features: [
      ["Escenarios ramificados", "Genera historias, preguntas y alternativas con IA. Cada decisión puede conducir al candidato a una escena diferente."],
      ["Puntos y competencias", "Configura criterios de evaluación y ofrece feedback. Revisa el desglose de puntuación y las evidencias de cada respuesta."],
      ["Sesiones individuales y grupales", "Graba cámara, pantalla o varias cámaras con consentimiento y reúne decisiones y observaciones en un informe integrado."],
    ],
    steps: ["Define el puesto y las competencias", "Invita a participar en el escenario", "Revisa decisiones y evidencias"],
    note: "Los resultados sirven de apoyo al evaluador, no sustituyen el juicio profesional ni garantizan la idoneidad de una contratación.",
  },
  psicologia: {
    eyebrow: "Terapeutas · Psicólogos · Interacciones de voz",
    title: "Análisis de interacciones para profesionales de la psicología",
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

export function sectorHead(sector: keyof typeof sectors) {
  const page = sectors[sector];
  const title = `${page.title} | Xandralyze Open Source`;
  const url = `https://iworkpre.lovable.app/${sector}`;
  return {
    meta: [{ title }, { name: "description", content: page.description }, { property: "og:title", content: title }, { property: "og:description", content: page.description }, { property: "og:type", content: "website" }, { property: "og:url", content: url }, { name: "twitter:card", content: "summary_large_image" }],
    links: [{ rel: "canonical", href: url }],
  };
}

export function SectorLanding({ sector }: { sector: keyof typeof sectors }) {
  const page = sectors[sector];
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold"><img src={logo} alt="" width={36} height={36} className="h-9 w-9 object-contain" />Xandralyze</Link>
          <nav aria-label="Sectores" className="hidden items-center gap-6 text-sm md:flex">{sectorLinks.map((item) => <Link key={item.to} to={item.to} className={item.to === `/${sector}` ? "font-semibold text-primary" : "text-muted-foreground hover:text-foreground"}>{item.label}</Link>)}<Button asChild size="sm"><Link to="/auth">Entrar</Link></Button></nav>
          <Sheet><SheetTrigger asChild><Button variant="ghost" size="icon" aria-label="Abrir menú" className="md:hidden"><Menu /></Button></SheetTrigger><SheetContent aria-describedby={undefined}><SheetTitle>Xandralyze</SheetTitle><nav className="mt-6 flex flex-col gap-5" aria-label="Sectores móvil">{sectorLinks.map((item) => <SheetClose asChild key={item.to}><Link to={item.to}>{item.label}</Link></SheetClose>)}<SheetClose asChild><Link to="/auth">Entrar</Link></SheetClose></nav></SheetContent></Sheet>
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
        {sector === "educacion" && <PublicExamDemo />}
        {sector === "seleccion" && <PublicDemo />}
        <section className="border-b border-border bg-secondary/40"><div className="mx-auto max-w-7xl px-6 py-16"><h2 className="text-3xl tracking-normal">Un flujo que puedes revisar</h2><ol className="mt-8 grid gap-8 md:grid-cols-3">{page.steps.map((step, i) => <li key={step} className="flex items-start gap-3"><span className="font-semibold text-primary">{i + 1}.</span><span className="font-medium">{step}</span></li>)}</ol><p className="mt-10 max-w-3xl border-l-2 border-primary pl-4 text-sm leading-relaxed text-muted-foreground">{page.note}</p></div></section>
        <section className="mx-auto max-w-7xl px-6 py-16"><h2 className="text-3xl tracking-normal">Xandralyze es de código abierto</h2><p className="mt-3 max-w-2xl text-muted-foreground">Plataforma gratuita bajo licencia AGPL-3.0. El uso de IA requiere tu propia clave y puede tener costes del proveedor que elijas.</p><div className="mt-6 flex flex-wrap gap-3"><Button asChild><Link to="/auth">Empezar<ArrowRight /></Link></Button><Button asChild variant="outline"><Link to="/open-source">Conocer el proyecto</Link></Button></div></section>
      </main>
      <footer className="border-t border-border"><div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-6 px-6 py-8 text-sm text-muted-foreground"><Link to="/">Xandralyze</Link><nav aria-label="Otros sectores" className="flex flex-wrap gap-6">{sectorLinks.map((item) => <Link key={item.to} to={item.to}>{item.label}</Link>)}</nav></div></footer>
    </div>
  );
}