import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { VideoPlayer } from "@/components/VideoPlayer";
import { VideoPrefetch, nextCandidateNodes } from "@/components/VideoPrefetch";
import { ArrowLeft, RotateCcw, Star, Trophy, Flag, AlertTriangle, Save, Loader2, ArrowRight } from "lucide-react";
import type { Story, StoryNode, Choice, EvaluationCriterion, Question } from "@/lib/story-types";
import { nodeClips, nodeQuestions, resolveChoiceDestination } from "@/lib/story-types";

import { computeSceneOrder } from "@/lib/scene-order";

export interface PreviewDraftPayload {
  currentNodeId: string | null;
  score: number;
  competencyScores: Record<string, number>;
  answers: Array<{
    nodeId: string;
    nodeTitle: string;
    question: string;
    choiceId: string;
    choiceLabel: string;
    points: number;
    feedback: string;
  }>;
}

interface Props {
  story: Story;
  criteria: EvaluationCriterion[];
  onSaveDraft?: (payload: PreviewDraftPayload) => Promise<void> | void;
  savingDraft?: boolean;
}

interface HistoryEntry {
  nodeId: string;
  nodeTitle: string;
  question: string;
  choiceId: string;
  choiceLabel: string;
  feedback: string;
  points: number;
  competencies: Record<string, number>;
}

