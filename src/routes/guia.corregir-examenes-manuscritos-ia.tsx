import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo-xandralyze.png";

const url = "https://xandralyze.com/guia/corregir-examenes-manuscritos-ia";
const title = "Cómo corregir exámenes manuscritos con IA paso a paso | Xandralyze";
const description = "Guía práctica para corregir exámenes escritos a mano con IA: escaneo, lector OCR, rúbrica por competencias, revisión del docente y comentario para el alumno.";

export const Route = createFileRoute("/guia/corregir-examenes-manuscritos-ia")({
  head: () => ({
    meta: [
      { title }, { name: "description", content: description },
      { property: "og:title", content: title }, { property: "og:description", content: description },
      { property: "og:type", content: "article" }, { property: "og:url", content: url },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: url }],
  }),
  component: GuidePage,
});

const steps: [string, string][] = [
  ["Escanea o fotografía los exámenes", "Usa buena luz, la hoja entera en el encuadre y sin sombras. Un escáner o una foto nítida del móvil sirven. Si el examen tiene varias páginas, súbelas en orden."],
  ["Deja que el lector OCR transcriba la letra", "La IA convierte la escritura a mano en texto. Revisa la transcripción en las palabras dudosas antes de corregir: una letra mal leída puede cambiar la nota."],
  ["Define la rúbrica por competencias", "Indica los criterios (contenido, argumentación, expresión, ortografía…) y cuántos puntos vale cada uno. Cuanto más concreta sea la rúbrica, más coherente será la corrección."],
  ["Revisa la propuesta de nota", "La IA propone una puntuación por criterio con su justificación y las evidencias del texto. Tú decides: ajusta lo que no compartas. La IA asiste, no sustituye al docente."],
  ["Entrega el comentario al alumno", "Cada examen genera un comentario con puntos fuertes y aspectos a mejorar, listo para compartir, y un informe que puedes guardar."],
];

const tips = [
  "Corrige primero 2 o 3 exámenes a mano y compara: así compruebas que la rúbrica funciona.",
  "Las faltas de ortografía se detectan solo si la rúbrica las incluye como criterio.",
  "Con letra muy difícil o tachones, revisa siempre la transcripción.",
  "Xandralyze es gratis y de código abierto; la IA usa tu propia clave, y el coste depende del proveedor que elijas.",
];

function GuidePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold"><img src={logo} alt="" width={36} height={36} className="h-9 w-9 object-contain" />Xandralyze</Link>
          <Link to="/educacion" className="text-sm text-muted-foreground hover:text-foreground">Educación</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-14">
        <p className="text-sm font-semibold text-primary">Guía · Evaluaciones escritas</p>
        <h1 className="mt-4 text-balance text-4xl font-bold leading-tight tracking-normal">Cómo corregir exámenes manuscritos con IA paso a paso</h1>
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">Corregir exámenes en papel lleva horas. Con un lector OCR y una rúbrica por competencias, la IA puede proponerte la nota y un comentario por alumno, y tú solo revisas. Así se hace.</p>

        <h2 className="mt-12 text-2xl tracking-normal">Los 5 pasos</h2>
        <ol className="mt-6 space-y-8">
          {steps.map(([h, p], i) => (
            <li key={h}>
              <h3 className="text-xl tracking-normal"><span className="text-primary">{i + 1}.</span> {h}</h3>
              <p className="mt-2 leading-relaxed text-muted-foreground">{p}</p>
            </li>
          ))}
        </ol>

        <h2 className="mt-12 text-2xl tracking-normal">Consejos para una corrección fiable</h2>
        <ul className="mt-4 list-disc space-y-2 pl-6 text-muted-foreground">{tips.map((t) => <li key={t}>{t}</li>)}</ul>

        <h2 className="mt-12 text-2xl tracking-normal">Pruébalo sin registrarte</h2>
        <p className="mt-3 text-muted-foreground">En la página de educación hay dos exámenes de ejemplo que puedes corregir al momento, sin cuenta.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild size="lg"><a href="/educacion#demo-evaluacion">Probar la corrección<ArrowRight /></a></Button>
          <Button asChild variant="outline" size="lg"><Link to="/auth">Crear cuenta gratis</Link></Button>
        </div>
      </main>
    </div>
  );
}
