import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Sparkles, Film, GitBranch, BarChart3, Award, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Playloop — Simulaciones profesionales gamificadas con IA" },
      {
        name: "description",
        content:
          "Convierte vídeos en juegos de evaluación con preguntas ramificadas, puntuación y feedback IA. Listo en minutos.",
      },
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
        <Link to="/" className="flex items-center gap-2 font-bold text-lg">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
          Playloop
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <a href="#features" className="hover:text-foreground">Funciones</a>
          <a href="#how" className="hover:text-foreground">Cómo funciona</a>
          <a href="#use-cases" className="hover:text-foreground">Casos de uso</a>
        </nav>
        <div className="flex items-center gap-2">
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
          Generador de simulaciones con IA
        </div>
        <h1 className="mt-6 text-balance text-5xl md:text-7xl font-bold tracking-tight">
          Convierte vídeos en{" "}
          <span className="bg-gradient-to-r from-primary to-chart-4 bg-clip-text text-transparent">
            simulaciones gamificadas
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
          Describe un objetivo profesional, sube o enlaza vídeos, y la IA genera la historia,
          las preguntas ramificadas, la puntuación y el informe final de evaluación.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link to="/auth">
            <Button size="lg" className="gap-2">
              Crear mi primera simulación <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <a href="#how">
            <Button size="lg" variant="outline">Ver cómo funciona</Button>
          </a>
        </div>
      </div>
    </section>
  );
}

const features = [
  {
    icon: Film,
    title: "Vídeo interactivo",
    body: "Soporta YouTube, Vimeo y MP4 subido. Controles completos: pausa, avance, retroceso.",
  },
  {
    icon: GitBranch,
    title: "Árbol de decisiones",
    body: "Cada respuesta lleva a otro vídeo o escena. Cientos de caminos posibles por simulación.",
  },
  {
    icon: Sparkles,
    title: "Generado por IA",
    body: "Guion, diálogos, preguntas, opciones y criterios de evaluación a partir de un prompt.",
  },
  {
    icon: Award,
    title: "Gamificación",
    body: "Puntos, estrellas, logros y competencias para motivar y medir.",
  },
  {
    icon: BarChart3,
    title: "Informe final IA",
    body: "Veredicto, fortalezas, áreas de mejora y puntuación por competencia.",
  },
];

function Features() {
  return (
    <section id="features" className="mx-auto max-w-7xl px-6 py-24">
      <div className="max-w-2xl">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
          Todo lo que necesitas para evaluar y formar
        </h2>
        <p className="mt-3 text-muted-foreground">
          Una plataforma para crear assessments interactivos sin necesidad de equipo técnico.
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
    title: "Aporta el guion y vídeos",
    body: "Pega el contexto y enlaza o sube los vídeos que ilustran las escenas.",
  },
  {
    n: "03",
    title: "La IA genera el juego",
    body: "Historia, escenas, preguntas con feedback, ramas y criterios de evaluación.",
  },
  {
    n: "04",
    title: "Juega y evalúa",
    body: "El participante avanza por las decisiones y al final recibe su informe.",
  },
];

function HowItWorks() {
  return (
    <section id="how" className="border-y border-border/60 bg-secondary/40">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <div className="max-w-2xl">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Cómo funciona</h2>
          <p className="mt-3 text-muted-foreground">De un prompt a una simulación lista en minutos.</p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
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
      © {new Date().getFullYear()} Playloop. Simulaciones profesionales con IA.
    </footer>
  );
}
