import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSubmission, gradeSubmission } from "@/lib/assessments.functions";
import { APPROVAL_LABELS, gradeLabel, VERDICT_LABELS } from "@/lib/assessments-shared";
import { setSubmissionApproval } from "@/lib/assessment-roles.functions";
import { COLLABORATOR_ROLE_LABELS } from "@/lib/assessment-roles-shared";
import { Textarea } from "@/components/ui/textarea";
import { generateAssessmentPdf } from "@/lib/assessment-pdf";
import { SubmissionPageAnnotator } from "@/components/SubmissionPageAnnotator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle2, Download, Loader2, RefreshCw, Undo2, XCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/assessments/$id/submissions/$sid")({
  head: () => ({
    meta: [
      { title: "Informe de evaluación escrita | Playnalyze" },
      {
        name: "description",
        content:
          "Nota, corrección por pregunta, rúbrica, perfil competencial, análisis del grafismo y conclusiones de la entrega evaluada.",
      },
      { property: "og:title", content: "Informe de evaluación escrita | Playnalyze" },
      {
        property: "og:description",
        content: "Nota, rúbrica, competencias y análisis del grafismo de la entrega.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SubmissionReport,
});

function Bar({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {value} / {max}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted" role="presentation">
        <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SubmissionReport() {
  const { id, sid } = Route.useParams();
  const qc = useQueryClient();
  const get = useServerFn(getSubmission);
  const grade = useServerFn(gradeSubmission);
  const approve = useServerFn(setSubmissionApproval);
  const [approvalNote, setApprovalNote] = useState("");

  const q = useQuery({ queryKey: ["assessment-submission", sid], queryFn: () => get({ data: { id: sid } }) });
  const submission = q.data?.submission;
  const assessment = q.data?.assessment;
  const pageUrls = q.data?.pageUrls ?? [];
  const annotations = q.data?.annotations ?? [];
  const permissions = q.data?.permissions;
  const evaluation = submission?.evaluation ?? null;

  const regrade = useMutation({
    mutationFn: () => grade({ data: { id: sid } }),
    onSuccess: () => {
      toast.success("Corrección actualizada");
      void qc.invalidateQueries({ queryKey: ["assessment-submission", sid] });
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo corregir"),
  });

  const approval = useMutation({
    mutationFn: (decision: "pending" | "approved" | "rejected") =>
      approve({ data: { id: sid, decision, note: approvalNote } }),
    onSuccess: () => {
      toast.success("Estado de aprobación actualizado");
      void qc.invalidateQueries({ queryKey: ["assessment-submission", sid] });
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo actualizar la aprobación"),
  });

  const download = () => {
    if (!assessment || !submission || !evaluation) return;
    const doc = generateAssessmentPdf({ assessment, submission, evaluation, annotations });
    doc.save(`informe-${submission.candidateName.replace(/\s+/g, "-").toLowerCase()}.pdf`);
  };

  if (q.isLoading) return <div className="text-muted-foreground">Cargando…</div>;
  if (!submission || !assessment) return <div className="text-muted-foreground">Entrega no encontrada.</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to="/app/assessments/$id"
            params={{ id }}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> {assessment.title}
          </Link>
          <h1 className="text-2xl font-bold tracking-tight truncate">{submission.candidateName}</h1>
          <p className="text-sm text-muted-foreground">
            {submission.candidateIdentifier ? `${submission.candidateIdentifier} · ` : ""}
            {submission.sourceKind === "handwritten" ? "Escrito a mano" : "Documento digital"} ·{" "}
            {submission.gradedAt ? new Date(submission.gradedAt).toLocaleString() : "sin corregir"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {permissions?.canGrade && (
          <Button variant="secondary" onClick={() => regrade.mutate()} disabled={regrade.isPending}>
            {regrade.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Volver a corregir
          </Button>
          )}
          <Button onClick={download} disabled={!evaluation}>
            <Download className="h-4 w-4 mr-2" /> Descargar informe PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aprobación de la calificación</CardTitle>
          <CardDescription>
            {permissions?.canApprove
              ? "Valida o devuelve la calificación de esta entrega. Queda registrado quién aprueba y cuándo."
              : `Tu rol en esta evaluación: ${
                  permissions?.role === "propietario"
                    ? "propietario (control total)"
                    : permissions?.role
                      ? COLLABORATOR_ROLE_LABELS[permissions.role]
                      : "sin permisos"
                }.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={
                submission.approvalStatus === "approved"
                  ? "default"
                  : submission.approvalStatus === "rejected"
                    ? "destructive"
                    : "secondary"
              }
            >
              {APPROVAL_LABELS[submission.approvalStatus]}
            </Badge>
            {submission.approvedAt && (
              <span className="text-xs text-muted-foreground">
                {new Date(submission.approvedAt).toLocaleString()}
              </span>
            )}
          </div>
          {submission.approvalNote && (
            <p className="text-sm text-muted-foreground">{submission.approvalNote}</p>
          )}

          {permissions?.canApprove && (
            <div className="space-y-2">
              <Textarea
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                placeholder="Nota de aprobación o motivo de la devolución (opcional)"
                rows={2}
                aria-label="Nota de aprobación"
              />
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => approval.mutate("approved")} disabled={approval.isPending}>
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Aprobar calificación
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => approval.mutate("rejected")}
                  disabled={approval.isPending}
                >
                  <XCircle className="mr-2 h-4 w-4" /> Devolver para revisión
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => approval.mutate("pending")}
                  disabled={approval.isPending}
                >
                  <Undo2 className="mr-2 h-4 w-4" /> Dejar pendiente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>



      {!evaluation ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {submission.errorMessage ?? "Esta entrega todavía no tiene corrección."}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="grid gap-4 p-6 md:grid-cols-3">
              <div>
                <div className="text-4xl font-bold text-primary">
                  {evaluation.score.toFixed(2)}
                  <span className="text-lg text-muted-foreground"> / {evaluation.maxScore}</span>
                </div>
                <Badge className="mt-2">{gradeLabel(evaluation.score, evaluation.maxScore)}</Badge>
              </div>
              <div className="space-y-3 md:col-span-2">
                <Bar label="Contenido" value={Number(evaluation.contentScore.toFixed(2))} max={evaluation.maxScore} />
                <Bar label="Grafismo" value={Math.round(evaluation.handwritingScore)} />
                <p className="text-xs text-muted-foreground">
                  Reparto: contenido {100 - assessment.handwritingWeightPct}% · grafismo{" "}
                  {assessment.handwritingWeightPct}%
                </p>
              </div>
            </CardContent>
          </Card>

          {(evaluation.headline || evaluation.summary) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{evaluation.headline || "Resumen"}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-relaxed">{evaluation.summary}</CardContent>
            </Card>
          )}

          {evaluation.answers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Corrección y feedback por pregunta</CardTitle>
                <CardDescription>
                  Cada pregunta incluye veredicto, respuesta esperada, explicación de por qué es
                  correcta o incorrecta y feedback individual.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {evaluation.answers.map((answer, i) => (
                  <div key={answer.questionId || i} className="rounded-md border border-border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium">{answer.question || `Pregunta ${i + 1}`}</p>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge
                          variant={
                            answer.verdict === "correct"
                              ? "default"
                              : answer.verdict === "incorrect" || answer.verdict === "unanswered"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {VERDICT_LABELS[answer.verdict]}
                        </Badge>
                        <Badge variant="outline">
                          {answer.score} / {answer.maxPoints}
                        </Badge>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{answer.answerSummary}</p>
                    {answer.evidence && (
                      <blockquote className="mt-2 border-l-2 border-primary/40 pl-3 text-xs italic text-muted-foreground">
                        {answer.evidence}
                      </blockquote>
                    )}
                    {answer.expectedAnswer && (
                      <p className="mt-2 text-xs">
                        <span className="font-semibold">Respuesta esperada: </span>
                        <span className="text-muted-foreground">{answer.expectedAnswer}</span>
                      </p>
                    )}
                    {answer.explanation && (
                      <div className="mt-2 rounded-md bg-muted/60 p-2.5 text-xs leading-relaxed">
                        <p className="font-semibold">¿Por qué?</p>
                        <p className="text-muted-foreground">{answer.explanation}</p>
                      </div>
                    )}
                    {answer.feedback && (
                      <div className="mt-2 rounded-md border border-primary/30 bg-primary/5 p-2.5 text-xs leading-relaxed">
                        <p className="font-semibold">Feedback para el candidato</p>
                        <p className="text-muted-foreground">{answer.feedback}</p>
                        {answer.nextStep && (
                          <p className="mt-1 text-muted-foreground">
                            <span className="font-semibold">Siguiente paso: </span>
                            {answer.nextStep}
                          </p>
                        )}
                      </div>
                    )}
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {answer.strengths.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold">Fortalezas</p>
                          <ul className="list-disc pl-4 text-xs text-muted-foreground">
                            {answer.strengths.map((s, j) => (
                              <li key={j}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {answer.gaps.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold">A mejorar</p>
                          <ul className="list-disc pl-4 text-xs text-muted-foreground">
                            {answer.gaps.map((s, j) => (
                              <li key={j}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {evaluation.criteria.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Rúbrica</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {evaluation.criteria.map((criterion, i) => (
                  <div key={i} className="space-y-1">
                    <Bar label={criterion.name} value={criterion.score} max={criterion.maxScore} />
                    <p className="text-xs text-muted-foreground">{criterion.justification}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {evaluation.competencies.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Perfil competencial</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 md:grid-cols-2">
                {evaluation.competencies.map((competency, i) => (
                  <div key={i} className="rounded-md border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{competency.name}</span>
                      <Badge variant="outline">{competency.level}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{competency.evidence}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Análisis del grafismo</CardTitle>
              <CardDescription>
                Hechos observables sobre cómo está escrito. Las hipótesis son de trabajo, no concluyentes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Bar label="Legibilidad" value={evaluation.handwriting.legibility} />
                <Bar label="Estructura" value={evaluation.handwriting.structure} />
                <Bar label="Limpieza" value={evaluation.handwriting.cleanliness} />
                <Bar label="Espaciado" value={evaluation.handwriting.spacing} />
                <Bar label="Consistencia" value={evaluation.handwriting.consistency} />
              </div>
              {evaluation.handwriting.corrections && (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Correcciones y tachones: </span>
                  {evaluation.handwriting.corrections}
                </p>
              )}
              {evaluation.handwriting.observations.length > 0 && (
                <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                  {evaluation.handwriting.observations.map((observation, i) => (
                    <li key={i}>{observation}</li>
                  ))}
                </ul>
              )}
              {evaluation.handwriting.hypotheses.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Hipótesis de trabajo</p>
                  {evaluation.handwriting.hypotheses.map((hypothesis, i) => (
                    <div key={i} className="rounded-md border border-dashed border-border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm">{hypothesis.hypothesis}</p>
                        <Badge variant="outline" className="shrink-0">
                          {hypothesis.confidence}
                        </Badge>
                      </div>
                      {hypothesis.basis && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Base observable: {hypothesis.basis}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {(evaluation.recommendations.length > 0 || evaluation.conclusion) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recomendaciones y conclusión</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {evaluation.recommendations.length > 0 && (
                  <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                    {evaluation.recommendations.map((recommendation, i) => (
                      <li key={i}>{recommendation}</li>
                    ))}
                  </ul>
                )}
                {evaluation.conclusion && <p>{evaluation.conclusion}</p>}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {pageUrls.length > 0 && (
        <SubmissionPageAnnotator
          submissionId={sid}
          pages={pageUrls}
          annotations={annotations}
          readOnly={!permissions?.canAnnotate}
        />
      )}

      <TranscriptionConfidenceCard
        submission={submission}
        hasPages={pageUrls.length > 0}
        canReocr={Boolean(permissions?.canGrade)}
      />
    </div>
  );
}
