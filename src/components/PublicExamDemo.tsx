import { useState } from "react";
import { FileCheck2, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { examGrade, examLevel, examQuestion, examRubric, examSamples } from "@/lib/public-demo-exam";

export function PublicExamDemo() {
  const [sampleId, setSampleId] = useState(examSamples[0].id);
  const [graded, setGraded] = useState(false);
  const sample = examSamples.find((s) => s.id === sampleId) ?? examSamples[0];
  const grade = examGrade(sample);

  return (
    <section id="demo-evaluacion" className="scroll-mt-20 border-b border-border">
      <div className="mx-auto max-w-7xl px-6 py-16 md:py-20">
        <div className="mb-10">
          <p className="text-sm font-semibold text-primary">Sin registro</p>
          <h2 className="mt-2 text-3xl font-bold md:text-4xl">Prueba la corrección de exámenes</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">Elige un examen escaneado de ejemplo y mira cómo se corrige con una rúbrica: nota, evidencias, grafismo e informe.</p>
        </div>
        <div className="grid items-start gap-10 lg:grid-cols-2">
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Examen de ejemplo">
              {examSamples.map((s) => (
                <Button key={s.id} variant={s.id === sampleId ? "default" : "outline"} size="sm" onClick={() => { setSampleId(s.id); setGraded(false); }}>{s.student}</Button>
              ))}
            </div>
            <div className="rounded-lg border border-border bg-card p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pregunta · Historia, 4.º ESO</p>
              <p className="mt-1 text-sm font-medium">{examQuestion}</p>
              <p className="mt-4 border-l-2 border-primary/40 pl-4 font-serif text-base italic leading-relaxed">{sample.text}</p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="mb-2 text-sm font-semibold">Rúbrica</p>
              <ul className="space-y-1 text-sm text-muted-foreground">{examRubric.map((c) => <li key={c.key} className="flex justify-between"><span>{c.label}</span><span>{c.max} pt</span></li>)}</ul>
            </div>
          </div>
          <div className="min-w-0">
            {!graded ? (
              <div className="flex flex-col items-start gap-4 rounded-lg border border-dashed border-border p-8">
                <FileCheck2 className="h-10 w-10 text-primary" />
                <p className="text-muted-foreground">En la app subes fotos o escaneos del examen y la IA lo corrige con tu rúbrica. Aquí verás un resultado ya preparado.</p>
                <Button onClick={() => setGraded(true)} className="gap-2"><Sparkles /> Corregir examen</Button>
              </div>
            ) : (
              <div aria-live="polite" className="space-y-5 rounded-lg border border-border bg-card p-5 sm:p-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div><p className="text-sm text-muted-foreground">Nota final</p><p className="text-4xl font-bold text-primary">{grade.toLocaleString("es-ES")} <span className="text-lg text-muted-foreground">/ 10</span></p></div>
                  <span className="rounded-full bg-secondary px-3 py-1 text-sm font-semibold">{examLevel(grade)}</span>
                </div>
                {examRubric.map((c) => {
                  const pts = sample.scores[c.key] ?? 0;
                  return (
                    <div key={c.key}>
                      <div className="mb-1 flex justify-between text-sm"><span className="font-medium">{c.label}</span><span>{pts.toLocaleString("es-ES")} / {c.max}</span></div>
                      <progress className="h-2 w-full accent-primary" value={pts} max={c.max} aria-label={c.label} />
                      <p className="mt-1 text-xs text-muted-foreground">Evidencia: {sample.evidence[c.key]}</p>
                    </div>
                  );
                })}
                <div className="border-t border-border pt-4 text-sm"><p className="font-semibold">Grafismo</p><p className="text-muted-foreground">{sample.handwriting}</p></div>
                <div className="text-sm"><p className="font-semibold">Informe para el alumno</p><p className="text-muted-foreground">{sample.feedback}</p></div>
                <p className="text-xs text-muted-foreground">Ejemplo ilustrativo con textos ficticios.</p>
                <Button variant="outline" onClick={() => setGraded(false)}><RotateCcw /> Volver</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
