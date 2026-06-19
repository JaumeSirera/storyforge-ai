import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSession, submitAnswer, generateReport } from "@/lib/sessions.functions";
import { VideoPlayer } from "@/components/VideoPlayer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Star, Loader2, CheckCircle2, XCircle, Sparkles, Award, ArrowRight, Home, Maximize2, Minimize2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/sessions/$id")({
  component: PlayerPage,
});

function PlayerPage() {
  const { id } = Route.useParams();
  const get = useServerFn(getSession);
  const session = useQuery({ queryKey: ["session", id], queryFn: () => get({ data: { id } }) });

  if (session.isLoading) {
    return <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!session.data) return <p>Sesión no encontrada.</p>;

  const sess = session.data as any;
  const sim = sess.simulation;
  const story = sim.story as { nodes: Record<string, any>; startNodeId: string };
  const totalNodes = Object.keys(story.nodes).length;
  const answered = (sess.answers as any[]).length;
  const isComplete = !!sess.completed_at || !sess.current_node_id;

  if (isComplete) {
    return <FinalReport sessionId={id} sess={sess} sim={sim} />;
  }

  const node = story.nodes[sess.current_node_id!];
  if (!node) return <p>Nodo no encontrado.</p>;

  return (
    <Player
      sessionId={id}
      node={node}
      score={sess.score}
      answered={answered}
      totalNodes={totalNodes}
      simTitle={sim.title}
    />
  );
}

