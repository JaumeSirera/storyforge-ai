import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { updateAssessmentBlueprint } from "@/lib/assessments.functions";
import type { AssessmentQuestion, AssessmentRecord, RubricCriterion } from "@/lib/assessments-shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, RotateCcw, Save, Scale, Trash2 } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_LEVELS = [
  { label: "Excelente", descriptor: "", pct: 100 },
  { label: "Adecuado", descriptor: "", pct: 70 },
  { label: "Insuficiente", descriptor: "", pct: 30 },
];

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

interface Props {
  assessment: AssessmentRecord;
  onSaved?: () => void;
}

export function RubricEditor({ assessment, onSaved }: Props) {
  const save = useServerFn(updateAssessmentBlueprint);

  const [rubric, setRubric] = useState<RubricCriterion[]>(assessment.rubric);
  const [questions, setQuestions] = useState<AssessmentQuestion[]>(assessment.questions);
  const [instructions, setInstructions] = useState(assessment.instructions ?? "");
  const [maxScore, setMaxScore] = useState(assessment.maxScore);
  const [handwritingWeightPct, setHandwritingWeightPct] = useState(assessment.handwritingWeightPct);

  const reset = () => {
    setRubric(assessment.rubric);
    setQuestions(assessment.questions);
    setInstructions(assessment.instructions ?? "");
    setMaxScore(assessment.maxScore);
    setHandwritingWeightPct(assessment.handwritingWeightPct);
  };

  useEffect(reset, [assessment]);

  const weightTotal = rubric.reduce((acc, c) => acc + (Number(c.weightPct) || 0), 0);
  const pointsTotal = questions.reduce((acc, q) => acc + (Number(q.maxPoints) || 0), 0);

  const patchCriterion = (i: number, patch: Partial<RubricCriterion>) =>
    setRubric((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  const patchLevel = (ci: number, li: number, patch: Partial<RubricCriterion["levels"][number]>) =>
    setRubric((prev) =>
      prev.map((c, idx) =>
        idx === ci
          ? { ...c, levels: c.levels.map((l, lj) => (lj === li ? { ...l, ...patch } : l)) }
          : c,
      ),
    );

  const patchQuestion = (i: number, patch: Partial<AssessmentQuestion>) =>
    setQuestions((prev) => prev.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));

  const distributeWeights = () => {
    if (rubric.length === 0) return;
    const base = Math.floor(100 / rubric.length);
    setRubric((prev) =>
      prev.map((c, i) => ({
        ...c,
        weightPct: i === prev.length - 1 ? 100 - base * (prev.length - 1) : base,
      })),
    );
  };

  const mut = useMutation({
    mutationFn: () =>
      save({
        data: {
          id: assessment.id,
          instructions,
          maxScore,
          handwritingWeightPct,
          questions: questions.map((q, i) => ({
            id: q.id || uid(`q${i + 1}`),
            prompt: q.prompt,
            type: "narrative" as const,
            maxPoints: Number(q.maxPoints) || 0,
            keyElements: q.keyElements ?? [],
          })),
          rubric: rubric.map((c, i) => ({
            id: c.id || uid(`c${i + 1}`),
            name: c.name,
            description: c.description,
            weightPct: Number(c.weightPct) || 0,
            levels: (c.levels ?? []).map((l) => ({
              label: l.label,
              descriptor: l.descriptor,
              pct: Number(l.pct) || 0,
            })),
          })),
        },
      }),
    onSuccess: () => {
      toast.success("Rúbrica guardada");
      onSaved?.();
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo guardar la rúbrica"),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Scale className="h-4 w-4 text-primary" /> Editor de rúbrica
            </CardTitle>
            <CardDescription>
              Ajusta criterios, pesos y niveles antes de enviar las páginas al análisis con IA. La
              corrección usará exactamente esta rúbrica.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={weightTotal === 100 ? "default" : "destructive"}>
              Pesos: {weightTotal}%
            </Badge>
            <Badge variant="secondary">Puntos preguntas: {pointsTotal}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="rb-max">Nota máxima</Label>
            <Input
              id="rb-max"
              type="number"
              min={1}
              max={100}
              value={maxScore}
              onChange={(e) => setMaxScore(Number(e.target.value) || 1)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rb-hw">Peso del grafismo (%)</Label>
            <Input
              id="rb-hw"
              type="number"
              min={0}
              max={50}
              value={handwritingWeightPct}
              onChange={(e) => setHandwritingWeightPct(Number(e.target.value) || 0)}
            />
          </div>
          <div className="flex items-end">
            <Button variant="outline" className="w-full" onClick={distributeWeights}>
              Repartir pesos al 100%
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rb-instructions">Instrucciones para el candidato</Label>
          <Textarea
            id="rb-instructions"
            rows={2}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Criterios</h3>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                setRubric((prev) => [
                  ...prev,
                  {
                    id: uid("c"),
                    name: "Nuevo criterio",
                    description: "",
                    weightPct: 0,
                    levels: DEFAULT_LEVELS.map((l) => ({ ...l })),
                  },
                ])
              }
            >
              <Plus className="h-4 w-4 mr-1" /> Criterio
            </Button>
          </div>

          {rubric.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Aún no hay criterios. Añade uno o genera la prueba con IA.
            </p>
          )}

          {rubric.map((criterion, ci) => (
            <div key={criterion.id || ci} className="rounded-md border border-border p-3 space-y-3">
              <div className="grid gap-3 md:grid-cols-[1fr_7rem_auto] md:items-end">
                <div className="space-y-1.5">
                  <Label htmlFor={`c-name-${ci}`}>Nombre</Label>
                  <Input
                    id={`c-name-${ci}`}
                    value={criterion.name}
                    onChange={(e) => patchCriterion(ci, { name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`c-weight-${ci}`}>Peso (%)</Label>
                  <Input
                    id={`c-weight-${ci}`}
                    type="number"
                    min={0}
                    max={100}
                    value={criterion.weightPct}
                    onChange={(e) => patchCriterion(ci, { weightPct: Number(e.target.value) || 0 })}
                  />
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Eliminar criterio ${criterion.name}`}
                  onClick={() => setRubric((prev) => prev.filter((_, i) => i !== ci))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`c-desc-${ci}`}>Descripción</Label>
                <Textarea
                  id={`c-desc-${ci}`}
                  rows={2}
                  value={criterion.description}
                  onChange={(e) => patchCriterion(ci, { description: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    Niveles de desempeño
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      patchCriterion(ci, {
                        levels: [...(criterion.levels ?? []), { label: "", descriptor: "", pct: 0 }],
                      })
                    }
                  >
                    <Plus className="h-4 w-4 mr-1" /> Nivel
                  </Button>
                </div>
                {(criterion.levels ?? []).map((level, li) => (
                  <div key={li} className="grid gap-2 md:grid-cols-[10rem_1fr_6rem_auto]">
                    <Input
                      aria-label="Etiqueta del nivel"
                      placeholder="Etiqueta"
                      value={level.label}
                      onChange={(e) => patchLevel(ci, li, { label: e.target.value })}
                    />
                    <Input
                      aria-label="Descriptor del nivel"
                      placeholder="Descriptor observable"
                      value={level.descriptor}
                      onChange={(e) => patchLevel(ci, li, { descriptor: e.target.value })}
                    />
                    <Input
                      aria-label="Porcentaje del nivel"
                      type="number"
                      min={0}
                      max={100}
                      value={level.pct}
                      onChange={(e) => patchLevel(ci, li, { pct: Number(e.target.value) || 0 })}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Eliminar nivel"
                      onClick={() =>
                        patchCriterion(ci, {
                          levels: (criterion.levels ?? []).filter((_, i) => i !== li),
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3 border-t border-border pt-4">
          <h3 className="text-sm font-semibold">Preguntas y puntos</h3>
          {questions.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin preguntas todavía.</p>
          )}
          {questions.map((question, qi) => (
            <div key={question.id || qi} className="grid gap-2 md:grid-cols-[1fr_6rem_auto]">
              <Textarea
                aria-label={`Enunciado ${qi + 1}`}
                rows={2}
                value={question.prompt}
                onChange={(e) => patchQuestion(qi, { prompt: e.target.value })}
              />
              <Input
                aria-label={`Puntos de la pregunta ${qi + 1}`}
                type="number"
                min={0}
                value={question.maxPoints}
                onChange={(e) => patchQuestion(qi, { maxPoints: Number(e.target.value) || 0 })}
              />
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Eliminar pregunta ${qi + 1}`}
                onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== qi))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              setQuestions((prev) => [
                ...prev,
                { id: uid("q"), prompt: "", type: "narrative", maxPoints: 1, keyElements: [] },
              ])
            }
          >
            <Plus className="h-4 w-4 mr-1" /> Pregunta
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Guardar rúbrica
          </Button>
          <Button variant="ghost" onClick={reset} disabled={mut.isPending}>
            <RotateCcw className="h-4 w-4 mr-2" /> Descartar cambios
          </Button>
          {weightTotal !== 100 && rubric.length > 0 && (
            <span className="text-xs text-destructive">
              Los pesos suman {weightTotal}%; ajusta hasta 100% para una ponderación exacta.
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
