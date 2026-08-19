import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { GuidedTour } from "@/components/GuidedTour";
import {
  Sparkles,
  Film,
  GitBranch,
  BarChart3,
  Award,
  ArrowRight,
  Video,
  Users,
  Mic,
  Clock,
  ShieldCheck,
  FileText,
  Layers,
  Mail,
  MonitorPlay,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Xandralyze — Simulaciones con IA y análisis de comportamiento" },
      {
        name: "description",
        content:
          "Crea simulaciones en vídeo con IA, graba al candidato (cámara, pantalla y multicámara) y obtén un informe integrado de decisiones y comportamiento.",
      },
      { property: "og:title", content: "Xandralyze — Simulaciones con IA y análisis de comportamiento" },
      {
        property: "og:description",
        content:
          "Simulaciones profesionales generadas por IA, grabación multicámara con consentimiento y análisis de comportamiento con evidencias temporales.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Hero />
        <GuidedTour />
        <Modules />
        <Features />
        <HowItWorks />
        <UseCases />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}


function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg" aria-label="Xandralyze — inicio">
          <img
            src={logoAsset.url}
            alt="Logotipo de Xandralyze"
            className="h-9 w-auto"
            width={36}
            height={36}
          />
          <span>Xandralyze</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <Link to="/explore" className="hover:text-foreground">Galería</Link>
          <a href="#tour" className="hover:text-foreground">Tour</a>
          <a href="#modules" className="hover:text-foreground">Módulos</a>
          <a href="#features" className="hover:text-foreground">Funciones</a>
          <a href="#how" className="hover:text-foreground">Cómo funciona</a>
          <a href="#use-cases" className="hover:text-foreground">Casos de uso</a>
        </nav>

        <div className="flex items-center gap-2">
          <Link to="/explore">
            <Button variant="ghost" size="sm">Explorar</Button>
          </Link>
          <Link to="/auth">
            <Button variant="ghost" size="sm">Entrar</Button>
          </Link>
          <Link to="/auth">
            <Button size="sm">Empezar gratis</Button>
          </Link>
        </div>

      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="bg-hero">
      <div className="mx-auto max-w-7xl px-6 py-24 md:py-32 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-soft">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Simulaciones con IA + análisis de comportamiento
        </div>
        <h1 className="mt-6 text-balance text-5xl md:text-7xl font-bold tracking-tight">
          Simula, graba y{" "}
          <span className="bg-gradient-to-r from-primary to-chart-4 bg-clip-text text-transparent">
            evalúa con evidencias
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
          La IA crea la simulación en vídeo con preguntas ramificadas. Xandralyze graba al
          participante (cámara, pantalla y multicámara), analiza su comportamiento y entrega un
          informe integrado: qué decidió y cómo lo hizo.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link to="/auth">
            <Button size="lg" className="gap-2">
              Crear mi primera simulación <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <a href="#modules">
            <Button size="lg" variant="outline">Ver qué hace la app</Button>
          </a>
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><Video className="h-3.5 w-3.5 text-primary" /> Grabación cámara + pantalla</span>
          <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-primary" /> Sesiones grupales multicámara</span>
          <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> Consentimiento y auditoría</span>
          <span className="inline-flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-primary" /> Informe integrado en PDF</span>
        </div>
      </div>
    </section>
  );
}

const modules = [
  {
    icon: Sparkles,
    tag: "Crear",
    title: "Generador de simulaciones",
    body:
      "A partir de un prompt la IA escribe la historia, las escenas, las preguntas, el árbol de decisiones y los criterios de evaluación.",
    points: ["Guion y preguntas automáticas", "Editor visual de ramificaciones", "Voz, subtítulos y clips IA"],
  },
  {
    icon: MonitorPlay,
    tag: "Jugar",
    title: "Vídeo interactivo gamificado",
    body:
      "El participante decide dentro del vídeo: cada respuesta lo lleva a otra escena o clip, con puntos, estrellas y feedback inmediato.",
    points: ["Controles completos y accesibles", "Retorno automático tras cada clip", "Puntuación por competencia"],
  },
  {
    icon: Video,
    tag: "Grabar",
    title: "Capture: grabación de la sesión",
    body:
      "Graba cámara y pantalla a la vez mientras juega, en individual o en grupo, con un dispositivo o uno por participante.",
    points: [
      "Grabación continua aunque cambies de página",
      "Recuperación automática si se recarga",
      "Mosaico multicámara en tiempo real",
    ],
  },
  {
    icon: BarChart3,
    tag: "Analizar",
    title: "Análisis del comportamiento",
    body:
      "Transcripción con hablantes, métricas de participación, turnos e interrupciones, y escenas clave con marca de tiempo.",
    points: ["Película resumen de momentos clave", "Notas y etiquetas del evaluador", "Comparativa entre sesiones"],
  },
  {
    icon: FileText,
    tag: "Concluir",
    title: "Informe integrado",
    body:
      "Un solo documento que cruza las decisiones de la simulación con la evidencia observable de la grabación.",
    points: ["Vista previa web antes de enviar", "PDF con tu logo y marca", "Envío por email al candidato"],
  },
  {
    icon: ShieldCheck,
    tag: "Cumplir",
    title: "Consentimiento y control",
    body:
      "Los participantes entran por invitación, aceptan la grabación y el análisis, y todo queda registrado con fecha y versión.",
    points: ["Invitaciones con enlace seguro", "Auditoría de aceptaciones", "Control del anfitrión sincronizado"],
  },
];