function Player({
  sessionId, node, score, answered, totalNodes, simTitle,
}: {
  sessionId: string; node: any; score: number; answered: number; totalNodes: number; simTitle: string;
}) {
  const submit = useServerFn(submitAnswer);
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ feedback: string; points: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (e: any) {
      toast.error("No se pudo activar pantalla completa");
    }
  }

  async function pick(choiceId: string) {
    setSelected(choiceId);
    setSubmitting(true);
    try {
      const r = await submit({ data: { sessionId, nodeId: node.id, choiceId } });
      setFeedback({ feedback: r.feedback, points: r.pointsDelta });
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["session", sessionId] });
        setSelected(null);
        setFeedback(null);
      }, 2400);
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
      setSelected(null);
    } finally {
      setSubmitting(false);
    }
  }

  const progress = totalNodes > 0 ? Math.min(100, Math.round((answered / Math.max(1, totalNodes - 1)) * 100)) : 0;

  return (
    <div
      ref={containerRef}
      className={
        isFullscreen
          ? "bg-background overflow-auto h-screen w-screen p-6"
          : ""
      }
    >
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{simTitle}</div>
          <h1 className="text-2xl font-bold mt-0.5 truncate">{node.title}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="secondary" className="gap-1"><Trophy className="h-3 w-3" /> {score} pts</Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleFullscreen}
            className="gap-1"
            aria-label={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            <span className="hidden sm:inline">{isFullscreen ? "Salir" : "Pantalla completa"}</span>
          </Button>
        </div>
      </div>

      <Progress value={progress} className="h-1.5" />

      <VideoPlayer video={node.video} />

      <Card>
        <CardContent className="pt-6">
          <p className="text-sm md:text-base leading-relaxed">{node.narrative}</p>
        </CardContent>
      </Card>

      {feedback && (
        <Card className="border-primary/40 bg-accent/40">
          <CardContent className="pt-6 flex items-start gap-3">
            {feedback.points >= 0 ? (
              <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
            ) : (
              <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-semibold">
                {feedback.points >= 0 ? "+" : ""}{feedback.points} puntos
              </div>
              <p className="text-sm text-muted-foreground mt-1">{feedback.feedback}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {node.question && !feedback && (
        <div className="space-y-3">
          <h3 className="font-semibold text-lg">{node.question.text}</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {node.question.choices.map((c: any) => (
              <button
                key={c.id}
                disabled={submitting}
                onClick={() => pick(c.id)}
                className={`text-left rounded-xl border-2 p-4 transition shadow-soft hover:border-primary hover:bg-accent ${
                  selected === c.id ? "border-primary bg-accent" : "border-border bg-card"
                } disabled:opacity-60`}
              >
                <div className="font-medium">{c.label}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
    </div>
  );
}

function FinalReport({ sessionId, sess, sim }: { sessionId: string; sess: any; sim: any }) {
  const gen = useServerFn(generateReport);
  const report = useQuery({
    queryKey: ["report", sessionId],
    queryFn: () => gen({ data: { sessionId } }),
  });
  const navigate = useNavigate();

  if (report.isLoading) {
    return (
      <div className="grid place-items-center py-20 text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div>
          <div className="font-semibold">Generando tu informe con IA...</div>
          <div className="text-sm text-muted-foreground">Analizando tus decisiones.</div>
        </div>
      </div>
    );
  }
  if (!report.data) return <p>Error generando informe.</p>;

  const r = report.data as any;
  const competencies = Object.entries(r.competencyScores ?? {}) as [string, number][];
  const criteriaMap = new Map((sim.evaluation_criteria as any[]).map((c) => [c.key, c.label]));
  const outcomeColor =
    r.outcome === "apto" ? "bg-success text-success-foreground"
    : r.outcome === "apto_con_reservas" ? "bg-warning text-warning-foreground"
    : "bg-destructive text-destructive-foreground";
  const outcomeLabel =
    r.outcome === "apto" ? "APTO"
    : r.outcome === "apto_con_reservas" ? "APTO CON RESERVAS" : "NO APTO";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="shadow-glow overflow-hidden">
        <div className="bg-gradient-to-br from-primary to-chart-4 text-primary-foreground p-8 text-center">
          <Sparkles className="h-8 w-8 mx-auto opacity-80" />
          <h1 className="text-3xl font-bold mt-3">{sim.title}</h1>
          <p className="opacity-80 mt-1">Informe de evaluación</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-6">
            <div>
              <div className="text-5xl font-bold">{r.finalScore}</div>
              <div className="text-xs opacity-80 mt-1">PUNTOS</div>
            </div>
            <div>
              <div className="flex items-center gap-1 text-3xl">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`h-7 w-7 ${i < r.stars ? "fill-warning text-warning" : "text-primary-foreground/30"}`} />
                ))}
              </div>
              <div className="text-xs opacity-80 mt-1 text-center">ESTRELLAS</div>
            </div>
            <div>
              <span className={`inline-block rounded-full px-4 py-2 font-bold ${outcomeColor}`}>{outcomeLabel}</span>
            </div>
          </div>
        </div>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-2">Resumen</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{r.summary}</p>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-4 w-4 text-success" /> Fortalezas
            </h3>
            <ul className="space-y-2 text-sm">
              {r.strengths.map((s: string, i: number) => (
                <li key={i} className="flex gap-2"><span className="text-success">✓</span>{s}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold flex items-center gap-2 mb-3">
              <ArrowRight className="h-4 w-4 text-warning" /> Áreas de mejora
            </h3>
            <ul className="space-y-2 text-sm">
              {r.improvements.map((s: string, i: number) => (
                <li key={i} className="flex gap-2"><span className="text-warning">→</span>{s}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-3">Competencias evaluadas</h3>
          <div className="space-y-3">
            {competencies.map(([k, v]) => {
              const pct = Math.max(0, Math.min(100, 50 + v));
              return (
                <div key={k}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{criteriaMap.get(k) ?? k}</span>
                    <span className="font-medium">{v >= 0 ? "+" : ""}{v}</span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {r.achievements?.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold flex items-center gap-2 mb-3"><Award className="h-4 w-4 text-primary" /> Logros desbloqueados</h3>
            <div className="flex flex-wrap gap-2">
              {r.achievements.map((a: string, i: number) => (
                <Badge key={i} className="px-3 py-1">{a}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-3">Tus decisiones</h3>
          <ol className="space-y-3 text-sm">
            {(sess.answers as any[]).map((a, i) => (
              <li key={i} className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground">Escena {i + 1} · {a.nodeTitle}</div>
                <div className="mt-1 font-medium">{a.question}</div>
                <div className="mt-1">→ {a.choiceLabel} <span className="text-muted-foreground">({a.points >= 0 ? "+" : ""}{a.points} pts)</span></div>
                <div className="mt-1 text-muted-foreground italic">{a.feedback}</div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <div className="flex justify-center gap-3">
        <Button variant="outline" onClick={() => navigate({ to: "/app/dashboard" })} className="gap-2">
          <Home className="h-4 w-4" /> Volver al inicio
        </Button>
      </div>
    </div>
  );
}
