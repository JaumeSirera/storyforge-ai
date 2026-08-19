import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  createAssessmentFromBank,
  deleteBankItem,
  generateBankQuestions,
  importAssessmentQuestions,
  listBankItems,
  listBankVersions,
  restoreBankVersion,
  updateBankItem,
} from "@/lib/question-bank.functions";
import { listAssessments } from "@/lib/assessments.functions";
import { listPracticeAreas } from "@/lib/areas.functions";
import {
  ASSESSMENT_SUBJECTS,
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  SUBJECT_LABELS,
  type AssessmentQuestion,
  type AssessmentSubject,
  type QuestionType,
} from "@/lib/assessments-shared";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Database,
  History,
  Import,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/assessments/bank")({
  head: () => ({
    meta: [
      { title: "Banco de preguntas reutilizables | Xandralyze" },
      {
        name: "description",
        content:
          "Genera preguntas con IA, guárdalas con etiquetas y versiones, y compón nuevas evaluaciones escritas reutilizando tu banco de preguntas.",
      },
      { property: "og:title", content: "Banco de preguntas reutilizables | Xandralyze" },
      {
        property: "og:description",
        content: "Preguntas guardadas con historial de versiones para crear evaluaciones en segundos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QuestionBankPage,
});

function QuestionBankPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const listFn = useServerFn(listBankItems);
  const genFn = useServerFn(generateBankQuestions);
  const importFn = useServerFn(importAssessmentQuestions);
  const updateFn = useServerFn(updateBankItem);
  const delFn = useServerFn(deleteBankItem);
  const composeFn = useServerFn(createAssessmentFromBank);
  const versionsFn = useServerFn(listBankVersions);
  const restoreFn = useServerFn(restoreBankVersion);
  const areasFn = useServerFn(listPracticeAreas);
  const assessmentsFn = useServerFn(listAssessments);

  // filtros
  const [fSubject, setFSubject] = useState("all");
  const [fType, setFType] = useState("all");
  const [search, setSearch] = useState("");

  const filters = {
    subject: fSubject === "all" ? null : fSubject,
    type: fType === "all" ? null : (fType as QuestionType),
    search: search.trim() || null,
  };

  const items = useQuery({
    queryKey: ["bank-items", filters.subject, filters.type, filters.search],
    queryFn: () => listFn({ data: filters }),
  });
  const areas = useQuery({ queryKey: ["practice-areas"], queryFn: () => areasFn() });
  const assessments = useQuery({ queryKey: ["assessments"], queryFn: () => assessmentsFn() });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["bank-items"] });

  // generación
  const [prompt, setPrompt] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [allowOutsideSource, setAllowOutsideSource] = useState(false);
  const [subject, setSubject] = useState<AssessmentSubject>("generico");
  const [areaKey, setAreaKey] = useState("general");
  const [types, setTypes] = useState<QuestionType[]>(["single_choice"]);
  const [count, setCount] = useState(5);
  const [tags, setTags] = useState("");
  const [importFrom, setImportFrom] = useState("");

  const toggleType = (t: QuestionType) =>
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const tagList = () =>
    tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 10);

  const genMut = useMutation({
    mutationFn: () =>
      genFn({
        data: {
          prompt: prompt.trim(),
          questionCount: count,
          subject,
          areaKey: areaKey === "general" ? null : areaKey,
          questionTypes: types.length > 0 ? types : ["narrative"],
          sourceText: sourceText.trim() || null,
          allowOutsideSource,
          tags: tagList(),
        },
      }),
    onSuccess: (res: any) => {
      toast.success(`${res.items.length} pregunta(s) añadidas al banco`);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudieron generar preguntas"),
  });

  const importMut = useMutation({
    mutationFn: () => importFn({ data: { assessmentId: importFrom, tags: tagList() } }),
    onSuccess: (res: any) => {
      toast.success(`${res.items.length} pregunta(s) importadas`);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo importar"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Pregunta eliminada del banco");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo eliminar"),
  });

  // selección + composición
  const [selected, setSelected] = useState<string[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [hwWeight, setHwWeight] = useState(15);

  const toggleSelected = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const composeMut = useMutation({
    mutationFn: () =>
      composeFn({
        data: {
          title: newTitle.trim() || "Evaluación desde banco",
          itemIds: selected,
          areaKey: areaKey === "general" ? null : areaKey,
          handwritingWeightPct: hwWeight,
        },
      }),
    onSuccess: (res: any) => {
      toast.success("Evaluación creada desde el banco");
      setSelected([]);
      setNewTitle("");
      void qc.invalidateQueries({ queryKey: ["assessments"] });
      navigate({ to: "/app/assessments/$id", params: { id: res.assessment.id } });
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo crear la evaluación"),
  });

  // edición / versiones
  const [editing, setEditing] = useState<any | null>(null);
  const [editDraft, setEditDraft] = useState<AssessmentQuestion | null>(null);
  const [editNote, setEditNote] = useState("");
  const [historyId, setHistoryId] = useState<string | null>(null);

  const versions = useQuery({
    queryKey: ["bank-versions", historyId],
    queryFn: () => versionsFn({ data: { id: historyId! } }),
    enabled: Boolean(historyId),
  });

  const saveMut = useMutation({
    mutationFn: () =>
      updateFn({
        data: { id: editing.id, question: editDraft as any, note: editNote.trim() || undefined },
      }),
    onSuccess: () => {
      toast.success("Nueva versión guardada");
      setEditing(null);
      setEditDraft(null);
      setEditNote("");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo guardar"),
  });

  const restoreMut = useMutation({
    mutationFn: (version: number) => restoreFn({ data: { id: historyId!, version } }),
    onSuccess: () => {
      toast.success("Versión restaurada");
      setHistoryId(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo restaurar"),
  });

  const list = items.data?.items ?? [];
  const selectedCount = selected.length;
  const selectedPoints = useMemo(
    () =>
      list
        .filter((i: any) => selected.includes(i.id))
        .reduce((sum: number, i: any) => sum + (i.question.maxPoints || 1), 0),
    [list, selected],
  );

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link
          to="/app/assessments"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Evaluaciones
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Database className="h-5 w-5 text-primary" /> Banco de preguntas
        </h1>
        <p className="text-muted-foreground">
          Genera preguntas con IA o impórtalas de tus evaluaciones, edítalas con historial de versiones y
          compón nuevas pruebas reutilizándolas.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" /> Generar preguntas con IA
          </CardTitle>
          <CardDescription>
            Las preguntas se guardan en el banco como versión 1 y podrás reutilizarlas en cualquier
            evaluación.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="b-subject">Materia</Label>
              <Select value={subject} onValueChange={(v) => setSubject(v as AssessmentSubject)}>
                <SelectTrigger id="b-subject">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSESSMENT_SUBJECTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SUBJECT_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-area">Área</Label>
              <Select value={areaKey} onValueChange={setAreaKey}>
                <SelectTrigger id="b-area">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  {(areas.data ?? []).map((a: any) => (
                    <SelectItem key={a.key} value={a.key}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Tipos de pregunta</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-md border border-border p-3">
              {QUESTION_TYPES.map((t) => (
                <label key={t} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={types.includes(t)}
                    onChange={() => toggleType(t)}
                  />
                  {QUESTION_TYPE_LABELS[t]}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="b-prompt">Encargo para la IA</Label>
            <Textarea
              id="b-prompt"
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="10 preguntas de series numéricas y razonamiento lógico de dificultad media para operarios de almacén."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="b-source">Texto o temario base (opcional)</Label>
            <Textarea
              id="b-source"
              rows={4}
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
            />
            <label className="flex items-start gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-primary"
                checked={allowOutsideSource}
                onChange={(e) => setAllowOutsideSource(e.target.checked)}
              />
              Permitir preguntas fuera del texto base. Desactivado, la IA solo formula preguntas
              verificables con el texto aportado y no inventa contenido.
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="b-count">Nº de preguntas</Label>
              <Input
                id="b-count"
                type="number"
                min={1}
                max={20}
                value={count}
                onChange={(e) => setCount(Number(e.target.value) || 5)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-tags">Etiquetas (separadas por comas)</Label>
              <Input
                id="b-tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="almacén, lógica, nivel medio"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <Button
              onClick={() => genMut.mutate()}
              disabled={genMut.isPending || prompt.trim().length < 10}
            >
              {genMut.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Generar y guardar
            </Button>

            <div className="flex items-end gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="b-import">Importar preguntas de una evaluación</Label>
                <Select value={importFrom} onValueChange={setImportFrom}>
                  <SelectTrigger id="b-import" className="w-64">
                    <SelectValue placeholder="Elige una evaluación" />
                  </SelectTrigger>
                  <SelectContent>
                    {(assessments.data?.assessments ?? []).map((a: any) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="secondary"
                onClick={() => importMut.mutate()}
                disabled={!importFrom || importMut.isPending}
              >
                {importMut.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Import className="h-4 w-4 mr-2" />
                )}
                Importar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preguntas guardadas ({list.length})</CardTitle>
          <CardDescription>
            Filtra, revisa versiones y selecciona las preguntas que quieras reutilizar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="f-search">Buscar</Label>
              <Input
                id="f-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Palabra del enunciado"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-subject">Materia</Label>
              <Select value={fSubject} onValueChange={setFSubject}>
                <SelectTrigger id="f-subject">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {ASSESSMENT_SUBJECTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SUBJECT_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-type">Tipo</Label>
              <Select value={fType} onValueChange={setFType}>
                <SelectTrigger id="f-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {QUESTION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {QUESTION_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {items.isLoading ? (
            <div className="text-muted-foreground">Cargando…</div>
          ) : list.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">
              Todavía no hay preguntas en el banco.
            </p>
          ) : (
            <ul className="space-y-2">
              {list.map((item: any) => (
                <li key={item.id} className="rounded-md border border-border p-3">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selected.includes(item.id)}
                      onCheckedChange={() => toggleSelected(item.id)}
                      aria-label={`Seleccionar pregunta ${item.prompt.slice(0, 40)}`}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm font-medium">{item.prompt}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="secondary">
                          {QUESTION_TYPE_LABELS[item.type as QuestionType] ?? item.type}
                        </Badge>
                        <Badge variant="outline">v{item.version}</Badge>
                        {item.subject && <span>{SUBJECT_LABELS[item.subject as AssessmentSubject] ?? item.subject}</span>}
                        <span>· {item.question.maxPoints || 1} pts</span>
                        <span>· usada {item.timesUsed} vez(ces)</span>
                        {item.tags.map((t: string) => (
                          <Badge key={t} variant="outline">
                            {t}
                          </Badge>
                        ))}
                      </div>
                      {item.question.options?.length > 0 && (
                        <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                          {item.question.options.map((o: any) => (
                            <li key={o.id}>
                              <span
                                className={
                                  item.question.correctOptionIds?.includes(o.id)
                                    ? "font-semibold text-foreground"
                                    : ""
                                }
                              >
                                {o.id}) {o.text}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {item.question.correctAnswer && (
                        <p className="text-xs text-muted-foreground">
                          Respuesta: <span className="text-foreground">{item.question.correctAnswer}</span>
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Editar pregunta"
                        onClick={() => {
                          setEditing(item);
                          setEditDraft({ ...item.question });
                          setEditNote("");
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Ver historial de versiones"
                        onClick={() => setHistoryId(item.id)}
                      >
                        <History className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Eliminar del banco"
                        onClick={() => delMut.mutate(item.id)}
                        disabled={delMut.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Crear evaluación con la selección</CardTitle>
          <CardDescription>
            {selectedCount} pregunta(s) seleccionadas · {selectedPoints} puntos totales.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="c-title">Título de la evaluación</Label>
              <Input
                id="c-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Prueba de acceso — turno de mañana"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-hw">Peso del grafismo (%)</Label>
              <Input
                id="c-hw"
                type="number"
                min={0}
                max={50}
                value={hwWeight}
                onChange={(e) => setHwWeight(Number(e.target.value) || 0)}
              />
            </div>
          </div>
          <Button
            onClick={() => composeMut.mutate()}
            disabled={composeMut.isPending || selectedCount === 0}
          >
            {composeMut.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Crear evaluación
          </Button>
        </CardContent>
      </Card>

      {/* Editor de pregunta (crea nueva versión) */}
      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
            setEditDraft(null);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar pregunta</DialogTitle>
            <DialogDescription>
              Al guardar se crea una versión nueva y la anterior queda en el historial.
            </DialogDescription>
          </DialogHeader>
          {editDraft && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="e-prompt">Enunciado</Label>
                <Textarea
                  id="e-prompt"
                  rows={3}
                  value={editDraft.prompt}
                  onChange={(e) => setEditDraft({ ...editDraft, prompt: e.target.value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="e-type">Tipo</Label>
                  <Select
                    value={editDraft.type}
                    onValueChange={(v) => setEditDraft({ ...editDraft, type: v as QuestionType })}
                  >
                    <SelectTrigger id="e-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {QUESTION_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {QUESTION_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="e-points">Puntos</Label>
                  <Input
                    id="e-points"
                    type="number"
                    min={0}
                    max={100}
                    value={editDraft.maxPoints}
                    onChange={(e) =>
                      setEditDraft({ ...editDraft, maxPoints: Number(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>

              {editDraft.options.length > 0 && (
                <div className="space-y-2">
                  <Label>Alternativas (marca las correctas)</Label>
                  {editDraft.options.map((o, i) => (
                    <div key={`${o.id}-${i}`} className="flex items-center gap-2">
                      <Checkbox
                        checked={editDraft.correctOptionIds.includes(o.id)}
                        onCheckedChange={() =>
                          setEditDraft({
                            ...editDraft,
                            correctOptionIds: editDraft.correctOptionIds.includes(o.id)
                              ? editDraft.correctOptionIds.filter((x) => x !== o.id)
                              : [...editDraft.correctOptionIds, o.id],
                          })
                        }
                        aria-label={`Alternativa ${o.id} correcta`}
                      />
                      <Input
                        value={o.text}
                        onChange={(e) => {
                          const options = [...editDraft.options];
                          options[i] = { ...o, text: e.target.value };
                          setEditDraft({ ...editDraft, options });
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="e-answer">Respuesta esperada (numéricas / cálculo)</Label>
                <Input
                  id="e-answer"
                  value={editDraft.correctAnswer}
                  onChange={(e) => setEditDraft({ ...editDraft, correctAnswer: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="e-explanation">Justificación para el corrector</Label>
                <Textarea
                  id="e-explanation"
                  rows={2}
                  value={editDraft.explanation}
                  onChange={(e) => setEditDraft({ ...editDraft, explanation: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="e-note">Nota del cambio</Label>
                <Input
                  id="e-note"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="Reformulado el enunciado para mayor claridad"
                />
              </div>

              <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
                {saveMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Guardar nueva versión
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Historial de versiones */}
      <Dialog open={Boolean(historyId)} onOpenChange={(open) => !open && setHistoryId(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Historial de versiones</DialogTitle>
            <DialogDescription>
              Consulta cómo era la pregunta en cada versión y restaura la que quieras.
            </DialogDescription>
          </DialogHeader>
          {versions.isLoading ? (
            <div className="text-muted-foreground">Cargando…</div>
          ) : (
            <ul className="space-y-2">
              {(versions.data?.versions ?? []).map((v: any) => (
                <li key={v.id} className="rounded-md border border-border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">v{v.version}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(v.createdAt).toLocaleString("es-ES")}
                        </span>
                      </div>
                      <p className="mt-1 text-sm">{v.question.prompt}</p>
                      {v.note && <p className="text-xs text-muted-foreground">{v.note}</p>}
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => restoreMut.mutate(v.version)}
                      disabled={restoreMut.isPending}
                    >
                      Restaurar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
