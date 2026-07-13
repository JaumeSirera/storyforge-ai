import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSession, submitAnswer, generateReport } from "@/lib/sessions.functions";
import { VideoPlayer } from "@/components/VideoPlayer";
import { nodeClips } from "@/lib/story-types";

import { VideoPrefetch, nextCandidateNodes } from "@/components/VideoPrefetch";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Star, Loader2, CheckCircle2, XCircle, Sparkles, Award, ArrowRight, Home, Maximize2, Minimize2, PanelTopOpen, Square } from "lucide-react";
import { computeSceneOrder } from "@/lib/scene-order";
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

  const sceneOrder = computeSceneOrder(story as any);
  const sceneNumber = sceneOrder.get(node.id);
  const nextNodes = nextCandidateNodes(story.nodes as any, node);

  return (
    <Player
      sessionId={id}
      node={node}
      score={sess.score}
      answered={answered}
      totalNodes={totalNodes}
      simTitle={sim.title}
      sceneNumber={sceneNumber}
      nextNodes={nextNodes}
    />
  );
}

function Player({
  sessionId, node, score, answered, totalNodes, simTitle, sceneNumber, nextNodes,
}: {
  sessionId: string; node: any; score: number; answered: number; totalNodes: number; simTitle: string; sceneNumber?: number; nextNodes: any[];
}) {
  const submit = useServerFn(submitAnswer);
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ feedback: string; points: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [windowed, setWindowed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(`session-windowed:${sessionId}`) === "1";
  });

  const prefKey = `session-fullscreen:${sessionId}`;

  // Device detection (client-only).
  const env = (() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return { isMobile: false, isIOS: false, supportsFs: false };
    }
    const ua = navigator.userAgent || "";
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
    const isAndroid = /Android/i.test(ua);
    const isMobile = isIOS || isAndroid || window.matchMedia("(pointer: coarse)").matches;
    const el = document.documentElement as any;
    const supportsFs =
      typeof el.requestFullscreen === "function" ||
      typeof el.webkitRequestFullscreen === "function";
    return { isMobile, isIOS, supportsFs };
  })();

  const wantsRestore =
    typeof window !== "undefined" && window.localStorage.getItem(prefKey) === "1";
  const [pendingRestore, setPendingRestore] = useState<boolean>(wantsRestore);

  useEffect(() => {
    const onChange = () =>
      setIsFullscreen(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange as any);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange as any);
    };
  }, []);

  async function requestFs() {
    const el = containerRef.current as any;
    if (!el) return;
    if (typeof el.requestFullscreen === "function") return el.requestFullscreen();
    if (typeof el.webkitRequestFullscreen === "function") return el.webkitRequestFullscreen();
    throw new Error("unsupported");
  }
  async function exitFs() {
    const d = document as any;
    if (typeof d.exitFullscreen === "function") return d.exitFullscreen();
    if (typeof d.webkitExitFullscreen === "function") return d.webkitExitFullscreen();
  }

  // Desktop: try silent restore. Mobile: always wait for the user gesture (banner/overlay).
  useEffect(() => {
    if (!pendingRestore) return;
    if (env.isMobile) return;
    requestFs().catch(() => {
      // Blocked — banner will prompt for a gesture.
    });
  }, [pendingRestore, env.isMobile]);

  async function toggleFullscreen() {
    try {
      if (!isFullscreen) {
        if (env.isIOS && !env.supportsFs) {
          // iOS Safari only allows fullscreen on <video>. Persist preference and
          // hint the user to use the native video fullscreen control.
          window.localStorage.setItem(prefKey, "1");
          setPendingRestore(false);
          toast.info("En iOS, toca el icono de pantalla completa del vídeo para ampliarlo.");
          return;
        }
        await requestFs();
        window.localStorage.setItem(prefKey, "1");
        setPendingRestore(false);
      } else {
        await exitFs();
        window.localStorage.removeItem(prefKey);
        setPendingRestore(false);
      }
    } catch (e: any) {
      toast.error("No se pudo activar pantalla completa");
    }
  }

  async function dismissRestore() {
    window.localStorage.removeItem(prefKey);
    setPendingRestore(false);
  }


  // Same-scene state: questions already answered here + a forced next question.
  const [sceneAnsweredIds, setSceneAnsweredIds] = useState<Set<string>>(new Set());
  const [forcedQId, setForcedQId] = useState<string | undefined>(undefined);
  // Target clip id when a choice jumps to a specific clip (may be same scene).
  const [pendingClipId, setPendingClipId] = useState<string | undefined>(undefined);
  const [clipJumpNonce, setClipJumpNonce] = useState(0);

  // Reset scene-local state whenever the active scene changes.
  useEffect(() => {
    setSceneAnsweredIds(new Set());
    setForcedQId(undefined);
    setPendingClipId(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id]);

  async function pick(choiceId: string, opts?: { commentText?: string }) {
    setSelected(choiceId);
    setSubmitting(true);
    try {
      const r = await submit({
        data: { sessionId, nodeId: node.id, choiceId, ...(opts?.commentText ? { commentText: opts.commentText } : {}) },
      });
      setFeedback({ feedback: r.feedback, points: r.pointsDelta });
      const stay = (r as any).stayInScene === true;
      const answeredQId = (r as any).answeredQuestionId as string | null | undefined;
      const forced = (r as any).forcedQuestionId as string | null | undefined;
      const nextClipId = (r as any).nextClipId as string | null | undefined;
      const nextNodeId = (r as any).nextNodeId as string | null | undefined;
      if (stay) {
        if (answeredQId) setSceneAnsweredIds((s) => new Set(s).add(answeredQId));
        setForcedQId(forced ?? undefined);
        // Short feedback flash, then keep the same scene.
        setTimeout(() => {
          setSelected(null);
          setFeedback(null);
        }, 1200);
      } else if (nextNodeId && nextNodeId === node.id) {
        // Same scene, jump to a specific clip.
        setPendingClipId(nextClipId ?? undefined);
        setClipJumpNonce((n) => n + 1);
        setSceneAnsweredIds(new Set());
        setForcedQId(undefined);
        setTimeout(() => {
          setSelected(null);
          setFeedback(null);
        }, 1200);
      } else {
        setPendingClipId(nextClipId ?? undefined);
        setTimeout(() => {
          qc.invalidateQueries({ queryKey: ["session", sessionId] });
          setSelected(null);
          setFeedback(null);
        }, 2400);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
      setSelected(null);
    } finally {
      setSubmitting(false);
    }
  }

  const progress = totalNodes > 0 ? Math.min(100, Math.round((answered / Math.max(1, totalNodes - 1)) * 100)) : 0;

  function toggleWindowed() {
    setWindowed((w) => {
      const next = !w;
      try {
        if (next) window.localStorage.setItem(`session-windowed:${sessionId}`, "1");
        else window.localStorage.removeItem(`session-windowed:${sessionId}`);
      } catch {}
      return next;
    });
  }

  // ============ Immersive mode (default) ============
  if (!windowed) {
    return (
      <div
        ref={containerRef}
        className="fixed inset-0 z-40 bg-black text-white overflow-hidden"
      >
        <ScenePlayback
          key={`${node.id}:${clipJumpNonce}`}
          immersive
          node={node}
          submitting={submitting}
          feedback={feedback}
          selected={selected}
          onPick={pick}
          nextNodes={nextNodes}
          answeredIds={sceneAnsweredIds}
          forcedQId={forcedQId}
          initialClipId={pendingClipId}
        />

        {/* Top bar overlay */}
        <div className="absolute top-0 inset-x-0 z-30 flex items-start justify-between gap-3 px-4 pt-4 pb-8 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none">
          <div className="min-w-0 pointer-events-auto">
            <div className="text-[11px] uppercase tracking-wider text-white/70 drop-shadow">
              {simTitle}{sceneNumber ? ` · Escena ${sceneNumber}` : ""}
            </div>
            <h1 className="text-lg md:text-2xl font-bold truncate text-white drop-shadow">
              {node.title}
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0 pointer-events-auto">
            <Badge
              variant="secondary"
              className="gap-1 bg-black/50 text-white border border-white/20 backdrop-blur-md"
            >
              <Trophy className="h-3 w-3" /> {score} pts
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleWindowed}
              className="gap-1 bg-black/40 text-white border-white/30 hover:bg-black/60 hover:text-white backdrop-blur-md"
              aria-label="Modo ventana"
            >
              <PanelTopOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Ventana</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleFullscreen}
              className="gap-1 bg-black/40 text-white border-white/30 hover:bg-black/60 hover:text-white backdrop-blur-md"
              aria-label={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <Progress value={progress} className="absolute top-0 inset-x-0 h-1 z-40 rounded-none bg-white/10" />

        {pendingRestore && !isFullscreen && env.isMobile && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 grid place-items-center bg-background/95 p-6 backdrop-blur-sm text-foreground"
          >
            <div className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6 text-center shadow-glow">
              <Maximize2 className="mx-auto h-10 w-10 text-primary" />
              <div>
                <h2 className="text-lg font-bold">Restaurar pantalla completa</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {env.isIOS && !env.supportsFs
                    ? "En iOS, usa el icono de pantalla completa del reproductor de vídeo para ampliar la escena."
                    : "Tu navegador móvil necesita un toque para volver al modo inmersivo."}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Button type="button" onClick={toggleFullscreen} className="w-full gap-2" size="lg">
                  <Maximize2 className="h-5 w-5" /> Activar pantalla completa
                </Button>
                <Button type="button" variant="ghost" onClick={dismissRestore} className="w-full">
                  Continuar sin pantalla completa
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============ Windowed mode ============
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
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{simTitle}{sceneNumber ? ` · Escena ${sceneNumber}` : ""}</div>
          <h1 className="text-2xl font-bold mt-0.5 truncate">{node.title}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="secondary" className="gap-1"><Trophy className="h-3 w-3" /> {score} pts</Badge>
          <Button type="button" variant="outline" size="sm" onClick={toggleWindowed} className="gap-1" aria-label="Modo inmersivo">
            <Maximize2 className="h-4 w-4" />
            <span className="hidden sm:inline">Inmersivo</span>
          </Button>
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

      {pendingRestore && !isFullscreen && !env.isMobile && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-accent/40 px-3 py-2 text-sm">
          <span>Esta sesión estaba en pantalla completa. ¿Restaurar?</span>
          <div className="flex gap-2 shrink-0">
            <Button type="button" size="sm" variant="ghost" onClick={dismissRestore}>No, seguir así</Button>
            <Button type="button" size="sm" onClick={toggleFullscreen} className="gap-1">
              <Maximize2 className="h-4 w-4" /> Restaurar
            </Button>
          </div>
        </div>
      )}

      <Progress value={progress} className="h-1.5" />

      <ScenePlayback key={`${node.id}:${clipJumpNonce}`} node={node} submitting={submitting} feedback={feedback} selected={selected} onPick={pick} nextNodes={nextNodes} answeredIds={sceneAnsweredIds} forcedQId={forcedQId} initialClipId={pendingClipId} />
    </div>
    </div>
  );
}

function ScenePlayback({
  node, submitting, feedback, selected, onPick, nextNodes, immersive, answeredIds, forcedQId, initialClipId,
}: {
  node: any;
  submitting: boolean;
  feedback: { feedback: string; points: number } | null;
  selected: string | null;
  onPick: (id: string, opts?: { commentText?: string }) => void;
  nextNodes: any[];
  immersive?: boolean;
  answeredIds?: Set<string>;
  forcedQId?: string;
  initialClipId?: string;
}) {
  const clips = nodeClips(node);
  const [activeClipId, setActiveClipId] = useState<string>(() => {
    if (initialClipId && clips.some((c) => c.id === initialClipId)) return initialClipId;
    return clips[0]?.id ?? "default";
  });
  const [commentText, setCommentText] = useState("");
  // Reset active clip when the scene changes.
  useEffect(() => {
    setActiveClipId(clips[0]?.id ?? "default");
    setCommentText("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id]);

  // Local activeQuestion honouring answered/forced state.
  const qs = (node.questions && node.questions.length > 0)
    ? node.questions
    : (node.question ? [node.question] : []);
  const notAnswered = qs.filter((qq: any) => !(qq.id && answeredIds?.has(qq.id)));
  let q: any = undefined;
  if (forcedQId) {
    const forced = qs.find((qq: any) => qq.id === forcedQId);
    if (forced && !(forced.id && answeredIds?.has(forced.id))) q = forced;
  }
  if (!q) {
    const tied = notAnswered.find((qq: any) => qq.clipId === activeClipId);
    q = tied ?? notAnswered.find((qq: any) => !qq.clipId) ?? notAnswered[0];
  }
  const kind: "question" | "comment" | "goto" = (q?.kind as any) ?? "question";
  const trig = q?.triggerAt ?? { mode: "immediate" as const };
  const [questionReady, setQuestionReady] = useState(trig.mode === "immediate");

  // Reset readiness whenever the active question/clip/scene changes.
  useEffect(() => {
    if (forcedQId && q?.id === forcedQId) {
      setQuestionReady(true);
    } else {
      setQuestionReady((q?.triggerAt?.mode ?? "immediate") === "immediate");
    }
    setCommentText("");
  }, [node.id, activeClipId, q?.id, q?.triggerAt?.mode, forcedQId]);

  const pauseAtSec =
    !questionReady && trig.mode === "time" ? trig.seconds : undefined;

  // Auto-submit for goto prompts when ready.
  const autoFiredRef = useRef<string | null>(null);
  useEffect(() => {
    if (kind !== "goto" || !questionReady || feedback || submitting) return;
    const c = q?.choices?.[0];
    if (!c) return;
    const key = `${node.id}:${q?.id ?? ""}:${c.id}`;
    if (autoFiredRef.current === key) return;
    autoFiredRef.current = key;
    onPick(c.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, questionReady, q?.id, node.id]);


  if (immersive) {
    return (
      <>
        <VideoPlayer
          fill
          video={node.video}
          videos={node.videos}
          activeClipId={activeClipId}
          onActiveClipChange={setActiveClipId}
          pauseAtSec={pauseAtSec}
          onPauseAtTime={() => setQuestionReady(true)}
          onEnded={() => { if (trig.mode === "end") setQuestionReady(true); }}
        />
        <VideoPrefetch nodes={nextNodes} />

        {/* Bottom overlay: narrative + question + answers */}
        <div className="absolute inset-x-0 bottom-0 z-20 max-h-[65%] overflow-y-auto p-4 sm:p-6 pt-16 bg-gradient-to-t from-black/85 via-black/65 to-transparent text-white">
          <div className="mx-auto max-w-4xl space-y-4">
            {node.narrative && (
              <p className="text-sm md:text-base leading-relaxed text-white/95 drop-shadow">
                {node.narrative}
              </p>
            )}







            {q && questionReady && !feedback && kind === "question" && (
              <div className="space-y-3">
                <h3 className="font-semibold text-base md:text-lg text-white drop-shadow">
                  {q.text}
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {q.choices.map((c: any) => (
                    <button
                      key={c.id}
                      disabled={submitting}
                      onClick={() => onPick(c.id)}
                      className={`text-left rounded-xl border-2 p-4 transition backdrop-blur-md shadow-lg text-white ${
                        selected === c.id
                          ? "border-primary bg-primary/40"
                          : "border-white/30 bg-black/50 hover:border-primary hover:bg-primary/30"
                      } disabled:opacity-60`}
                    >
                      <div className="font-medium drop-shadow">{c.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {q && questionReady && !feedback && kind === "comment" && q.choices[0] && (
              <div className="space-y-3">
                <h3 className="font-semibold text-base md:text-lg text-white drop-shadow">{q.text}</h3>
                <Textarea
                  rows={4}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Escribe tu respuesta..."
                  className="bg-white/10 border-white/30 text-white placeholder:text-white/60 backdrop-blur-md"
                />
                <div className="flex justify-end">
                  <Button
                    disabled={submitting || !commentText.trim()}
                    onClick={() => onPick(q.choices[0].id, { commentText: commentText.trim() })}
                  >
                    Enviar comentario
                  </Button>
                </div>
              </div>
            )}

          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <VideoPlayer
        video={node.video}
        videos={node.videos}
        activeClipId={activeClipId}
        onActiveClipChange={setActiveClipId}
        pauseAtSec={pauseAtSec}
        onPauseAtTime={() => setQuestionReady(true)}
        onEnded={() => {
          if (trig.mode === "end") setQuestionReady(true);
        }}
      />
      <VideoPrefetch nodes={nextNodes} />

      <Card>
        <CardContent className="pt-6">
          <p className="text-sm md:text-base leading-relaxed">{node.narrative}</p>
        </CardContent>
      </Card>







      {q && questionReady && !feedback && kind === "question" && (
        <div className="space-y-3">
          <h3 className="font-semibold text-lg">{q.text}</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {q.choices.map((c: any) => (
              <button
                key={c.id}
                disabled={submitting}
                onClick={() => onPick(c.id)}
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

      {q && questionReady && !feedback && kind === "comment" && q.choices[0] && (
        <div className="space-y-3">
          <h3 className="font-semibold text-lg">{q.text}</h3>
          <Textarea
            rows={4}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Escribe tu respuesta..."
          />
          <div className="flex justify-end">
            <Button
              disabled={submitting || !commentText.trim()}
              onClick={() => onPick(q.choices[0].id, { commentText: commentText.trim() })}
            >
              Enviar comentario
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function formatMmSs(total: number): string {
  const s = Math.max(0, Math.round(total));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
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
