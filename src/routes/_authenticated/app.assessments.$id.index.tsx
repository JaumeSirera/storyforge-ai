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
import { CandidateBreakdownPanel } from "@/components/CandidateBreakdownPanel";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SectionCard } from "@/components/SectionCard";
import {
  ArrowLeft,
  ClipboardList,
  FileText,
  GraduationCap,
  ListChecks,
  Loader2,
  RefreshCw,
  Gauge,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserCog,
  Users,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/assessments/$id/")({
  head: () => ({
    meta: [
      { title: "Prueba escrita y entregas | Xandralyze" },
      {
        name: "description",
        content:
          "Revisa enunciados y rúbrica, sube entregas escaneadas o digitales y corrígelas con IA para obtener nota, análisis y conclusiones.",
      },
      { property: "og:title", content: "Prueba escrita y entregas | Xandralyze" },
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

type SectionKey =
  | "test"
  | "validation"
  | "candidates"
  | "attempts"
  | "audit"
  | "rubric"
  | "collaborators"
  | "upload"
  | "submissions"
  | "tracking";

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
  const [pages, setPages] = useState<File[]>([]);
  const [open, setOpen] = useState<SectionKey | null>(null);

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

  const sectionTitles: Record<SectionKey, string> = {
    test: "Prueba: enunciados y rúbrica",
    validation: "Validación con el texto base",
    candidates: "Aspirantes inscritos",
    attempts: "Estado de los intentos",
    audit: "Log de auditoría del examen",
    rubric: "Editor de rúbrica",
    collaborators: "Permisos y colaboradores",
    upload: "Nueva entrega",
    submissions: `Entregas (${submissions.length})`,
    tracking: "Seguimiento por candidato",
  };

  const isOwner = permissions?.isOwner !== false;
  const gradedCount = submissions.filter((s: any) => s.status === "graded").length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        to="/app/assessments"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Volver
      </Link>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">{assessment.title}</h1>
        <p className="mt-1 text-muted-foreground">
          {assessment.instructions?.trim() || "Prueba escrita con corrección por IA."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="secondary">Área {assessment.areaKey ?? "general"}</Badge>
          <Badge variant="outline">{assessment.maxScore} puntos</Badge>
          <Badge variant="outline">Grafismo {assessment.handwritingWeightPct}%</Badge>
          {assessment.timeLimitMin ? (
            <Badge variant="outline">{assessment.timeLimitMin} min</Badge>
          ) : null}
          <Badge variant={assessment.status === "ready" ? "default" : "secondary"}>
            {assessment.status === "ready" ? "Lista" : "Borrador"}
          </Badge>
        </div>
      </div>

      <Card className="shadow-glow">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
          <div>
            <h2 className="font-semibold">¿Listo para corregir?</h2>
            <p className="text-sm text-muted-foreground">
              {submissions.length === 0
                ? "Sube una entrega escaneada o digital y la IA la corregirá con la rúbrica."
                : `${submissions.length} entrega(s) · ${gradedCount} corregida(s).`}
            </p>
          </div>
          <Button size="lg" className="gap-2" onClick={() => setOpen("upload")}>
            <Upload className="h-4 w-4" aria-hidden="true" /> Nueva entrega
          </Button>
        </CardContent>
      </Card>

      {/* Hub de secciones */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SectionCard
          icon={FileText}
          title="Prueba"
          summary={
            assessment.questions.length > 0
              ? `${assessment.questions.length} pregunta(s) · ${assessment.rubric.length} criterio(s) de rúbrica`
              : "Todavía no hay preguntas: genera la prueba con IA"
          }
          onClick={() => setOpen("test")}
        />
        {assessment.questions.length > 0 && (
          <SectionCard
            icon={ShieldCheck}
            title="Validación con el texto base"
            summary="Comprueba qué preguntas están soportadas por el texto"
            onClick={() => setOpen("validation")}
          />
        )}
        <SectionCard
          icon={Users}
          title="Aspirantes"
          summary="Inscribe aspirantes, comparte el examen y consulta su nota"
          onClick={() => setOpen("candidates")}
        />
        {isOwner && (
          <SectionCard
            icon={ClipboardList}
            title="Estado de los intentos"
            summary="Inicio, entrega e historial de cada aspirante"
            onClick={() => setOpen("attempts")}
          />
        )}
        {isOwner && (
          <SectionCard
            icon={ScrollText}
            title="Log de auditoría"
            summary="Fecha, IP, navegador y versión del cliente"
            onClick={() => setOpen("audit")}
          />
        )}
        {isOwner && (
          <SectionCard
            icon={ListChecks}
            title="Rúbrica"
            summary="Edita criterios, pesos y niveles de la rúbrica"
            onClick={() => setOpen("rubric")}
          />
        )}
        {permissions?.canView && (
          <SectionCard
            icon={UserCog}
            title="Permisos y colaboradores"
            summary="Quién puede corregir, anotar o aprobar"
            onClick={() => setOpen("collaborators")}
          />
        )}
        <SectionCard
          icon={Upload}
          title="Nueva entrega"
          summary="Sube fotos o el PDF del examen para corregir con IA"
          onClick={() => setOpen("upload")}
        />
        <SectionCard
          icon={GraduationCap}
          title={`Entregas (${submissions.length})`}
          summary={
            submissions.length === 0
              ? "Sin entregas todavía"
              : `${gradedCount} corregida(s) · informes con nota y conclusiones`
          }
          onClick={() => setOpen("submissions")}
        />
        <SectionCard
          icon={Gauge}
          title="Seguimiento por candidato"
          summary="Nota y desglose por dimensiones, con aviso si no alcanza el umbral"
          onClick={() => setOpen("tracking")}
        />
      </div>

      <Dialog open={open !== null} onOpenChange={(v) => setOpen(v ? open : null)}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{open ? sectionTitles[open] : ""}</DialogTitle>
            <DialogDescription>
              {open === "test"
                ? "Enunciados y rúbrica generados por IA."
                : open === "submissions"
                  ? "Entregas recibidas y sus informes de corrección."
                  : "Gestión de esta sección de la evaluación."}
            </DialogDescription>
          </DialogHeader>

          {open === "test" && (
            <div className="space-y-4">
              {assessment.instructions && (
                <p className="rounded-md bg-muted/60 p-3 text-sm">{assessment.instructions}</p>
              )}

              {assessment.questions.length > 0 && (
                <ol className="space-y-3">
                  {assessment.questions.map((question, i) => (
                    <li key={question.id || i} className="rounded-md border border-border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium">
                          {i + 1}. {question.prompt}
                        </p>
                        <Badge variant="secondary" className="shrink-0">
                          {question.maxPoints} pts
                        </Badge>
                      </div>
                      {question.keyElements.length > 0 && (
                        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
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
                      <div
                        key={criterion.id || i}
                        className="rounded-md border border-border p-3 text-sm"
                      >
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
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Generar con IA
                  </Button>
                </div>
              </div>
            </div>
          )}

          {open === "validation" && (
            <SourceValidationCard
              assessmentId={id}
              hasSourceText={Boolean(
                assessment.sourceText && assessment.sourceText.trim().length >= 30,
              )}
              questionCount={assessment.questions.length}
            />
          )}

          {open === "candidates" && (
            <AssessmentCandidatesCard
              assessmentId={id}
              canManage={isOwner}
              submissions={submissions}
            />
          )}

          {open === "tracking" && (
            <CandidateBreakdownPanel assessmentId={id} submissions={submissions as any} />
          )}

          {open === "attempts" && <CandidateAttemptsCard assessmentId={id} />}

          {open === "audit" && <ExamAuditLogCard assessmentId={id} />}

          {open === "rubric" && <RubricEditor assessment={assessment} onSaved={invalidate} />}

          {open === "collaborators" && (
            <AssessmentCollaboratorsCard
              assessmentId={id}
              canManage={Boolean(permissions?.canManageCollaborators)}
            />
          )}

          {open === "upload" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Sube fotos o el PDF escaneado del examen manuscrito (o de un documento digitalizado).
                La IA transcribe, corrige con la rúbrica y analiza el grafismo.
              </p>
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
                <Input
                  id="s-files"
                  ref={fileRef}
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                />
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
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Subir y corregir con IA
              </Button>
            </div>
          )}

          {open === "submissions" &&
            (submissions.length === 0 ? (
              <p className="py-6 text-center text-muted-foreground">Sin entregas todavía.</p>
            ) : (
              <div className="space-y-2">
                {submissions.map((submission: any) => (
                  <div
                    key={submission.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                        <span className="truncate font-medium">{submission.candidateName}</span>
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
                  </div>
                ))}
              </div>
            ))}
        </DialogContent>
      </Dialog>
    </div>
  );
}
