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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ArrowLeft, Plus, Trash2, Save, Loader2, Flag, GitBranch, Play, Lock, Send } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { StoryPreview } from "@/components/StoryPreview";
import type { Story, StoryNode, Choice, EvaluationCriterion, VideoSource } from "@/lib/story-types";
import { computeSceneOrder, sortNodesByOrder } from "@/lib/scene-order";

export const Route = createFileRoute("/_authenticated/app/simulations/$id/edit")({
  component: EditSimulation,
});

type EditorState = {
  startNodeId: string;
  nodes: StoryNode[]; // array form for stable ordering in UI
  criteria: EvaluationCriterion[];
};

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
    const order = computeSceneOrder({ startNodeId, nodes: story.nodes ?? {} });
    const nodes = sortNodesByOrder(rawNodes, order);
    setState({
      startNodeId,
      nodes,
      criteria: (sim.data.evaluation_criteria ?? []) as unknown as EvaluationCriterion[],
    });
  }, [sim.data, state]);

  const sceneOrder = useMemo(() => {
    if (!state) return new Map<string, number>();
    return computeSceneOrder({
      startNodeId: state.startNodeId,
      nodes: Object.fromEntries(state.nodes.map((n) => [n.id, n])),
    });
  }, [state]);

  const nodeIds = useMemo(() => state?.nodes.map((n) => n.id) ?? [], [state]);

  if (sim.isLoading || !state) {
    return <p className="text-muted-foreground">Cargando editor...</p>;
  }

  // ---------- node helpers ----------
  const updateNode = (idx: number, patch: Partial<StoryNode>) =>
    setState((s) =>
      s ? { ...s, nodes: s.nodes.map((n, i) => (i === idx ? { ...n, ...patch } : n)) } : s,
    );

  const updateChoice = (nIdx: number, cIdx: number, patch: Partial<Choice>) =>
    setState((s) => {
      if (!s) return s;
      const nodes = s.nodes.map((n, i) => {
        if (i !== nIdx || !n.question) return n;
        const choices = n.question.choices.map((c, j) => (j === cIdx ? { ...c, ...patch } : c));
        return { ...n, question: { ...n.question, choices } };
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
                video: { type: "none" } as VideoSource,
                question: {
                  text: "¿Qué decides?",
                  choices: [
                    { id: uid("c"), label: "Opción A", feedback: "", points: 0, next: null, competencies: {} },
                    { id: uid("c"), label: "Opción B", feedback: "", points: 0, next: null, competencies: {} },
                  ],
                },
              },
            ],
          }
        : s,
    );
  };

  const deleteNode = (idx: number) => {
    setState((s) => {
      if (!s) return s;
      const removed = s.nodes[idx];
      const nodes = s.nodes.filter((_, i) => i !== idx).map((n) => {
        if (!n.question) return n;
        return {
          ...n,
          question: {
            ...n.question,
            choices: n.question.choices.map((c) => (c.next === removed.id ? { ...c, next: null } : c)),
          },
        };
      });
      const startNodeId = s.startNodeId === removed.id ? nodes[0]?.id ?? "" : s.startNodeId;
      return { ...s, nodes, startNodeId };
    });
  };

  const addChoice = (nIdx: number) =>
    setState((s) => {
      if (!s) return s;
      const nodes = s.nodes.map((n, i) => {
        if (i !== nIdx) return n;
        const question = n.question ?? { text: "¿Qué decides?", choices: [] };
        if (question.choices.length >= 4) return n;
        return {
          ...n,
          question: {
            ...question,
            choices: [
              ...question.choices,
              { id: uid("c"), label: "Nueva opción", feedback: "", points: 0, next: null, competencies: {} },
            ],
          },
        };
      });
      return { ...s, nodes };
    });

  const deleteChoice = (nIdx: number, cIdx: number) =>
    setState((s) => {
      if (!s) return s;
      const nodes = s.nodes.map((n, i) => {
        if (i !== nIdx || !n.question) return n;
        if (n.question.choices.length <= 2) return n;
        return { ...n, question: { ...n.question, choices: n.question.choices.filter((_, j) => j !== cIdx) } };
      });
      return { ...s, nodes };
    });

  const toggleEnding = (idx: number, isEnding: boolean) =>
    setState((s) => {
      if (!s) return s;
      const nodes = s.nodes.map((n, i) => {
        if (i !== idx) return n;
        if (isEnding) {
          return { ...n, isEnding: true, endingType: n.endingType ?? "neutral", question: undefined };
        }
        return {
          ...n,
          isEnding: false,
          endingType: undefined,
          question: n.question ?? {
            text: "¿Qué decides?",
            choices: [
              { id: uid("c"), label: "Opción A", feedback: "", points: 0, next: null, competencies: {} },
              { id: uid("c"), label: "Opción B", feedback: "", points: 0, next: null, competencies: {} },
            ],
          },
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
      for (const n of state.nodes) nodesRecord[n.id] = n;
      await save({
        data: {
          id,
          story: { startNodeId: state.startNodeId, nodes: nodesRecord },
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
                      for (const n of state.nodes) nodesRecord[n.id] = n;
                      await save({
                        data: {
                          id,
                          story: { startNodeId: state.startNodeId, nodes: nodesRecord },
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
              {state.nodes.map((n) => (
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
          <Accordion type="multiple" className="space-y-2">
            {state.nodes.map((n, nIdx) => (
              <AccordionItem key={n.id} value={n.id} className="border rounded-lg px-3">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2 text-left">
                    <Badge variant="default" className="text-[11px]">Escena {sceneOrder.get(n.id) ?? "?"}</Badge>
                    <span className="font-medium">{n.title}</span>
                    <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline">{n.id}</span>
                    {n.isEnding && (
                      <Badge variant={n.endingType === "success" ? "default" : "secondary"} className="gap-1">
                        <Flag className="h-3 w-3" /> Final
                      </Badge>
                    )}
                    {!n.isEnding && n.question && (
                      <Badge variant="outline" className="gap-1">
                        <GitBranch className="h-3 w-3" /> {n.question.choices.length}
                      </Badge>
                    )}
                  </div>
                </AccordionTrigger>
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
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-semibold">Vídeo de la escena</Label>
                        <p className="text-xs text-muted-foreground">
                          Elige el origen del vídeo y pega la URL. Si no quieres vídeo, deja "Sin vídeo".
                        </p>
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Tipo de vídeo</Label>
                        <Select
                          value={n.video?.type ?? "none"}
                          onValueChange={(v) =>
                            updateNode(nIdx, {
                              video:
                                v === "none"
                                  ? { type: "none" }
                                  : { type: v as "youtube" | "vimeo" | "mp4", url: (n.video as any)?.url ?? "" },
                            })
                          }
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sin vídeo</SelectItem>
                            <SelectItem value="youtube">YouTube</SelectItem>
                            <SelectItem value="vimeo">Vimeo</SelectItem>
                            <SelectItem value="mp4">MP4 (URL directa)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-xs">URL del vídeo</Label>
                        <Input
                          placeholder={
                            n.video?.type === "none"
                              ? "Selecciona primero un tipo de vídeo arriba"
                              : n.video?.type === "youtube"
                              ? "https://www.youtube.com/watch?v=..."
                              : n.video?.type === "vimeo"
                              ? "https://vimeo.com/..."
                              : "https://.../video.mp4"
                          }
                          disabled={n.video?.type === "none"}
                          value={(n.video as any)?.url ?? ""}
                          onChange={(e) =>
                            updateNode(nIdx, {
                              video: {
                                ...(n.video?.type === "none"
                                  ? { type: "mp4", url: "" }
                                  : (n.video as any)),
                                url: e.target.value,
                              } as VideoSource,
                            })
                          }
                        />
                      </div>
                    </div>
                    {n.video?.type !== "none" && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Inicio (segundos, opcional)</Label>
                          <Input
                            type="number"
                            min={0}
                            value={(n.video as any)?.startSec ?? ""}
                            onChange={(e) =>
                              updateNode(nIdx, {
                                video: {
                                  ...(n.video as any),
                                  startSec: e.target.value === "" ? undefined : Number(e.target.value),
                                } as VideoSource,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Fin (segundos, opcional)</Label>
                          <Input
                            type="number"
                            min={0}
                            value={(n.video as any)?.endSec ?? ""}
                            onChange={(e) =>
                              updateNode(nIdx, {
                                video: {
                                  ...(n.video as any),
                                  endSec: e.target.value === "" ? undefined : Number(e.target.value),
                                } as VideoSource,
                              })
                            }
                          />
                        </div>
                      </div>
                    )}
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

                  {!n.isEnding && n.question && (
                    <div className="space-y-3 rounded-lg border p-3">
                      <div className="space-y-1.5">
                        <Label>Pregunta</Label>
                        <Textarea
                          rows={2}
                          value={n.question.text}
                          onChange={(e) =>
                            updateNode(nIdx, { question: { ...n.question!, text: e.target.value } })
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Opciones y ramificaciones</Label>
                        <Button type="button" size="sm" variant="outline" onClick={() => addChoice(nIdx)} disabled={n.question.choices.length >= 4}>
                          <Plus className="h-3 w-3 mr-1" /> Añadir opción
                        </Button>
                      </div>

                      {n.question.choices.map((c, cIdx) => (
                        <div key={c.id} className="rounded-md border p-3 space-y-2 bg-muted/30">
                          <div className="grid grid-cols-12 gap-2">
                            <Input className="col-span-7" placeholder="Texto de la opción" value={c.label} onChange={(e) => updateChoice(nIdx, cIdx, { label: e.target.value })} />
                            <Input className="col-span-2" type="number" placeholder="Puntos" value={c.points} onChange={(e) => updateChoice(nIdx, cIdx, { points: Number(e.target.value) })} />
                            <Select
                              value={c.next ?? "__end__"}
                              onValueChange={(v) => updateChoice(nIdx, cIdx, { next: v === "__end__" ? null : v })}
                            >
                              <SelectTrigger className="col-span-2"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__end__">FIN</SelectItem>
                                {nodeIds.filter((nid) => nid !== n.id).map((nid) => (
                                  <SelectItem key={nid} value={nid}>{nid}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button type="button" variant="ghost" size="icon" className="col-span-1" onClick={() => deleteChoice(nIdx, cIdx)} disabled={n.question!.choices.length <= 2}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                          <Textarea
                            rows={2}
                            placeholder="Feedback al usuario tras elegir esta opción"
                            value={c.feedback}
                            onChange={(e) => updateChoice(nIdx, cIdx, { feedback: e.target.value })}
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
                                      updateChoice(nIdx, cIdx, {
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
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button type="button" variant="ghost" size="sm" onClick={() => deleteNode(nIdx)} className="text-destructive">
                      <Trash2 className="h-4 w-4 mr-1" /> Eliminar escena
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
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