function Modules() {
  return (
    <section id="modules" className="border-y border-border/60 bg-secondary/30">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <div className="max-w-2xl">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Qué hace exactamente Xandralyze
          </h2>
          <p className="mt-3 text-muted-foreground">
            Seis funciones encadenadas: crear, jugar, grabar, analizar, concluir y cumplir.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => (
            <div
              key={m.title}
              className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-soft transition hover:shadow-glow"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground">
                  <m.icon className="h-5 w-5" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  {m.tag}
                </span>
              </div>
              <h3 className="mt-4 text-lg font-semibold">{m.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{m.body}</p>
              <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                {m.points.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


const features = [
  {
    icon: Film,
    title: "Vídeo interactivo",
    body: "YouTube, Vimeo o MP4 propio. Pausa, avance, retroceso y subtítulos configurables.",
  },
  {
    icon: GitBranch,
    title: "Árbol de decisiones",
    body: "Cada respuesta lleva a otra escena o clip. Cientos de caminos por simulación.",
  },
  {
    icon: Video,
    title: "Cámara + pantalla",
    body: "Graba las dos pistas a la vez y expórtalas en un único vídeo con cámara en recuadro (PIP).",
  },
  {
    icon: Users,
    title: "Multicámara en grupo",
    body: "Cada participante desde su móvil o portátil, todos visibles en un mosaico en tiempo real.",
  },
  {
    icon: Clock,
    title: "Grabación a prueba de fallos",
    body: "Sigue grabando al cambiar de página y se recupera sola si recargas o pierdes el foco.",
  },
  {
    icon: Mic,
    title: "Transcripción y voz",
    body: "Quién habla, cuánto, turnos e interrupciones, con citas ancladas al segundo exacto.",
  },
  {
    icon: Layers,
    title: "Escenas y comparativas",
    body: "Momentos clave con timestamps, notas del evaluador y comparación entre dos sesiones.",
  },
  {
    icon: Award,
    title: "Gamificación",
    body: "Puntos, estrellas y competencias para motivar y medir de forma objetiva.",
  },
  {
    icon: Mail,
    title: "Informe y envío",
    body: "Vista previa web del email y del PDF antes de enviarlo al candidato con tu marca.",
  },
];

function Features() {
  return (
    <section id="features" className="mx-auto max-w-7xl px-6 py-24">
      <div className="max-w-2xl">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
          Todo lo que necesitas para evaluar, grabar y formar
        </h2>
        <p className="mt-3 text-muted-foreground">
          Una plataforma para crear assessments interactivos y medir el comportamiento real, sin
          equipo técnico.
        </p>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.title}
            className="rounded-2xl border border-border bg-card p-6 shadow-soft transition hover:shadow-glow"
          >
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground">
              <f.icon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const steps = [
  {
    n: "01",
    title: "Define el objetivo",
    body: "“Crear una simulación para seleccionar un Chef Ejecutivo de un hotel de 5 estrellas.”",
  },
  {
    n: "02",
    title: "La IA genera el juego",
    body: "Historia, escenas, preguntas con feedback, ramas y criterios de evaluación.",
  },
  {
    n: "03",
    title: "Invita y graba",
    body: "El participante entra por enlace, acepta el consentimiento y al grabar arranca la simulación.",
  },
  {
    n: "04",
    title: "Analiza el comportamiento",
    body: "Transcripción, métricas, escenas clave y anotaciones sobre la grabación.",
  },
  {
    n: "05",
    title: "Entrega el informe",
    body: "Informe integrado en PDF (decisiones + evidencias) revisado y enviado por email.",
  },
];

function HowItWorks() {
  return (
    <section id="how" className="border-y border-border/60 bg-secondary/40">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <div className="max-w-2xl">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Cómo funciona</h2>
          <p className="mt-3 text-muted-foreground">
            De un prompt a una simulación grabada y evaluada, de principio a fin.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-5">
          {steps.map((s) => (
            <div key={s.n} className="rounded-2xl bg-card p-6 border border-border shadow-soft">
              <div className="text-sm font-bold text-primary">{s.n}</div>
              <h3 className="mt-2 font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const cases = [
  { tag: "RRHH", title: "Selección gamificada", body: "Assessment centers, entrevistas situacionales." },
  { tag: "Formación", title: "PRL & compliance", body: "Simulaciones realistas con feedback inmediato." },
  { tag: "Educación", title: "Medicina, derecho, idiomas", body: "Casos prácticos ramificados." },
  { tag: "Industria", title: "Resolución de problemas", body: "Lean, Six Sigma, cuellos de botella." },
];

function UseCases() {
  return (
    <section id="use-cases" className="mx-auto max-w-7xl px-6 py-24">
      <div className="max-w-2xl">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Casos de uso</h2>
        <p className="mt-3 text-muted-foreground">
          Aplicable a cualquier profesión o problema empresarial.
        </p>
      </div>
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {cases.map((c) => (
          <div key={c.title} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="text-xs font-semibold uppercase tracking-wider text-primary">{c.tag}</div>
            <h3 className="mt-2 font-semibold">{c.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{c.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="mx-auto max-w-5xl px-6 pb-24">
      <div className="rounded-3xl border border-border bg-gradient-to-br from-primary to-chart-4 p-10 md:p-14 text-center text-primary-foreground shadow-glow">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-balance">
          Crea tu primera simulación profesional hoy
        </h2>
        <p className="mt-3 opacity-90">
          Empieza gratis. Sin tarjeta. Comparte tu juego con candidatos o empleados en minutos.
        </p>
        <Link to="/auth" className="mt-8 inline-block">
          <Button size="lg" variant="secondary" className="gap-2">
            Empezar ahora <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/60 py-10 text-center text-sm text-muted-foreground">
      © {new Date().getFullYear()} Xandralyze. Interacción humana impulsada por IA.
    </footer>
  );
}
