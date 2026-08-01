import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSimulation, submitForReview, updateSimulationStory } from "@/lib/simulations.functions";
import { savePreviewAsDraft } from "@/lib/sessions.functions";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ArrowLeft, Plus, Trash2, Save, Loader2, Flag, GitBranch, Play, Lock, Send, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { StoryPreview } from "@/components/StoryPreview";
import type { Story, StoryNode, Choice, EvaluationCriterion, VideoSource, VideoClip, Question, QuestionTrigger } from "@/lib/story-types";
import { nodeClips } from "@/lib/story-types";
import { AiClipPanel } from "@/components/AiClipPanel";
import { StoryFlowchart } from "@/components/StoryFlowchart";

import { computeSceneOrder, sortNodesByOrder } from "@/lib/scene-order";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export const Route = createFileRoute("/_authenticated/app/simulations/$id/edit")({
  component: EditSimulation,
});

type EditorState = {
  startNodeId: string;
  orderMode: "title" | "manual";
  nodes: StoryNode[]; // array form for stable ordering in UI
  criteria: EvaluationCriterion[];
};

function destinationValue(choice: Pick<Choice, "next" | "nextClipId">): string {
  if (!choice.next) return "__end__";
  return choice.nextClipId ? `clip:${choice.next}:${choice.nextClipId}` : `scene:${choice.next}`;
}

function sceneDestinationValue(choice: Pick<Choice, "next" | "nextClipId">): string {
  if (!choice.next) return "";
  return destinationValue(choice);
}

function destinationPatch(value: string, nextKind: "scene" | undefined = "scene"): Partial<Choice> {
  if (value === "__end__") {
    return { next: null, nextClipId: undefined, ...(nextKind ? { nextKind: "end" as const } : {}) };
  }
  if (value.startsWith("clip:")) {
    const [, nodeId, clipId] = value.split(":");
    return { next: nodeId, nextClipId: clipId, ...(nextKind ? { nextKind } : {}) };
  }
  if (value.startsWith("scene:")) {
    return { next: value.slice("scene:".length), nextClipId: undefined, ...(nextKind ? { nextKind } : {}) };
  }
  return {};
}

