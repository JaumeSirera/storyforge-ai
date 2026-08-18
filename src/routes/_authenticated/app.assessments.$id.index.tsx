import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import {
  getAssessment,
  regenerateAssessment,
  createSubmission,
  gradeSubmission,
  deleteSubmission,
} from "@/lib/assessments.functions";
import { gradeLabel } from "@/lib/assessments-shared";
import { AssessmentCollaboratorsCard } from "@/components/AssessmentCollaboratorsCard";
import { AssessmentCandidatesCard } from "@/components/AssessmentCandidatesCard";
import { ExamAuditLogCard } from "@/components/ExamAuditLogCard";
import { CandidateAttemptsCard } from "@/components/CandidateAttemptsCard";
import { RubricEditor } from "@/components/RubricEditor";
import { SourceValidationCard } from "@/components/SourceValidationCard";

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
import { ArrowLeft, FileText, Loader2, RefreshCw, Sparkles, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/assessments/$id/")({
  head: () => ({
    meta: [
      { title: "Prueba escrita y entregas | Playnalyze" },
      {
        name: "description",
        content:
          "Revisa enunciados y rúbrica, sube entregas escaneadas o digitales y corrígelas con IA para obtener nota, análisis y conclusiones.",
      },
      { property: "og:title", content: "Prueba escrita y entregas | Playnalyze" },
      {
        property: "og:description",
        content: "Enunciados, rúbrica y corrección con IA de entregas manuscritas o digitales.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssessmentDetail,
});

function AssessmentDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const get = useServerFn(getAssessment);
  const regen = useServerFn(regenerateAssessment);
  const createSub = useServerFn(createSubmission);
  const grade = useServerFn(gradeSubmission);
  const delSub = useServerFn(deleteSubmission);

  const q = useQuery({ queryKey: ["assessment", id], queryFn: () => get({ data: { id } }) });
  const assessment = q.data?.assessment;
  const submissions = q.data?.submissions ?? [];
  const permissions = q.data?.permissions;

  const [prompt, setPrompt] = useState("");
  const [questionCount, setQuestionCount] = useState(4);
  const [candidateName, setCandidateName] = useState("");
  const [candidateId, setCandidateId] = useState("");
  const [sourceKind, setSourceKind] = useState<"handwritten" | "digital">("handwritten");
  const [typedText, setTypedText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["assessment", id] });

  const regenMut = useMutation({
    mutationFn: () =>
      regen({
        data: {
          id,
          prompt: (prompt || assessment?.prompt || "").trim().slice(0, 4000),
          questionCount,
        },
      }),
    onSuccess: () => {
      toast.success("Prueba generada");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo generar"),
  });

  const uploadMut = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.set("assessmentId", id);
      fd.set("candidateName", candidateName.trim());
      fd.set("candidateIdentifier", candidateId.trim());
      fd.set("sourceKind", sourceKind);
      fd.set("typedText", typedText);
      for (const file of Array.from(fileRef.current?.files ?? [])) fd.append("files", file);
      const res: any = await createSub({ data: fd });
      return grade({ data: { id: res.submission.id } });
    },
    onSuccess: () => {
      toast.success("Entrega corregida");
      setCandidateName("");
      setCandidateId("");
      setTypedText("");
      if (fileRef.current) fileRef.current.value = "";
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo corregir la entrega"),
  });

  const regradeMut = useMutation({
    mutationFn: (sid: string) => grade({ data: { id: sid } }),
    onSuccess: () => {
      toast.success("Corrección actualizada");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo corregir"),
  });

  const delMut = useMutation({
    mutationFn: (sid: string) => delSub({ data: { id: sid } }),
    onSuccess: () => {
      toast.success("Entrega eliminada");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo eliminar"),
  });

  if (q.isLoading) return <div className="text-muted-foreground">Cargando…</div>;
  if (!assessment) return <div className="text-muted-foreground">Evaluación no encontrada.</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link
            to="/app/assessments"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Evaluaciones
          </Link>
          <h1 className="text-2xl font-bold tracking-tight truncate">{assessment.title}</h1>
          <p className="text-sm text-muted-foreground">
            Área {assessment.areaKey ?? "general"} · máx {assessment.maxScore} puntos · grafismo{" "}
            {assessment.handwritingWeightPct}%
          </p>
        </div>
        <Badge variant={assessment.status === "ready" ? "default" : "secondary"}>
          {assessment.status === "ready" ? "Lista" : "Borrador"}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prueba</CardTitle>
          <CardDescription>
            {assessment.questions.length > 0
              ? "Enunciados y rúbrica generados por IA. Puedes volver a generarlos con otro encargo."
              : "Todavía no hay preguntas. Describe el encargo y genera la prueba."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {assessment.instructions && (
            <p className="rounded-md bg-muted/60 p-3 text-sm">{assessment.instructions}</p>
          )}

          {assessment.questions.length > 0 && (
            <ol className="space-y-3">
              {assessment.questions.map((question, i) => (
                <li key={question.id || i} className="rounded-md border border-border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-sm">
                      {i + 1}. {question.prompt}
                    </p>
                    <Badge variant="secondary" className="shrink-0">
                      {question.maxPoints} pts
                    </Badge>
                  </div>
                  {question.keyElements.length > 0 && (
                    <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground space-y-0.5">
                      {question.keyElements.map((el, j) => (
                        <li key={j}>{el}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          )}

          {assessment.rubric.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Rúbrica</h3>
              <div className="grid gap-2 md:grid-cols-2">
                {assessment.rubric.map((criterion, i) => (
                  <div key={criterion.id || i} className="rounded-md border border-border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{criterion.name}</span>
                      <Badge variant="outline">{criterion.weightPct}%</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{criterion.description}</p>
                    <ul className="mt-2 space-y-0.5 text-xs">
                      {criterion.levels.map((level, j) => (
                        <li key={j}>
                          <span className="font-medium">{level.label}</span> ({level.pct}%):{" "}
                          {level.descriptor}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2 border-t border-border pt-4">
            <Label htmlFor="regen-prompt">Encargo para (re)generar la prueba</Label>
            <Textarea
              id="regen-prompt"
              rows={3}
              value={prompt || assessment.prompt || ""}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="regen-count">Nº de preguntas</Label>
                <Input
                  id="regen-count"
                  type="number"
                  min={1}
                  max={12}
                  className="w-28"
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value) || 4)}
                />
              </div>
              <Button
                variant="secondary"
                onClick={() => regenMut.mutate()}
                disabled={regenMut.isPending}
              >
                {regenMut.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Generar con IA
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {assessment.questions.length > 0 && (
        <SourceValidationCard
          assessmentId={id}
          hasSourceText={Boolean(assessment.sourceText && assessment.sourceText.trim().length >= 30)}
          questionCount={assessment.questions.length}
        />
      )}

      <AssessmentCandidatesCard
        assessmentId={id}
        canManage={permissions?.isOwner !== false}
        submissions={submissions}
      />

      {permissions?.isOwner !== false && <CandidateAttemptsCard assessmentId={id} />}

      {permissions?.isOwner !== false && <ExamAuditLogCard assessmentId={id} />}

      {permissions?.isOwner !== false && <RubricEditor assessment={assessment} onSaved={invalidate} />}

      {permissions?.canView && (
        <AssessmentCollaboratorsCard
          assessmentId={id}
          canManage={Boolean(permissions.canManageCollaborators)}
        />
      )}




      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nueva entrega</CardTitle>
          <CardDescription>
            Sube fotos o el PDF escaneado del examen manuscrito (o de un documento digitalizado). La IA
            transcribe, corrige con la rúbrica y analiza el grafismo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="s-name">Candidato / estudiante</Label>
              <Input
                id="s-name"
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                placeholder="Nombre y apellidos"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-id">Identificador (opcional)</Label>
              <Input
                id="s-id"
                value={candidateId}
                onChange={(e) => setCandidateId(e.target.value)}
                placeholder="Nº de expediente"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-kind">Origen</Label>
              <Select value={sourceKind} onValueChange={(v) => setSourceKind(v as any)}>
                <SelectTrigger id="s-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="handwritten">Escrito a mano</SelectItem>
                  <SelectItem value="digital">Documento digital</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="s-files">Páginas (imágenes o PDF, máx. 12 · 15 MB cada una)</Label>
            <Input id="s-files" ref={fileRef} type="file" multiple accept="image/*,application/pdf" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="s-text">Texto ya transcrito (opcional)</Label>
            <Textarea
              id="s-text"
              rows={3}
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              placeholder="Si ya tienes la respuesta en texto, pégala aquí y se usará tal cual."
            />
          </div>

          <Button
            onClick={() => uploadMut.mutate()}
            disabled={uploadMut.isPending || !candidateName.trim()}
          >
            {uploadMut.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Subir y corregir con IA
          </Button>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Entregas ({submissions.length})</h2>
        {submissions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Sin entregas todavía.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {submissions.map((submission: any) => (
              <Card key={submission.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-medium truncate">{submission.candidateName}</span>
                      <Badge
                        variant={
                          submission.status === "graded"
                            ? "default"
                            : submission.status === "failed"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {submission.status === "graded"
                          ? "Corregida"
                          : submission.status === "failed"
                            ? "Error"
                            : submission.status === "grading"
                              ? "Corrigiendo…"
                              : "Pendiente"}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {submission.score !== null && submission.maxScore
                        ? `${submission.score} / ${submission.maxScore} · ${gradeLabel(submission.score, submission.maxScore)}`
                        : "Sin nota"}{" "}
                      · {submission.pages.length} página(s)
                      {submission.errorMessage ? ` · ${submission.errorMessage}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button asChild size="sm" variant="secondary">
                      <Link
                        to="/app/assessments/$id/submissions/$sid"
                        params={{ id, sid: submission.id }}
                      >
                        Ver informe
                      </Link>
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Volver a corregir"
                      onClick={() => regradeMut.mutate(submission.id)}
                      disabled={regradeMut.isPending}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Eliminar entrega"
                      onClick={() => delMut.mutate(submission.id)}
                      disabled={delMut.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