export function StoryPreview({ story, criteria, onSaveDraft, savingDraft }: Props) {
  const nodes = story.nodes;
  const startId = story.startNodeId;
  const [currentId, setCurrentId] = useState<string | null>(startId);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [score, setScore] = useState(0);
  const [competencies, setCompetencies] = useState<Record<string, number>>({});
  const [lastFeedback, setLastFeedback] = useState<{ text: string; points: number } | null>(null);
  const [ended, setEnded] = useState(false);
  const [activeClipId, setActiveClipId] = useState<string | undefined>(undefined);
  const [questionReady, setQuestionReady] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(new Set());
  const [forcedQId, setForcedQId] = useState<string | undefined>(undefined);
  // Branch return: when a choice jumps to a specific clip, remember the origin
  // so we can return once the branched clip finishes.
  const [branchReturn, setBranchReturn] = useState<{
    nodeId: string;
    clipId?: string;
    branchNodeId: string;
    branchClipId: string;
    originTime: number;
  } | null>(null);
  const [branchClipEnded, setBranchClipEnded] = useState(false);
  const [branchCountdown, setBranchCountdown] = useState(0);
  const [resumeAt, setResumeAt] = useState<number | undefined>(undefined);

  // Latest reported currentTime of the active clip (for branch-return resume).
  const currentTimeRef = useRef(0);
  const autoGotoRef = useRef<string | null>(null);





  const errors = useMemo(() => validateStory(story), [story]);
  const sceneOrder = useMemo(() => computeSceneOrder(story), [story]);

  const node: StoryNode | undefined = currentId ? nodes[currentId] : undefined;

  const reset = () => {
    setCurrentId(startId);
    setHistory([]);
    setScore(0);
    setCompetencies({});
    setLastFeedback(null);
    setEnded(false);
    setActiveClipId(undefined);
    setCommentText("");
    setAnsweredIds(new Set());
    setForcedQId(undefined);
    setBranchReturn(null);
    setBranchClipEnded(false);
    setBranchCountdown(0);

    autoGotoRef.current = null;
  };

  const resolveBranchReturn = () => {
    if (!branchReturn) return;
    setResumeAt(branchReturn.originTime > 0 ? branchReturn.originTime : undefined);
    setCurrentId(branchReturn.nodeId);
    setActiveClipId(branchReturn.clipId);
    setBranchReturn(null);
    setBranchClipEnded(false);
    setBranchCountdown(0);
    setLastFeedback(null);
  };


  // Countdown + auto-return when the branched clip finishes.
  useEffect(() => {
    if (!branchReturn || !branchClipEnded) return;
    setBranchCountdown(4);
    const iv = window.setInterval(() => {
      setBranchCountdown((n) => (n > 0 ? n - 1 : 0));
    }, 1000);
    const to = window.setTimeout(() => {
      resolveBranchReturn();
    }, 4000);
    return () => {
      window.clearInterval(iv);
      window.clearTimeout(to);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchReturn?.branchNodeId, branchReturn?.branchClipId, branchClipEnded]);



  // Local activeQuestion honouring answered/forced state.
  const q: Question | undefined = useMemo(() => {
    if (!node) return undefined;
    const qs = nodeQuestions(node);
    if (qs.length === 0) return undefined;
    const notAnswered = qs.filter((qq) => !(qq.id && answeredIds.has(qq.id)));
    if (forcedQId) {
      const forced = qs.find((qq) => qq.id === forcedQId);
      if (forced && !(forced.id && answeredIds.has(forced.id))) return forced;
    }
    if (activeClipId) {
      const tied = notAnswered.find((qq) => qq.clipId === activeClipId);
      if (tied) return tied;
    }
    return notAnswered.find((qq) => !qq.clipId) ?? notAnswered[0];
  }, [node, activeClipId, answeredIds, forcedQId]);

  const trig = q?.triggerAt ?? { mode: "immediate" as const };

  // Reset readiness when the active question/clip/scene changes.
  useEffect(() => {
    // A forced question ignores its trigger and shows immediately.
    if (forcedQId && q?.id === forcedQId) {
      setQuestionReady(true);
      return;
    }
    setQuestionReady((q?.triggerAt?.mode ?? "immediate") === "immediate");
  }, [node?.id, activeClipId, q?.id, q?.triggerAt?.mode, forcedQId]);

  // Reset per-scene state when the node changes.
  useEffect(() => {
    setAnsweredIds(new Set());
    setForcedQId(undefined);
  }, [node?.id]);

  const pauseAtSec =
    !questionReady && trig.mode === "time" ? trig.seconds : undefined;

  // Reset comment text when the prompt changes.
  useEffect(() => {
    setCommentText("");
  }, [node?.id, activeClipId, q?.id]);

  // Auto-advance for "goto" prompts as soon as they become ready.
  useEffect(() => {
    if (!node || node.isEnding || ended) return;
    
    if (!q || (q.kind ?? "question") !== "goto") return;
    if (!questionReady) return;

    const c = q.choices[0];
    if (!c) return;
    const key = `${node.id}:${q.id ?? ""}:${c.id}`;
    if (autoGotoRef.current === key) return;
    autoGotoRef.current = key;
    choose(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.id, q?.id, q?.kind, questionReady, ended]);




  const choose = (c: Choice, opts?: { commentText?: string }) => {
    if (!node || !q) return;
    const kind = q.kind ?? "question";
    setHistory((h) => [...h, {
      nodeId: node.id,
      nodeTitle: node.title,
      question: q.text,
      choiceId: c.id,
      choiceLabel: kind === "comment" ? (opts?.commentText ?? "") : c.label,
      feedback: c.feedback,
      points: c.points,
      competencies: { ...(c.competencies ?? {}) },
    }]);
    setScore((s) => s + c.points);
    setCompetencies((m) => {
      const next = { ...m };
      for (const [k, v] of Object.entries(c.competencies ?? {})) {
        next[k] = (next[k] ?? 0) + v;
      }
      return next;
    });
    setLastFeedback({ text: c.feedback, points: c.points });
    applyDestination(c);
  };

  const applyDestination = (c: Choice) => {
    const dest = resolveChoiceDestination(c);
    if (dest.kind === "end") {
      setEnded(true);
      return;
    }
    if (dest.kind === "scene" && dest.nodeId && nodes[dest.nodeId]) {
      // If the destination pins a specific clip AND we aren't already ending,
      // remember origin so we can return after the branch clip ends.
      if (dest.clipId && !nodes[dest.nodeId].isEnding && node) {
        const originClipId = activeClipId ?? nodeClips(node)[0]?.id;
        setBranchReturn({
          nodeId: node.id,
          clipId: originClipId,
          branchNodeId: dest.nodeId,
          branchClipId: dest.clipId,
          originTime: currentTimeRef.current,
        });

        setBranchClipEnded(false);
      }
      setCurrentId(dest.nodeId);
      setActiveClipId(dest.clipId);
      if (nodes[dest.nodeId].isEnding) setEnded(true);
      return;
    }

    if (dest.kind === "continue") {
      if (q?.id) setAnsweredIds((s) => new Set(s).add(q.id!));
      setForcedQId(undefined);
      setQuestionReady(false);
      return;
    }
    if (dest.kind === "question") {
      if (q?.id) setAnsweredIds((s) => new Set(s).add(q.id!));
      setForcedQId(dest.questionId);
      setQuestionReady(true);
      return;
    }
    if (c.next && nodes[c.next]) {
      setCurrentId(c.next);
      setActiveClipId(undefined);
      if (nodes[c.next].isEnding) setEnded(true);
    } else {
      setEnded(true);
    }
  };




  const goBack = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setScore((s) => s - last.points);
    setCurrentId(last.nodeId);
    setLastFeedback(null);
    setEnded(false);
  };

  if (errors.length > 0) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-2">
        <div className="flex items-center gap-2 text-destructive font-medium">
          <AlertTriangle className="h-4 w-4" /> No se puede previsualizar
        </div>
        <ul className="text-sm text-destructive/90 list-disc ml-5 space-y-1">
          {errors.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      </div>
    );
  }

  if (!node) {
    return <p className="text-sm text-muted-foreground">Define una escena de inicio para previsualizar.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Badge variant="default" className="text-[11px]">Escena {sceneOrder.get(node.id) ?? "?"}</Badge>
          <span className="font-semibold">{node.title}</span>
          {node.isEnding && (
            <Badge variant={node.endingType === "success" ? "default" : node.endingType === "fail" ? "destructive" : "secondary"} className="gap-1">
              <Flag className="h-3 w-3" /> Final {node.endingType ?? ""}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="gap-1"><Star className="h-3 w-3" /> {score} pts</Badge>
          <Button size="sm" variant="ghost" onClick={goBack} disabled={history.length === 0}>
            <ArrowLeft className="h-3 w-3 mr-1" /> Atrás
          </Button>
          <Button size="sm" variant="outline" onClick={reset}>
            <RotateCcw className="h-3 w-3 mr-1" /> Reiniciar
          </Button>
          {onSaveDraft && (
            <Button
              size="sm"
              variant="default"
              disabled={savingDraft}
              onClick={() =>
                onSaveDraft({
                  currentNodeId: currentId,
                  score,
                  competencyScores: competencies,
                  answers: history.map(({ competencies: _c, ...rest }) => rest),
                })
              }
            >
              {savingDraft ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
              Guardar borrador jugable
            </Button>
          )}
        </div>
      </div>

      <div className="relative w-full overflow-hidden rounded-xl bg-black aspect-video">
        <VideoPlayer
          video={node.video}
          videos={node.videos}
          activeClipId={activeClipId ?? nodeClips(node)[0]?.id}
          onActiveClipChange={setActiveClipId}
          pauseAtSec={pauseAtSec}
          onPauseAtTime={() => setQuestionReady(true)}
          onEnded={() => {
            if (trig.mode === "end") setQuestionReady(true);
            // If we branched to a specific clip, detect its natural end to
            // trigger the "return" overlay + auto-return.
            if (
              branchReturn &&
              node?.id === branchReturn.branchNodeId &&
              (activeClipId ?? nodeClips(node)[0]?.id) === branchReturn.branchClipId
            ) {
              setBranchClipEnded(true);
            }
          }}
          fill
        />

        {branchReturn && branchClipEnded && (
          <div className="pointer-events-auto absolute inset-x-0 top-1/2 -translate-y-1/2 z-20 flex justify-center px-4">
            <div className="flex items-center gap-3 rounded-full bg-black/80 backdrop-blur-md border border-white/20 px-4 py-2 text-white shadow-2xl">
              <span className="text-sm">
                Volviendo a la escena en <span className="font-bold">{branchCountdown}s</span>…
              </span>
              <Button size="sm" onClick={resolveBranchReturn} className="gap-1">
                <ArrowRight className="h-3 w-3" /> Continuar
              </Button>
            </div>
          </div>
        )}


        {/* Bottom overlay: narrative + feedback + question/choices */}
        {(node.narrative || (!ended && !node.isEnding && q)) && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 via-black/60 to-transparent p-4 pt-16">
            <div className="pointer-events-auto space-y-3 max-h-[70%] overflow-y-auto">
              {node.narrative && (
                <p className="text-sm text-white/95 leading-relaxed drop-shadow">
                  {node.narrative}
                </p>
              )}




              {!ended && !node.isEnding && q && questionReady && (q.kind ?? "question") === "question" && (

                <div className="space-y-2">
                  <div className="font-semibold text-base text-white drop-shadow">{q.text}</div>
                  <div className="grid gap-2">
                    {q.choices.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => choose(c)}
                        className="text-left rounded-lg border border-white/30 bg-white/10 backdrop-blur-md p-3 hover:border-primary hover:bg-white/20 transition-colors text-white"
                      >
                        <span className="text-sm font-medium">{c.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!ended && !node.isEnding && q && questionReady && (q.kind ?? "question") === "comment" && q.choices[0] && (
                <div className="space-y-2">
                  <div className="font-semibold text-base text-white drop-shadow">{q.text}</div>
                  <Textarea
                    rows={3}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Escribe tu respuesta..."
                    className="bg-white/10 border-white/30 text-white placeholder:text-white/60 backdrop-blur-md"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      disabled={!commentText.trim()}
                      onClick={() => choose(q.choices[0], { commentText: commentText.trim() })}
                    >
                      Enviar comentario
                    </Button>
                  </div>
                </div>
              )}

              {!ended && !node.isEnding && q && (q.kind ?? "question") === "goto" && !questionReady && (
                <div className="text-xs text-white/80 italic drop-shadow">
                  <ArrowRight className="h-3 w-3 inline mr-1" /> Enlace automático a otra escena…
                </div>
              )}


            </div>
          </div>
        )}
      </div>
      <VideoPrefetch nodes={nextCandidateNodes(nodes, node)} />


      {(ended || node.isEnding) && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center gap-2 font-semibold">
            <Trophy className="h-4 w-4 text-primary" /> Fin de la partida — {score} pts
          </div>
          {criteria.length > 0 && (
            <div className="grid sm:grid-cols-2 gap-2">
              {criteria.map((c) => (
                <div key={c.key} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{c.label}</span>
                  <span className="font-mono">{competencies[c.key] ?? 0}</span>
                </div>
              ))}
            </div>
          )}
          {history.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">Ver recorrido ({history.length} decisiones)</summary>
              <ol className="list-decimal ml-5 mt-2 space-y-1">
                {history.map((h, i) => (
                  <li key={i}>
                    <span className="font-mono text-[10px]">{h.nodeId}</span> → {h.choiceLabel}{" "}
                    <span className="opacity-70">({h.points >= 0 ? "+" : ""}{h.points})</span>
                  </li>
                ))}
              </ol>
            </details>
          )}
          <Button size="sm" onClick={reset} className="gap-1"><RotateCcw className="h-3 w-3" /> Volver a empezar</Button>
        </div>
      )}
    </div>
  );
}

function validateStory(story: Story): string[] {
  const errs: string[] = [];
  const ids = new Set(Object.keys(story.nodes));
  if (!story.startNodeId) errs.push("Falta definir la escena de inicio.");
  else if (!ids.has(story.startNodeId)) errs.push(`La escena de inicio "${story.startNodeId}" no existe.`);
  for (const n of Object.values(story.nodes)) {
    if (n.isEnding) continue;
    const qs = nodeQuestions(n);
    if (qs.length === 0) {
      errs.push(`La escena "${n.title}" (${n.id}) no es final pero no tiene preguntas.`);
      continue;
    }
    for (const q of qs) {
      for (const c of q.choices) {
        if (c.next !== null && !ids.has(c.next)) {
          errs.push(`La opción "${c.label}" de "${n.title}" apunta a un nodo inexistente: ${c.next}`);
        }
      }
    }
  }

  return errs;
}