function DestinationSelectItems({
  nodes,
  sceneOrder,
  currentNodeId,
  includeEnd = true,
}: {
  nodes: StoryNode[];
  sceneOrder: Map<string, number>;
  currentNodeId: string;
  includeEnd?: boolean;
}) {
  return (
    <>
      {includeEnd && <SelectItem value="__end__">FIN</SelectItem>}
      {nodes.map((node) => {
        const clips = nodeClips(node);
        return (
          <SelectGroup key={node.id}>
            <SelectLabel>
              Escena {sceneOrder.get(node.id) ?? "?"} — {node.title}{node.id === currentNodeId ? " (esta escena)" : ""}
            </SelectLabel>
            <SelectItem value={`scene:${node.id}`}>
              Desde el primer clip
            </SelectItem>
            {clips.map((clip, ci) => (
              <SelectItem key={`${node.id}:${clip.id}`} value={`clip:${node.id}:${clip.id}`}>
                {clip.label || `Clip ${ci + 1}`}
              </SelectItem>
            ))}
          </SelectGroup>
        );
      })}
    </>
  );
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

function EditSimulation() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const get = useServerFn(getSimulation);
  const save = useServerFn(updateSimulationStory);
  const saveDraft = useServerFn(savePreviewAsDraft);
  const submit = useServerFn(submitForReview);

  const sim = useQuery({ queryKey: ["sim", id], queryFn: () => get({ data: { id } }) });

  const [state, setState] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSessionId, setDraftSessionId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const status = sim.data?.status as string | undefined;
  const locked = status === "in_review" || status === "published";

  useEffect(() => {
    if (!sim.data || state) return;
    const story = (sim.data.story ?? { startNodeId: "", nodes: {} }) as Story;
    const rawNodes = Object.values(story.nodes ?? {});
    const startNodeId = story.startNodeId || rawNodes[0]?.id || "";
    const order = computeSceneOrder({
      startNodeId,
      orderMode: story.orderMode,
      nodes: story.nodes ?? {},
    });
    const sorted = sortNodesByOrder(rawNodes, order);
    // Ensure every node has a `videos` array (migrating legacy single `video`) and an order.
    const nodes: StoryNode[] = sorted.map((n, i) => {
      const migratedQuestions: Question[] | undefined =
        n.questions && n.questions.length > 0
          ? n.questions.map((q) => ({ ...q, id: q.id ?? uid("q") }))
          : n.question
          ? [{ id: uid("q"), text: n.question.text, choices: n.question.choices, clipId: n.question.clipId }]
          : undefined;
      return {
        ...n,
        order: i + 1,
        videos:
          n.videos && n.videos.length > 0
            ? n.videos
            : [{ id: uid("clip"), label: "Clip principal", source: (n.video ?? { type: "none" }) as VideoSource }],
        question: undefined,
        questions: migratedQuestions,
      };
    });

    setState({
      startNodeId,
      orderMode: story.orderMode === "manual" ? "manual" : "title",
      nodes,
      criteria: (sim.data.evaluation_criteria ?? []) as unknown as EvaluationCriterion[],
    });
  }, [sim.data, state]);

  // Order is now derived directly from the array index (manual ordering).
  const sceneOrder = useMemo(() => {
    const m = new Map<string, number>();
    state?.nodes.forEach((n, i) => m.set(n.id, i + 1));
    return m;
  }, [state]);

  const orderedNodes = useMemo(
    () => (state ? sortNodesByOrder(state.nodes, sceneOrder) : []),
    [state, sceneOrder],
  );

  const [openScenes, setOpenScenes] = useState<string[]>([]);

  // ---------- drag & drop sensors (must be declared before any early return) ----------
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (sim.isLoading || !state) {
    return <p className="text-muted-foreground">Cargando editor...</p>;
  }


  // ---------- node helpers ----------
  const updateNode = (idx: number, patch: Partial<StoryNode>) =>
    setState((s) =>
      s ? { ...s, nodes: s.nodes.map((n, i) => (i === idx ? { ...n, ...patch } : n)) } : s,
    );

  const updateChoice = (nIdx: number, qIdx: number, cIdx: number, patch: Partial<Choice>) =>
    setState((s) => {
      if (!s) return s;
      const nodes = s.nodes.map((n, i) => {
        if (i !== nIdx || !n.questions) return n;
        const questions = n.questions.map((q, k) => {
          if (k !== qIdx) return q;
          return { ...q, choices: q.choices.map((c, j) => (j === cIdx ? { ...c, ...patch } : c)) };
        });
        return { ...n, questions };
      });
      return { ...s, nodes };
    });

  const updateQuestion = (nIdx: number, qIdx: number, patch: Partial<Question>) =>
    setState((s) => {
      if (!s) return s;
      const nodes = s.nodes.map((n, i) => {
        if (i !== nIdx || !n.questions) return n;
        const questions = n.questions.map((q, k) => (k === qIdx ? { ...q, ...patch } : q));
        return { ...n, questions };
      });
      return { ...s, nodes };
    });

  const addQuestion = (nIdx: number, kind: "question" | "comment" | "goto" = "question", clipId?: string) =>
    setState((s) => {
      if (!s) return s;
      const nodes = s.nodes.map((n, i) => {
        if (i !== nIdx) return n;
        const existing = n.questions ?? [];
        let newQ: Question;
        if (kind === "question") {
          newQ = {
            id: uid("q"),
            kind: "question",
            clipId,
            text: "¿Qué decides?",
            choices: [
              { id: uid("c"), label: "Opción A", feedback: "", points: 0, next: null, competencies: {} },
              { id: uid("c"), label: "Opción B", feedback: "", points: 0, next: null, competencies: {} },
            ],
          };
        } else if (kind === "comment") {
          newQ = {
            id: uid("q"),
            kind: "comment",
            clipId,
            text: "Justifica brevemente tu decisión",
            evaluationHint: "",
            choices: [
              { id: uid("c"), label: "Respuesta libre", feedback: "", points: 0, next: null, competencies: {} },
            ],
          };
        } else {
          newQ = {
            id: uid("q"),
            kind: "goto",
            clipId,
            text: "Continuar",
            choices: [
              { id: uid("c"), label: "Ir a la siguiente escena", feedback: "", points: 0, next: null, competencies: {} },
            ],
          };
        }
        return { ...n, questions: [...existing, newQ] };
      });
      return { ...s, nodes };
    });

  const deleteQuestion = (nIdx: number, qIdx: number) =>
    setState((s) => {
      if (!s) return s;
      const nodes = s.nodes.map((n, i) => {
        if (i !== nIdx || !n.questions) return n;
        return { ...n, questions: n.questions.filter((_, k) => k !== qIdx) };
      });
      return { ...s, nodes };
    });

  const addNode = () => {
    const newId = uid("node");
    setState((s) =>
      s
        ? {
            ...s,
            nodes: [
              ...s.nodes,
              {
                id: newId,
                title: "Nueva escena",
                narrative: "",
                order: s.nodes.length + 1,
                video: { type: "none" } as VideoSource,
                videos: [{ id: uid("clip"), label: "Clip principal", source: { type: "none" } }],
                questions: [
                  {
                    id: uid("q"),
                    text: "¿Qué decides?",
                    choices: [
                      { id: uid("c"), label: "Opción A", feedback: "", points: 0, next: null, competencies: {} },
                      { id: uid("c"), label: "Opción B", feedback: "", points: 0, next: null, competencies: {} },
                    ],
                  },
                ],
              },
            ],
          }
        : s,
    );
  };


  // ---------- video clip helpers ----------
  const updateClip = (nIdx: number, cIdx: number, patch: Partial<VideoClip>) =>
    setState((s) => {
      if (!s) return s;
      const nodes = s.nodes.map((n, i) => {
        if (i !== nIdx) return n;
        const videos = (n.videos ?? []).map((v, j) => (j === cIdx ? { ...v, ...patch } : v));
        return { ...n, videos };
      });
      return { ...s, nodes };
    });

  const updateClipSource = (nIdx: number, cIdx: number, patch: Partial<VideoSource> | VideoSource) =>
    setState((s) => {
      if (!s) return s;
      const nodes = s.nodes.map((n, i) => {
        if (i !== nIdx) return n;
        const videos = (n.videos ?? []).map((v, j) => {
          if (j !== cIdx) return v;
          const merged = { ...(v.source as any), ...(patch as any) } as VideoSource;
          return { ...v, source: merged };
        });
        return { ...n, videos };
      });
      return { ...s, nodes };
    });

  const addClip = (nIdx: number) =>
    setState((s) => {
      if (!s) return s;
      const nodes = s.nodes.map((n, i) => {
        if (i !== nIdx) return n;
        const existing = n.videos ?? [];
        if (existing.length >= 10) return n;
        const next: VideoClip = {
          id: uid("clip"),
          label: `Clip ${existing.length + 1}`,
          source: { type: "none" },
        };
        return { ...n, videos: [...existing, next] };
      });
      return { ...s, nodes };
    });

  const removeClip = (nIdx: number, cIdx: number) =>
    setState((s) => {
      if (!s) return s;
      const nodes = s.nodes.map((n, i) => {
        if (i !== nIdx) return n;
        const existing = n.videos ?? [];
        if (existing.length <= 1) {
          // Keep at least one clip slot (can be "Sin vídeo").
          return {
            ...n,
            videos: [{ id: uid("clip"), label: "Clip principal", source: { type: "none" } as VideoSource }],
          };
        }
        return { ...n, videos: existing.filter((_, j) => j !== cIdx) };
      });
      return { ...s, nodes };
    });

  // ---------- drag & drop ordering ----------


  const reorderScenes = (activeId: string, overId: string) => {
    if (activeId === overId) return;
    setState((s) => {
      if (!s) return s;
      const oldIdx = s.nodes.findIndex((n) => n.id === activeId);
      const newIdx = s.nodes.findIndex((n) => n.id === overId);
      if (oldIdx < 0 || newIdx < 0) return s;
      const reordered = arrayMove(s.nodes, oldIdx, newIdx).map((n, i) => ({
        ...n,
        order: i + 1,
        title: renumberTitle(n.title, i + 1),
      }));
      return { ...s, orderMode: "manual", startNodeId: reordered[0]?.id ?? s.startNodeId, nodes: reordered };
    });
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    reorderScenes(String(active.id), String(over.id));
  };

  const onQuestionDragEnd = (nIdx: number) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setState((s) => {
      if (!s) return s;
      const nodes = s.nodes.map((n, i) => {
        if (i !== nIdx || !n.questions) return n;
        const oldIdx = n.questions.findIndex((q) => (q.id ?? "") === active.id);
        const newIdx = n.questions.findIndex((q) => (q.id ?? "") === over.id);
        if (oldIdx < 0 || newIdx < 0) return n;
        return { ...n, questions: arrayMove(n.questions, oldIdx, newIdx) };
      });
      return { ...s, nodes };
    });
  };

  const deleteNode = (idx: number) => {
    setState((s) => {
      if (!s) return s;
      const removed = s.nodes[idx];
      const nodes = s.nodes.filter((_, i) => i !== idx).map((n) => {
        if (!n.questions) return n;
        return {
          ...n,
          questions: n.questions.map((q) => ({
            ...q,
            choices: q.choices.map((c) => (c.next === removed.id ? { ...c, next: null } : c)),
          })),
        };
      });
      const startNodeId = s.startNodeId === removed.id ? nodes[0]?.id ?? "" : s.startNodeId;
      return { ...s, nodes, startNodeId };
    });
  };

  const addChoice = (nIdx: number, qIdx: number) =>
    setState((s) => {
      if (!s) return s;
      const nodes = s.nodes.map((n, i) => {
        if (i !== nIdx || !n.questions) return n;
        const questions = n.questions.map((q, k) => {
          if (k !== qIdx) return q;
          if (q.choices.length >= 6) return q;
          return {
            ...q,
            choices: [
              ...q.choices,
              { id: uid("c"), label: "Nueva opción", feedback: "", points: 0, next: null, competencies: {} },
            ],
          };
        });
        return { ...n, questions };
      });
      return { ...s, nodes };
    });

  const deleteChoice = (nIdx: number, qIdx: number, cIdx: number) =>
    setState((s) => {
      if (!s) return s;
      const nodes = s.nodes.map((n, i) => {
        if (i !== nIdx || !n.questions) return n;
        const questions = n.questions.map((q, k) => {
          if (k !== qIdx) return q;
          if (q.choices.length <= 2) return q;
          return { ...q, choices: q.choices.filter((_, j) => j !== cIdx) };
        });
        return { ...n, questions };
      });
      return { ...s, nodes };
    });

  const toggleEnding = (idx: number, isEnding: boolean) =>
    setState((s) => {
      if (!s) return s;
      const nodes = s.nodes.map((n, i) => {
        if (i !== idx) return n;
        if (isEnding) {
          return { ...n, isEnding: true, endingType: n.endingType ?? "neutral", questions: undefined };
        }
        return {
          ...n,
          isEnding: false,
          endingType: undefined,
          questions: n.questions && n.questions.length > 0 ? n.questions : [
            {
              id: uid("q"),
              text: "¿Qué decides?",
              choices: [
                { id: uid("c"), label: "Opción A", feedback: "", points: 0, next: null, competencies: {} },
                { id: uid("c"), label: "Opción B", feedback: "", points: 0, next: null, competencies: {} },
              ],
            },
          ],
        };
      });
      return { ...s, nodes };
    });


  // ---------- criteria ----------
  const updateCriterion = (idx: number, patch: Partial<EvaluationCriterion>) =>
    setState((s) =>
      s ? { ...s, criteria: s.criteria.map((c, i) => (i === idx ? { ...c, ...patch } : c)) } : s,
    );
  const addCriterion = () =>
    setState((s) =>
      s
        ? {
            ...s,
            criteria: [...s.criteria, { key: uid("crit"), label: "Nueva competencia", description: "" }],
          }
        : s,
    );
  const deleteCriterion = (idx: number) =>
    setState((s) => (s ? { ...s, criteria: s.criteria.filter((_, i) => i !== idx) } : s));

  // ---------- save ----------
  const handleSave = async () => {
    if (!state) return;
    setSaving(true);
    try {
      const nodesRecord: Record<string, StoryNode> = {};
      state.nodes.forEach((n, i) => {
        const firstSource = n.videos && n.videos[0]?.source ? n.videos[0].source : n.video ?? { type: "none" };
        nodesRecord[n.id] = { ...n, order: i + 1, video: firstSource };
      });
      await save({
        data: {
          id,
          story: { startNodeId: state.startNodeId, orderMode: state.orderMode, nodes: nodesRecord },
          evaluationCriteria: state.criteria,
        },
      });
      toast.success("Cambios guardados");
      navigate({ to: "/app/simulations/$id", params: { id } });
    } catch (err: any) {
      toast.error(err?.message ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      <div className="flex items-center justify-between gap-2">
        <Link
          to="/app/simulations/$id"
          params={{ id }}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Volver
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setPreviewOpen(true)} className="gap-2">
            <Play className="h-4 w-4" /> Vista previa
          </Button>
          <Button onClick={handleSave} disabled={saving || locked} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar cambios
          </Button>
          {!locked && (
            <Button
              variant="default"
              disabled={submitting}
              onClick={async () => {
                if (!confirm("Enviar a revisión bloqueará la edición hasta publicar o volver a borrador. ¿Continuar?")) return;
                setSubmitting(true);
                try {
                  await submit({ data: { id } });
                  toast.success("Enviada a revisión");
                  navigate({ to: "/app/simulations/$id/review", params: { id } });
                } catch (err: any) {
                  toast.error(err?.message ?? "No se pudo enviar a revisión");
                } finally {
                  setSubmitting(false);
                }
              }}
              className="gap-2"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar a revisión
            </Button>
          )}
          {locked && (
            <Button variant="default" asChild className="gap-2">
              <Link to="/app/simulations/$id/review" params={{ id }}>
                <Lock className="h-4 w-4" /> Ir a revisión
              </Link>
            </Button>
          )}
        </div>
      </div>

      {locked && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100 p-3 text-sm flex items-center gap-2">
          <Lock className="h-4 w-4 flex-shrink-0" />
          <span>
            La simulación está <strong>{status === "published" ? "publicada" : "en revisión"}</strong>. La edición está bloqueada. Ve a la pantalla de revisión para publicar o volver a borrador.
          </span>
        </div>
      )}




      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vista previa interactiva</DialogTitle>
            <DialogDescription>
              Prueba el árbol con los cambios actuales. Puedes guardar el progreso como borrador jugable sin publicar la simulación.
            </DialogDescription>
          </DialogHeader>
          {draftSessionId && (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm flex items-center justify-between gap-2">
              <span>Borrador guardado. Puedes reanudarlo cuando quieras.</span>
              <Link
                to="/app/sessions/$id"
                params={{ id: draftSessionId }}
                className="text-primary underline underline-offset-2 font-medium"
              >
                Abrir sesión
              </Link>
            </div>
          )}
          <StoryPreview
            story={{
              startNodeId: state.startNodeId,
              orderMode: state.orderMode,
              nodes: Object.fromEntries(state.nodes.map((n) => [n.id, n])),
            }}
            criteria={state.criteria}
            savingDraft={savingDraft}
            onSaveDraft={
              locked
                ? undefined
                : async (payload) => {
                    setSavingDraft(true);
                    try {
                      const nodesRecord: Record<string, StoryNode> = {};
                      state.nodes.forEach((n, i) => {
                        const firstSource = n.videos && n.videos[0]?.source ? n.videos[0].source : n.video ?? { type: "none" };
                        nodesRecord[n.id] = { ...n, order: i + 1, video: firstSource };
                      });
                      await save({
                        data: {
                          id,
                          story: { startNodeId: state.startNodeId, orderMode: state.orderMode, nodes: nodesRecord },
                          evaluationCriteria: state.criteria,
                        },
                      });
                      const res = await saveDraft({
                        data: {
                          simulationId: id,
                          currentNodeId: payload.currentNodeId,
                          score: payload.score,
                          competencyScores: payload.competencyScores,
                          answers: payload.answers,
                          ...(draftSessionId ? { resumeSessionId: draftSessionId } : {}),
                        },
                      });
                      setDraftSessionId(res.id);
                      toast.success("Borrador jugable guardado");
                    } catch (err: any) {
                      toast.error(err?.message ?? "No se pudo guardar el borrador");
                    } finally {
                      setSavingDraft(false);
                    }
                  }
            }
          />
        </DialogContent>
      </Dialog>

      <fieldset disabled={locked} className={locked ? "opacity-70 pointer-events-none space-y-6" : "space-y-6"}>


      <div>
        <h1 className="text-3xl font-bold tracking-tight">Editor de la simulación</h1>
        <p className="text-muted-foreground mt-1">
          Revisa y modifica las escenas, preguntas y ramificaciones generadas por la IA.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inicio</CardTitle>
          <CardDescription>Elige la escena por la que comienza la simulación.</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={state.startNodeId} onValueChange={(v) => setState((s) => (s ? { ...s, startNodeId: v } : s))}>
            <SelectTrigger className="max-w-md"><SelectValue /></SelectTrigger>
            <SelectContent>
              {orderedNodes.map((n) => (
                <SelectItem key={n.id} value={n.id}>Escena {sceneOrder.get(n.id) ?? "?"} — {n.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Criterios de evaluación</CardTitle>
            <CardDescription>Competencias usadas en las opciones y el informe.</CardDescription>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={addCriterion}>
            <Plus className="h-4 w-4 mr-1" /> Añadir
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {state.criteria.map((c, i) => (
            <div key={i} className="grid grid-cols-12 gap-2">
              <Input className="col-span-3" placeholder="key" value={c.key} onChange={(e) => updateCriterion(i, { key: e.target.value })} />
              <Input className="col-span-3" placeholder="Etiqueta" value={c.label} onChange={(e) => updateCriterion(i, { label: e.target.value })} />
              <Input className="col-span-5" placeholder="Descripción" value={c.description} onChange={(e) => updateCriterion(i, { description: e.target.value })} />
              <Button type="button" variant="ghost" size="icon" onClick={() => deleteCriterion(i)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-4 w-4" /> Organigrama de escenas y ramificaciones
          </CardTitle>
          <CardDescription>
            Vista global del árbol. Reordena escenas o cambia el destino de una ramificación arrastrando.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StoryFlowchart
            nodes={state.nodes}
            disabled={locked}
            onReorderScenes={reorderScenes}
            onRewireChoice={({ nodeIdx, qIdx, cIdx }, targetNodeId) =>
              updateChoice(nodeIdx, qIdx, cIdx, {
                next: targetNodeId,
                nextClipId: undefined,
                nextKind: targetNodeId ? "scene" : "end",
              })
            }
            onDeleteScene={deleteNode}
            onDeleteChoice={({ nodeIdx, qIdx, cIdx }) => deleteChoice(nodeIdx, qIdx, cIdx)}
            onEditScene={(nodeId) => {
              setOpenScenes((prev) => (prev.includes(nodeId) ? prev : [...prev, nodeId]));
              requestAnimationFrame(() => {
                document.getElementById(`scene-card-${nodeId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
              });
            }}
            onAddScene={addNode}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Escenas ({state.nodes.length})</CardTitle>
            <CardDescription>Edita cada escena, su vídeo y sus opciones.</CardDescription>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={addNode}>
            <Plus className="h-4 w-4 mr-1" /> Añadir escena
          </Button>
        </CardHeader>
        <CardContent>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={state.nodes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
              <Accordion type="multiple" value={openScenes} onValueChange={setOpenScenes} className="space-y-2">
                {state.nodes.map((n, nIdx) => (
                  <SortableScene key={n.id} id={n.id}>
                    {({ handleProps }) => (
                      <AccordionItem id={`scene-card-${n.id}`} value={n.id} className="border rounded-lg px-3 bg-card">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            {...handleProps}
                            className="p-2 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
                            aria-label="Mover escena"
                            title="Arrastra para reordenar"
                          >
                            <GripVertical className="h-4 w-4" />
                          </button>
                          <AccordionTrigger className="hover:no-underline flex-1">
                            <div className="flex items-center gap-2 text-left">
                              <Badge variant="default" className="text-[11px]">Escena {nIdx + 1}</Badge>
                              <span className="font-medium">{n.title}</span>
                              <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline">{n.id}</span>
                              {n.isEnding && (
                                <Badge variant={n.endingType === "success" ? "default" : "secondary"} className="gap-1">
                                  <Flag className="h-3 w-3" /> Final
                                </Badge>
                              )}
                              {!n.isEnding && (n.questions?.length ?? 0) > 0 && (
                                <Badge variant="outline" className="gap-1">
                                  <GitBranch className="h-3 w-3" /> {(n.questions ?? []).reduce((acc, q) => acc + q.choices.length, 0)}
                                </Badge>
                              )}

                            </div>
                          </AccordionTrigger>
                        </div>

                <AccordionContent className="space-y-4 pt-2">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>ID</Label>
                      <Input value={n.id} disabled />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Título</Label>
                      <Input value={n.title} onChange={(e) => updateNode(nIdx, { title: e.target.value })} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Narrativa</Label>
                    <Textarea rows={3} value={n.narrative} onChange={(e) => updateNode(nIdx, { narrative: e.target.value })} />
                  </div>

                  <div className="rounded-lg border p-3 space-y-3 bg-muted/20">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <Label className="text-sm font-semibold">Vídeos de la escena</Label>
                        <p className="text-xs text-muted-foreground">
                          Añade uno o varios clips. Durante la reproducción, el usuario podrá elegir cuál ver desde una lista.
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => addClip(nIdx)}
                        disabled={(n.videos?.length ?? 0) >= 10}
                      >
                        <Plus className="h-3 w-3 mr-1" /> Añadir vídeo
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {(n.videos ?? []).map((clip, cIdx) => {
                        const src = clip.source;
                        const isNone = src.type === "none";
                        return (
                          <div key={clip.id} className="rounded-md border bg-background p-3 space-y-3">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-[10px]">Clip {cIdx + 1}</Badge>
                              <Input
                                className="h-8 flex-1"
                                placeholder="Etiqueta del clip (ej. Versión corta)"
                                value={clip.label}
                                onChange={(e) => updateClip(nIdx, cIdx, { label: e.target.value })}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeClip(nIdx, cIdx)}
                                aria-label="Eliminar clip"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                            <div className="grid sm:grid-cols-3 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs">Tipo</Label>
                                <Select
                                  value={src.type}
                                  onValueChange={(v) => {
                                    if (v === "none") {
                                      updateClipSource(nIdx, cIdx, { type: "none" } as VideoSource);
                                    } else if (v === "ai") {
                                      updateClipSource(nIdx, cIdx, {
                                        type: "ai",
                                        status: "failed",
                                        url: null,
                                        error: "Sin configurar",
                                      } as VideoSource);
                                    } else {
                                      const prevUrl = (src as any).url ?? "";
                                      updateClipSource(nIdx, cIdx, {
                                        type: v as "youtube" | "vimeo" | "mp4",
                                        url: prevUrl,
                                      } as VideoSource);
                                    }
                                  }}
                                >
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">Sin vídeo</SelectItem>
                                    <SelectItem value="youtube">YouTube</SelectItem>
                                    <SelectItem value="vimeo">Vimeo</SelectItem>
                                    <SelectItem value="mp4">MP4 (URL directa)</SelectItem>
                                    <SelectItem value="ai">Generado con IA</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              {src.type === "ai" ? (
                                <div className="sm:col-span-2">
                                  <AiClipPanel
                                    simulationId={id}
                                    source={src}
                                    onChange={(patch) =>
                                      updateClipSource(nIdx, cIdx, { ...(src as any), ...patch } as VideoSource)
                                    }
                                  />
                                </div>
                              ) : (
                                <div className="space-y-1.5 sm:col-span-2">
                                  <Label className="text-xs">URL</Label>
                                  <Input
                                    placeholder={
                                      isNone
                                        ? "Selecciona primero un tipo de vídeo"
                                        : src.type === "youtube"
                                        ? "https://www.youtube.com/watch?v=..."
                                        : src.type === "vimeo"
                                        ? "https://vimeo.com/..."
                                        : "https://.../video.mp4"
                                    }
                                    disabled={isNone}
                                    value={isNone ? "" : (src as any).url ?? ""}
                                    onChange={(e) => {
                                      if (isNone) {
                                        updateClipSource(nIdx, cIdx, { type: "mp4", url: e.target.value } as VideoSource);
                                      } else {
                                        updateClipSource(nIdx, cIdx, { url: e.target.value } as any);
                                      }
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                            {!isNone && (
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                  <Label className="text-xs">Inicio (s, opcional)</Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    value={(src as any).startSec ?? ""}
                                    onChange={(e) =>
                                      updateClipSource(nIdx, cIdx, {
                                        startSec: e.target.value === "" ? undefined : Number(e.target.value),
                                      } as any)
                                    }
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-xs">Fin (s, opcional)</Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    value={(src as any).endSec ?? ""}
                                    onChange={(e) =>
                                      updateClipSource(nIdx, cIdx, {
                                        endSec: e.target.value === "" ? undefined : Number(e.target.value),
                                      } as any)
                                    }
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>


                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <div className="font-medium text-sm">¿Es una escena final?</div>
                      <p className="text-xs text-muted-foreground">Las escenas finales no tienen pregunta y cierran la partida.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {n.isEnding && (
                        <Select value={n.endingType ?? "neutral"} onValueChange={(v) => updateNode(nIdx, { endingType: v as any })}>
                          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="success">Éxito</SelectItem>
                            <SelectItem value="neutral">Neutro</SelectItem>
                            <SelectItem value="fail">Fallo</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      <Button type="button" variant={n.isEnding ? "default" : "outline"} size="sm" onClick={() => toggleEnding(nIdx, !n.isEnding)}>
                        {n.isEnding ? "Final" : "Marcar como final"}
                      </Button>
                    </div>
                  </div>

                  {!n.isEnding && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <Label className="text-sm font-semibold">Interacciones de la escena</Label>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => addQuestion(nIdx, "question")}>
                            <Plus className="h-3 w-3 mr-1" /> Pregunta
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => addQuestion(nIdx, "comment")}>
                            <Plus className="h-3 w-3 mr-1" /> Comentario
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => addQuestion(nIdx, "goto")}>
                            <Plus className="h-3 w-3 mr-1" /> Enlace a escena
                          </Button>
                        </div>
                      </div>

                      {(n.questions ?? []).length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          Sin interacciones. Añade una pregunta (con opciones), un comentario (respuesta libre) o un enlace directo a otra escena.
                        </p>
                      )}

                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onQuestionDragEnd(nIdx)}>
                        <SortableContext
                          items={(n.questions ?? []).map((q, qi) => q.id ?? `q-${qi}`)}
                          strategy={verticalListSortingStrategy}
                        >
                      {(n.questions ?? []).map((q, qIdx) => {
                        const kind: "question" | "comment" | "goto" = q.kind ?? "question";
                        const kindLabel =
                          kind === "comment" ? "Comentario" : kind === "goto" ? "Enlace" : "Pregunta";
                        const promptLabel =
                          kind === "comment"
                            ? "Enunciado del comentario"
                            : kind === "goto"
                            ? "Texto opcional (por ejemplo, subtítulo antes de saltar)"
                            : `Pregunta ${qIdx + 1}`;
                        const qKey = q.id ?? `q-${qIdx}`;
                        return (
                        <SortableScene key={qKey} id={qKey}>
                          {({ handleProps }) => (
                        <div className="space-y-3 rounded-lg border p-3">
                          <div className="flex items-start justify-between gap-2">
                            <button
                              type="button"
                              {...handleProps}
                              className="mt-1 p-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
                              aria-label="Mover interacción"
                              title="Arrastra para reordenar"
                            >
                              <GripVertical className="h-4 w-4" />
                            </button>
                            <div className="flex-1 space-y-1.5">
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-[10px]">{kindLabel} {qIdx + 1}</Badge>
                              </div>
                              <Label>{promptLabel}</Label>
                              <Textarea
                                rows={2}
                                value={q.text}
                                onChange={(e) => updateQuestion(nIdx, qIdx, { text: e.target.value })}
                              />
                              {kind === "comment" && (
                                <div className="space-y-1">
                                  <Label className="text-xs">Guía para el evaluador (opcional)</Label>
                                  <Textarea
                                    rows={2}
                                    placeholder="Qué se espera de una buena respuesta escrita, criterios a valorar, etc."
                                    value={q.evaluationHint ?? ""}
                                    onChange={(e) => updateQuestion(nIdx, qIdx, { evaluationHint: e.target.value })}
                                  />
                                </div>
                              )}
                            </div>
                            <Button type="button" variant="ghost" size="icon" onClick={() => deleteQuestion(nIdx, qIdx)} title="Eliminar">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs">Vincular a vídeo</Label>
                            <Select
                              value={q.clipId ?? "__any__"}
                              onValueChange={(v) => updateQuestion(nIdx, qIdx, { clipId: v === "__any__" ? undefined : v })}
                            >
                              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__any__">Cualquier clip (escena completa)</SelectItem>
                                {(n.videos ?? []).map((v, vi) => (
                                  <SelectItem key={v.id} value={v.id}>{v.label || `Clip ${vi + 1}`}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <QuestionTriggerEditor
                            value={q.triggerAt}
                            onChange={(t) => updateQuestion(nIdx, qIdx, { triggerAt: t })}
                          />

                          {kind === "goto" && (
                            <div className="space-y-1.5">
                              <Label className="text-sm">Destino</Label>
                              <Select
                                value={destinationValue(q.choices[0] ?? { next: null })}
                                onValueChange={(v) => updateChoice(nIdx, qIdx, 0, destinationPatch(v))}
                              >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <DestinationSelectItems nodes={orderedNodes} sceneOrder={sceneOrder} currentNodeId={n.id} />
                                </SelectContent>
                              </Select>
                              <p className="text-[11px] text-muted-foreground">
                                Al llegar al momento indicado arriba, la simulación saltará automáticamente a la escena o clip elegido sin pedir interacción.
                              </p>
                            </div>
                          )}

                          {kind === "comment" && q.choices[0] && (
                            <div className="rounded-md border p-3 space-y-2 bg-muted/30">
                              <Label className="text-sm">Resultado al enviar el comentario</Label>
                              <div className="grid grid-cols-12 gap-2">
                                <Input
                                  className="col-span-2"
                                  type="number"
                                  placeholder="Puntos"
                                  value={q.choices[0].points}
                                  onChange={(e) => updateChoice(nIdx, qIdx, 0, { points: Number(e.target.value) })}
                                />
                                <Select
                                  value={q.choices[0].nextKind ?? (q.choices[0].next ? "scene" : "end")}
                                  onValueChange={(v) => {
                                    const nk = v as "end" | "scene" | "continue" | "question";
                                    const patch: Partial<Choice> = { nextKind: nk };
                                    if (nk !== "scene") patch.next = null;
                                    if (nk !== "scene") patch.nextClipId = undefined;
                                    if (nk !== "question") patch.nextQuestionId = undefined;
                                    updateChoice(nIdx, qIdx, 0, patch);
                                  }}
                                >
                                  <SelectTrigger className="col-span-10"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="end">FIN de la simulación</SelectItem>
                                    <SelectItem value="continue">Continuar con el vídeo</SelectItem>
                                    <SelectItem value="scene">Ir a otra escena…</SelectItem>
                                    <SelectItem value="question">Ir a otra pregunta/comentario…</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              {(q.choices[0].nextKind ?? (q.choices[0].next ? "scene" : "end")) === "scene" && (
                                <div className="space-y-1.5">
                                  <Select
                                    value={sceneDestinationValue(q.choices[0])}
                                    onValueChange={(v) => updateChoice(nIdx, qIdx, 0, destinationPatch(v, "scene"))}
                                  >
                                    <SelectTrigger><SelectValue placeholder="Elige escena o clip destino" /></SelectTrigger>
                                    <SelectContent>
                                      <DestinationSelectItems nodes={orderedNodes} sceneOrder={sceneOrder} currentNodeId={n.id} includeEnd={false} />
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                              {(q.choices[0].nextKind === "question") && (
                                <Select
                                  value={q.choices[0].nextQuestionId ?? ""}
                                  onValueChange={(v) => updateChoice(nIdx, qIdx, 0, { nextQuestionId: v, nextKind: "question" })}
                                >
                                  <SelectTrigger><SelectValue placeholder="Elige pregunta/comentario destino" /></SelectTrigger>
                                  <SelectContent>
                                    {(n.questions ?? []).map((qq, qqi) => {
                                      const targetId = qq.id ?? `q-${qqi}`;
                                      if (qqi === qIdx) return null;
                                      const lab = (qq.kind ?? "question") === "comment"
                                        ? `Comentario ${qqi + 1}`
                                        : (qq.kind === "goto" ? `Enlace ${qqi + 1}` : `Pregunta ${qqi + 1}`);
                                      const excerpt = (qq.text ?? "").slice(0, 40);
                                      return (
                                        <SelectItem key={targetId} value={targetId}>{lab} — {excerpt}</SelectItem>
                                      );
                                    })}
                                  </SelectContent>
                                </Select>
                              )}
                              <Textarea
                                rows={2}
                                placeholder="Feedback mostrado al usuario tras enviar su comentario"
                                value={q.choices[0].feedback}
                                onChange={(e) => updateChoice(nIdx, qIdx, 0, { feedback: e.target.value })}
                              />
                              <div className="space-y-1">
                                <Label className="text-xs">Impacto en competencias</Label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                  {state.criteria.map((crit) => (
                                    <div key={crit.key} className="flex items-center gap-2">
                                      <span className="text-xs text-muted-foreground truncate flex-1" title={crit.label}>{crit.label}</span>
                                      <Input
                                        type="number"
                                        className="w-20 h-8"
                                        value={q.choices[0].competencies?.[crit.key] ?? 0}
                                        onChange={(e) =>
                                          updateChoice(nIdx, qIdx, 0, {
                                            competencies: { ...q.choices[0].competencies, [crit.key]: Number(e.target.value) },
                                          })
                                        }
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {kind === "question" && (
                            <>
                              <div className="flex items-center justify-between">
                                <Label className="text-sm">Opciones y ramificaciones</Label>
                                <Button type="button" size="sm" variant="outline" onClick={() => addChoice(nIdx, qIdx)} disabled={q.choices.length >= 6}>
                                  <Plus className="h-3 w-3 mr-1" /> Añadir opción
                                </Button>
                              </div>

                              {q.choices.map((c, cIdx) => (
                                <div key={c.id} className="rounded-md border p-3 space-y-2 bg-muted/30">
                                  <div className="grid grid-cols-12 gap-2">
                                    <Input className="col-span-6" placeholder="Texto de la opción" value={c.label} onChange={(e) => updateChoice(nIdx, qIdx, cIdx, { label: e.target.value })} />
                                    <Input className="col-span-2" type="number" placeholder="Puntos" value={c.points} onChange={(e) => updateChoice(nIdx, qIdx, cIdx, { points: Number(e.target.value) })} />
                                    <Select
                                      value={destinationValue(c)}
                                      onValueChange={(v) => updateChoice(nIdx, qIdx, cIdx, destinationPatch(v))}
                                    >
                                      <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <DestinationSelectItems nodes={orderedNodes} sceneOrder={sceneOrder} currentNodeId={n.id} />
                                      </SelectContent>
                                    </Select>
                                    <Button type="button" variant="ghost" size="icon" className="col-span-1" onClick={() => deleteChoice(nIdx, qIdx, cIdx)} disabled={q.choices.length <= 2}>
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>
                                  <Textarea
                                    rows={2}
                                    placeholder="Feedback al usuario tras elegir esta opción"
                                    value={c.feedback}
                                    onChange={(e) => updateChoice(nIdx, qIdx, cIdx, { feedback: e.target.value })}
                                  />
                                  <div className="space-y-1">
                                    <Label className="text-xs">Impacto en competencias (clave: valor)</Label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                      {state.criteria.map((crit) => (
                                        <div key={crit.key} className="flex items-center gap-2">
                                          <span className="text-xs text-muted-foreground truncate flex-1" title={crit.label}>{crit.label}</span>
                                          <Input
                                            type="number"
                                            className="w-20 h-8"
                                            value={c.competencies?.[crit.key] ?? 0}
                                            onChange={(e) =>
                                              updateChoice(nIdx, qIdx, cIdx, {
                                                competencies: { ...c.competencies, [crit.key]: Number(e.target.value) },
                                              })
                                            }
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                          )}
                        </SortableScene>
                        );
                      })}
                        </SortableContext>
                      </DndContext>
                    </div>
                  )}


                  <div className="flex justify-end">
                    <Button type="button" variant="ghost" size="sm" onClick={() => deleteNode(nIdx)} className="text-destructive">
                      <Trash2 className="h-4 w-4 mr-1" /> Eliminar escena
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
                    )}
                  </SortableScene>
                ))}
              </Accordion>
            </SortableContext>
          </DndContext>
        </CardContent>
      </Card>
      </fieldset>

      {!locked && (
        <div className="sticky bottom-4 flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="lg" className="gap-2 shadow-lg">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar cambios
          </Button>
        </div>
      )}
    </div>
  );
}

function SortableScene({
  id,
  children,
}: {
  id: string;
  children: (p: { handleProps: Record<string, unknown> }) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ handleProps: { ...attributes, ...listeners } })}
    </div>
  );
}

/** If the title follows "Escena N" (any case), replace N with the new index. Otherwise leave it untouched. */
function renumberTitle(title: string, newIndex: number): string {
  const m = title.match(/^(\s*escena\s+)(\d+)(\b.*)$/i);
  if (!m) return title;
  return `${m[1]}${newIndex}${m[3]}`;
}

function sortByTitleNumber<T extends { title: string }>(nodes: T[]): T[] {
  const num = (t: string) => {
    const m = t.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : Number.POSITIVE_INFINITY;
  };
  return [...nodes].sort((a, b) => {
    const da = num(a.title);
    const db = num(b.title);
    if (da !== db) return da - db;
    return a.title.localeCompare(b.title);
  });
}

function QuestionTriggerEditor({
  value,
  onChange,
}: {
  value: QuestionTrigger | undefined;
  onChange: (t: QuestionTrigger) => void;
}) {
  const mode = value?.mode ?? "immediate";
  const secs = value?.mode === "time" ? value.seconds : 0;
  const minutes = Math.floor(secs / 60);
  const seconds = Math.round(secs % 60);

  return (
    <div className="space-y-1.5 rounded-md border bg-muted/20 p-2">
      <Label className="text-xs">¿Cuándo se muestra la pregunta?</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={mode}
          onValueChange={(v) => {
            if (v === "immediate") onChange({ mode: "immediate" });
            else if (v === "end") onChange({ mode: "end" });
            else onChange({ mode: "time", seconds: secs || 0 });
          }}
        >
          <SelectTrigger className="h-8 w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="immediate">Al iniciar el clip</SelectItem>
            <SelectItem value="time">En un momento concreto…</SelectItem>
            <SelectItem value="end">Al terminar el vídeo</SelectItem>
          </SelectContent>
        </Select>

        {mode === "time" && (
          <div className="flex items-center gap-1 text-sm">
            <Input
              type="number"
              min={0}
              className="h-8 w-16"
              value={minutes}
              onChange={(e) => {
                const m = Math.max(0, Number(e.target.value) || 0);
                onChange({ mode: "time", seconds: m * 60 + seconds });
              }}
            />
            <span className="text-muted-foreground">min</span>
            <Input
              type="number"
              min={0}
              max={59}
              className="h-8 w-16"
              value={seconds}
              onChange={(e) => {
                const s = Math.max(0, Math.min(59, Number(e.target.value) || 0));
                onChange({ mode: "time", seconds: minutes * 60 + s });
              }}
            />
            <span className="text-muted-foreground">seg</span>
          </div>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Si eliges un momento concreto, el vídeo se pausará en ese instante y aparecerá la pregunta.
      </p>
    </div>
  );
}

