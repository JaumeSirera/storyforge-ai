import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listAssessments, createAssessment, deleteAssessment } from "@/lib/assessments.functions";
import { listPracticeAreas } from "@/lib/areas.functions";
import {
  ASSESSMENT_SUBJECTS,
  FEEDBACK_TONES,
  FEEDBACK_TONE_LABELS,
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  SUBJECT_LABELS,
  type AssessmentSubject,
  type FeedbackTone,
  type QuestionType,
} from "@/lib/assessments-shared";
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
import { Database, FileText, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/assessments/")({
  head: () => ({
    meta: [
      { title: "Evaluaciones escritas con IA | Playnalyze" },
      {
        name: "description",
        content:
          "Crea pruebas escritas con rúbrica generada por IA, escanea las respuestas a mano o en PDF y obtén nota, métricas y análisis del grafismo.",
      },
      { property: "og:title", content: "Evaluaciones escritas con IA | Playnalyze" },
      {
        property: "og:description",
        content: "Corrige exámenes manuscritos y documentos digitalizados con rúbrica, nota e informe.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssessmentsIndex,
});

function AssessmentsIndex() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const list = useServerFn(listAssessments);
  const create = useServerFn(createAssessment);
  const del = useServerFn(deleteAssessment);
  const areasFn = useServerFn(listPracticeAreas);

  const assessments = useQuery({ queryKey: ["assessments"], queryFn: () => list() });
  const areas = useQuery({ queryKey: ["practice-areas"], queryFn: () => areasFn() });

  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [areaKey, setAreaKey] = useState<string>("general");
  const [maxScore, setMaxScore] = useState(10);
  const [questionCount, setQuestionCount] = useState(4);
  const [handwritingWeight, setHandwritingWeight] = useState(15);
  const [feedbackTone, setFeedbackTone] = useState<FeedbackTone>("formativo");
  const [subject, setSubject] = useState<AssessmentSubject>("generico");
  const [types, setTypes] = useState<QuestionType[]>(["narrative"]);
  const [sourceText, setSourceText] = useState("");
  const [allowOutsideSource, setAllowOutsideSource] = useState(false);

  const toggleType = (t: QuestionType) =>
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const createMut = useMutation({
    mutationFn: () =>
      create({
        data: {
          title: title.trim() || "Prueba escrita",
          prompt: prompt.trim() || undefined,
          areaKey: areaKey === "general" ? null : areaKey,
          maxScore,
          handwritingWeightPct: handwritingWeight,
          feedbackTone,
          questionCount,
          generate: prompt.trim().length >= 10 || sourceText.trim().length >= 50,
          subject,
          questionTypes: types.length > 0 ? types : ["narrative"],
          sourceText: sourceText.trim().slice(0, 200000) || null,
          allowOutsideSource,
        },
      }),

    onSuccess: (res: any) => {
      toast.success("Evaluación creada");
      void qc.invalidateQueries({ queryKey: ["assessments"] });
      navigate({ to: "/app/assessments/$id", params: { id: res.assessment.id } });
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo crear"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Evaluación eliminada");
      void qc.invalidateQueries({ queryKey: ["assessments"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo eliminar"),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Evaluaciones escritas</h1>
          <p className="text-muted-foreground">
            Igual que las simulaciones, pero sobre texto: define la prueba con IA, escanea las respuestas
            (manuscritas o digitales) y obtén nota, métricas, análisis del grafismo e informe.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link to="/app/assessments/bank">
            <Database className="h-4 w-4 mr-2" /> Banco de preguntas
          </Link>
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" /> Nueva evaluación
          </CardTitle>
          <CardDescription>
            Describe la prueba y la IA genera enunciados, elementos clave y rúbrica analítica.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="a-title">Título</Label>
              <Input
                id="a-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Examen de atención al cliente — nivel intermedio"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-area">Área</Label>
              <Select value={areaKey} onValueChange={setAreaKey}>
                <SelectTrigger id="a-area">
                  <SelectValue placeholder="Área" />
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

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="a-subject">Materia / tipo de contenido</Label>
              <Select value={subject} onValueChange={(v) => setSubject(v as AssessmentSubject)}>
                <SelectTrigger id="a-subject">
                  <SelectValue placeholder="Materia" />
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
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="a-prompt">Encargo para la IA</Label>
            <Textarea
              id="a-prompt"
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Test psicotécnico de 10 preguntas de series numéricas y razonamiento lógico para operarios de almacén, con una única alternativa correcta."
            />
            <p className="text-xs text-muted-foreground">
              Con menos de 10 caracteres (y sin texto base) se crea vacía y podrás generar la prueba
              después.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="a-source">Texto o tema base (opcional)</Label>
            <Textarea
              id="a-source"
              rows={5}
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder="Pega aquí el texto, el temario o el enunciado del caso sobre el que la IA debe formular las preguntas (comprensión lectora, física, biología…)."
            />
            <label className="flex items-start gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-primary"
                checked={allowOutsideSource}
                onChange={(e) => setAllowOutsideSource(e.target.checked)}
              />
              Permitir preguntas fuera del texto base. Desactivado (recomendado), la IA se ciñe al
              texto: nada de datos inventados y cada respuesta se justifica con un fragmento del texto.
            </label>
          </div>


          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="a-max">Puntuación máxima</Label>
              <Input
                id="a-max"
                type="number"
                min={1}
                max={100}
                value={maxScore}
                onChange={(e) => setMaxScore(Number(e.target.value) || 10)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-count">Nº de preguntas</Label>
              <Input
                id="a-count"
                type="number"
                min={1}
                max={12}
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value) || 4)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-hw">Peso del grafismo (%)</Label>
              <Input
                id="a-hw"
                type="number"
                min={0}
                max={50}
                value={handwritingWeight}
                onChange={(e) => setHandwritingWeight(Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-tone">Tono del feedback</Label>
              <Select value={feedbackTone} onValueChange={(v) => setFeedbackTone(v as FeedbackTone)}>
                <SelectTrigger id="a-tone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FEEDBACK_TONES.map((tone) => (
                    <SelectItem key={tone} value={tone}>
                      {FEEDBACK_TONE_LABELS[tone]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
            {createMut.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Crear evaluación
          </Button>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Mis evaluaciones</h2>
        {assessments.isLoading ? (
          <div className="text-muted-foreground">Cargando…</div>
        ) : (assessments.data?.assessments ?? []).length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Todavía no has creado ninguna evaluación escrita.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {(assessments.data?.assessments ?? []).map((a: any) => (
              <Card key={a.id}>
                <CardContent className="flex items-start justify-between gap-3 p-4">
                  <Link
                    to="/app/assessments/$id"
                    params={{ id: a.id }}
                    className="min-w-0 flex-1 space-y-1"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-medium truncate">{a.title}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant={a.status === "ready" ? "default" : "secondary"}>
                        {a.status === "ready" ? "Lista" : "Borrador"}
                      </Badge>
                      <span>{a.questions.length} preguntas</span>
                      <span>· máx {a.maxScore}</span>
                      <span>· grafismo {a.handwritingWeightPct}%</span>
                    </div>
                  </Link>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Eliminar ${a.title}`}
                    onClick={() => delMut.mutate(a.id)}
                    disabled={delMut.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
