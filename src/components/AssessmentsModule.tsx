import {
  ScanText,
  ListChecks,
  ClipboardCheck,
  Timer,
  ShieldCheck,
  Users,
  BookOpen,
  Sparkles,
  Highlighter,
  FileSearch,
} from "lucide-react";

type Item = {
  icon: typeof ScanText;
  tag: string;
  title: string;
  body: string;
};

const items: Item[] = [
  {
    icon: Sparkles,
    tag: "Crear",
    title: "Preguntas generadas por IA",
    body:
      "A partir de un texto o de un temario, la IA redacta preguntas tipo test, respuesta corta y desarrollo, con su solución.",
  },
  {
    icon: BookOpen,
    tag: "Reutilizar",
    title: "Banco de preguntas",
    body:
      "Guarda, etiqueta y reutiliza preguntas entre evaluaciones, con generación masiva por área o dificultad.",
  },
  {
    icon: FileSearch,
    tag: "Verificar",
    title: "Validación contra el texto base",
    body:
      "Antes de publicar, la IA marca qué preguntas están realmente soportadas por el material y cuáles no.",
  },
  {
    icon: ScanText,
    tag: "Escanear",
    title: "Corrección de manuscritos",
    body:
      "Sube el examen escaneado y la IA transcribe, corrige y valora también el grafismo y la presentación.",
  },
  {
    icon: ListChecks,
    tag: "Medir",
    title: "Rúbricas y nota por competencia",
    body:
      "Define tus criterios y pesos: la nota se calcula por rúbrica, con feedback por pregunta según el tono elegido.",
  },
  {
    icon: Highlighter,
    tag: "Anotar",
    title: "Anotaciones sobre la entrega",
    body:
      "Marca y comenta directamente sobre las páginas escaneadas, y pide un nuevo OCR si el escaneo es de baja calidad.",
  },
  {
    icon: Users,
    tag: "Inscribir",
    title: "Aspirantes con enlace único",
    body:
      "Da de alta a los candidatos y cada uno recibe su acceso privado al examen, sin necesidad de crear cuenta.",
  },
  {
    icon: Timer,
    tag: "Examinar",
    title: "Examen con tiempo límite",
    body:
      "Cuenta atrás visible, reanudación si se recarga la página y envío automático al agotarse el tiempo.",
  },
  {
    icon: ShieldCheck,
    tag: "Auditar",
    title: "Log de entregas e intentos",
    body:
      "Fecha, hora, IP y navegador de cada inicio y entrega, con bloqueo tras finalizar e historial por aspirante.",
  },
  {
    icon: ClipboardCheck,
    tag: "Aprobar",
    title: "Roles de corrección",
    body:
      "Corrector, anotador, revisor y aprobador: cada colaborador solo hace lo que le corresponde antes de publicar la nota.",
  },
];

export function AssessmentsModule() {
  return (
    <section id="assessments" className="border-y border-border/60 bg-secondary/20">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <div className="max-w-2xl">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">Nuevo módulo</div>
          <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">
            Evaluaciones escritas con IA
          </h2>
          <p className="mt-3 text-muted-foreground">
            Del temario al examen corregido: preguntas generadas por IA, exámenes online con tiempo,
            corrección de manuscritos escaneados y nota con rúbrica auditada.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <article
              key={it.title}
              className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-soft transition hover:shadow-glow"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground">
                  <it.icon className="h-5 w-5" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">{it.tag}</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold">{it.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{it.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
