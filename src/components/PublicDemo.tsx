import { useState } from "react";
import { ArrowRight, Play, RotateCcw, Star, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { demoCriteria, demoStars, demoStory } from "@/lib/public-demo";
import { resolveChoiceDestination, type Choice } from "@/lib/story-types";
import hotel from "@/assets/demo-hotel.jpg";
import video from "@/assets/demo-xandralyze.mp4.asset.json";
import webVideo from "@/assets/demo-xandralyze.webm.asset.json";
import poster from "@/assets/demo-xandralyze-poster.jpg.asset.json";

export function PublicDemo() {
  const [started, setStarted] = useState(false);
  const [currentId, setCurrentId] = useState(demoStory.startNodeId);
  const [answers, setAnswers] = useState<Choice[]>([]);
  const [ended, setEnded] = useState(false);
  const node = demoStory.nodes[currentId];
  const score = answers.reduce((sum, answer) => sum + answer.points, 0);

  function reset() {
    setStarted(false);
    setCurrentId(demoStory.startNodeId);
    setAnswers([]);
    setEnded(false);
  }

  function choose(choice: Choice) {
    setAnswers((previous) => [...previous, choice]);
    const destination = resolveChoiceDestination(choice);
    if (destination.kind === "scene" && destination.nodeId) setCurrentId(destination.nodeId);
    else setEnded(true);
  }

  return (
    <section id="demo" className="scroll-mt-20 border-y border-border bg-secondary/30">
      <div className="mx-auto max-w-7xl px-6 py-16 md:py-20">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-primary">Sin registro</p>
            <h2 className="mt-2 text-3xl font-bold md:text-4xl">Xandralyze en acción</h2>
          </div>
          <span className="text-sm text-muted-foreground">Demostración pública</span>
        </div>
        <div className="grid items-start gap-10 lg:grid-cols-2">
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xl font-semibold">Un recorrido por Xandralyze</h3>
              <span className="text-sm text-muted-foreground">3 min 20 s</span>
            </div>
            <video controls playsInline preload="none" poster={poster.url} className="aspect-video w-full rounded-lg bg-muted object-contain" aria-label="Vídeo de demostración de Xandralyze">
              <source src={webVideo.url} type="video/webm" />
              <source src={video.url} type="video/mp4" />
              <a href={video.url}>Ver el vídeo de demostración</a>
            </video>
          </div>
          <div className="min-w-0 space-y-4" aria-label="Simulación de ejemplo">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xl font-semibold">Un imprevisto en recepción</h3>
              <span className="text-sm text-muted-foreground">Atención al cliente · Ejemplo ficticio</span>
            </div>
            {!started ? (
              <>
                <img src={hotel} alt="Recepcionista atendiendo a un huésped en un hotel" width={1536} height={1024} loading="lazy" className="aspect-video w-full rounded-lg object-cover" />
                <Button onClick={() => setStarted(true)} className="gap-2"><Play /> Probar la simulación</Button>
              </>
            ) : (
              <div className="rounded-lg border border-border bg-card p-5 sm:p-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary"><Star className="h-4 w-4" /> {score} / 100 puntos</span>
                  <Button variant="ghost" size="sm" onClick={reset}><RotateCcw /> Reiniciar</Button>
                </div>
                {ended ? (
                  <div aria-live="polite" className="space-y-5">
                    <div className="flex items-center gap-3"><Trophy className="h-7 w-7 text-primary" /><h4 className="text-xl">Tu resultado</h4></div>
                    <div className="flex gap-2" aria-label={`${demoStars(score)} de 3 estrellas`}>
                      {[1, 2, 3].map((star) => <Star key={star} className={`h-7 w-7 ${star <= demoStars(score) ? "fill-warning text-warning" : "text-muted-foreground"}`} />)}
                    </div>
                    {demoCriteria.map((criterion) => {
                      const points = answers.reduce((sum, answer) => sum + (answer.competencies[criterion.key] ?? 0), 0);
                      return <div key={criterion.key}><div className="mb-2 flex justify-between text-sm"><span>{criterion.label}</span><span>{points} / 50</span></div><progress className="h-2 w-full accent-primary" value={points} max={50} aria-label={criterion.label} /></div>;
                    })}
                    <ul className="space-y-3 text-sm text-muted-foreground">{answers.map((answer) => <li key={answer.id}>{answer.feedback}</li>)}</ul>
                    <p className="border-t border-border pt-4 text-xs text-muted-foreground">Resultado ilustrativo de esta prueba; no es una evaluación profesional.</p>
                    <Button variant="outline" onClick={reset}><RotateCcw /> Volver a probar</Button>
                  </div>
                ) : node ? (
                  <div className="space-y-4" aria-live="polite">
                    <p className="text-xs font-medium text-muted-foreground">Decisión {answers.length + 1} de 2</p>
                    <h4 className="text-lg font-semibold">{node.title}</h4>
                    {answers.length > 0 && <p className="border-l-2 border-primary pl-3 text-sm text-muted-foreground">{answers[answers.length - 1]?.feedback}</p>}
                    <p className="text-sm leading-relaxed text-muted-foreground">{node.narrative}</p>
                    <p className="font-semibold">{node.question?.text}</p>
                    <div className="space-y-3">{node.question?.choices.map((choice) => <Button key={choice.id} variant="outline" onClick={() => choose(choice)} className="h-auto min-h-12 w-full justify-between whitespace-normal py-3 text-left"><span className="min-w-0">{choice.label}</span><ArrowRight className="shrink-0" /></Button>)}</div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}