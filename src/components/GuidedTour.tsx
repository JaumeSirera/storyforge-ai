import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  GitBranch,
  MonitorPlay,
  Video,
  BarChart3,
  FileText,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
} from "lucide-react";

type Step = {
  icon: typeof Sparkles;
  tag: string;
  title: string;
  body: string;
  bullets: string[];
  image?: string;
  alt?: string;
};

const steps: Step[] = [
  {
    icon: Sparkles,
    tag: "Paso 1 · Crear",
    title: "Describe el objetivo en una frase",
    body:
      "Escribes lo que quieres evaluar y la IA redacta la historia, las escenas, las preguntas y los criterios de evaluación.",
    bullets: ["Un prompt basta", "Guion y preguntas automáticas", "Competencias y rúbrica listas"],
  },
  {
    icon: GitBranch,
    tag: "Paso 2 · Ramificar",
    title: "Revisa el árbol de decisiones",
    body:
      "En el editor visual mueves, quitas o ajustas escenas y ramas con arrastrar y soltar hasta que el caso encaje.",
    bullets: ["Editor de ramificaciones", "Clips y retorno a la escena", "Voz y subtítulos"],
  },
  {
    icon: MonitorPlay,
    tag: "Paso 3 · Jugar",
    title: "El participante decide dentro del vídeo",
    body:
      "Cada respuesta lleva a otra escena o clip, con puntos, estrellas y feedback inmediato mientras juega.",
    bullets: ["Controles accesibles", "Puntuación por competencia", "Feedback al instante"],
  },
  {
    icon: Video,
    tag: "Paso 4 · Grabar",
    title: "Se graba la sesión con consentimiento",
    body:
      "Cámara y pantalla a la vez, en individual o en grupo, con un dispositivo o uno por participante y aceptación registrada.",
    bullets: ["Grabación continua y recuperable", "Mosaico multicámara", "Auditoría de consentimientos"],
  },
  {
    icon: BarChart3,
    tag: "Paso 5 · Analizar",
    title: "Comportamiento con evidencias temporales",
    body:
      "Transcripción con hablantes, participación, turnos e interrupciones, y escenas clave marcadas al segundo.",
    bullets: ["Película resumen", "Notas y etiquetas", "Comparativa entre sesiones"],
  },
  {
    icon: FileText,
    tag: "Paso 6 · Concluir",
    title: "Informe integrado listo para enviar",
    body:
      "Un documento cruza las decisiones del juego con la evidencia observable, con vista previa antes de enviarlo.",
    bullets: ["Decisiones + comportamiento", "PDF con tu marca", "Email automático al candidato"],
  },
];

export function GuidedTour() {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const step = steps[i]!;

  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => setI((p) => (p + 1) % steps.length), 6000);
    return () => clearTimeout(t);
  }, [i, playing]);

  const go = (n: number) => {
    setPlaying(false);
    setI((n + steps.length) % steps.length);
  };

  return (
    <section id="tour" className="border-y border-border/60 bg-secondary/20">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Tour guiado</h2>
            <p className="mt-3 text-muted-foreground">
              Del prompt al informe integrado en seis pasos. Avanza tú o deja que se reproduzca.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setPlaying((p) => !p)}
            aria-pressed={playing}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {playing ? "Pausar tour" : "Reproducir tour"}
          </Button>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[280px_1fr]">
          <ol className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible" aria-label="Pasos del tour">
            {steps.map((s, idx) => {
              const active = idx === i;
              return (
                <li key={s.title} className="shrink-0 lg:shrink">
                  <button
                    type="button"
                    onClick={() => go(idx)}
                    aria-current={active ? "step" : undefined}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${
                      active
                        ? "border-primary bg-card text-foreground shadow-soft"
                        : "border-border/60 bg-transparent text-muted-foreground hover:bg-card"
                    }`}
                  >
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                        active ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"
                      }`}
                    >
                      <s.icon className="h-4 w-4" />
                    </span>
                    <span className="whitespace-nowrap lg:whitespace-normal">
                      <span className="block text-[11px] font-semibold uppercase tracking-wider text-primary">
                        {s.tag}
                      </span>
                      {s.title}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          <div
            className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft"
            role="group"
            aria-live="polite"
          >
            {step.image && (
              <div className="border-b border-border/60 bg-secondary/30 p-3 sm:p-4">
                <img
                  key={step.image}
                  src={step.image}
                  alt={step.alt ?? step.title}
                  loading="lazy"
                  className="w-full rounded-2xl border border-border/60 shadow-soft"
                />
              </div>
            )}
            <div className="p-8">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent text-accent-foreground">
                  <step.icon className="h-6 w-6" />
                </span>
                <div className="text-xs font-semibold uppercase tracking-wider text-primary">{step.tag}</div>
              </div>
              <h3 className="mt-5 text-2xl font-bold tracking-tight text-balance">{step.title}</h3>
              <p className="mt-3 max-w-xl text-muted-foreground">{step.body}</p>
              <ul className="mt-6 grid gap-2 sm:grid-cols-3">
                {step.bullets.map((b) => (
                  <li
                    key={b}
                    className="rounded-xl border border-border/60 bg-secondary/40 px-3 py-2 text-sm text-muted-foreground"
                  >
                    {b}
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex items-center justify-between gap-4">
                <div className="flex gap-1.5" aria-hidden>
                  {steps.map((s, idx) => (
                    <span
                      key={s.title}
                      className={`h-1.5 rounded-full transition-all ${
                        idx === i ? "w-6 bg-primary" : "w-1.5 bg-border"
                      }`}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => go(i - 1)}>
                    <ChevronLeft className="h-4 w-4" /> Anterior
                  </Button>
                  <Button size="sm" className="gap-1" onClick={() => go(i + 1)}>
                    Siguiente <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
