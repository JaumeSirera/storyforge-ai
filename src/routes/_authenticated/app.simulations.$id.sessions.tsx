import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listSimulationSessions,
  getSimulationSessionDetail,
  submitAdminFeedback,
  updateCandidateFields,
  markReportEmailSent,
} from "@/lib/candidate.functions";
import { getMyEmailSettings } from "@/lib/email-settings.functions";
import { loadLogoDataUrl, renderTemplate, openMailClient } from "@/lib/email-report";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Star, Save, Plus, Trash2, MessageSquare, CheckCircle2, Download, Mail } from "lucide-react";
import { downloadReportPdf } from "@/lib/report-pdf";
import { useEffect, useState } from "react";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/app/simulations/$id/sessions")({
  component: SimulationSessionsPage,
});

function SimulationSessionsPage() {
  const { id } = Route.useParams();
  const list = useServerFn(listSimulationSessions);
  const q = useQuery({
    queryKey: ["sim-sessions", id],
    queryFn: () => list({ data: { simulationId: id } }),
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Link
        to="/app/simulations/$id"
        params={{ id }}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> Volver a la simulación
      </Link>

      <div>
        <h1 className="text-2xl font-bold">Sesiones y feedback</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {q.data?.simulation.title ?? "…"} — historial de candidatos que han jugado esta simulación.
        </p>
      </div>

      <CandidateFieldsEditor
        simulationId={id}
        initialFields={((q.data?.simulation as any)?.candidate_fields ?? []) as any}
        onSaved={() => q.refetch()}
      />

      <div className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Candidatos</CardTitle>
            <CardDescription>{q.data?.sessions?.length ?? 0} sesión(es)</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {q.isLoading ? (
              <p className="p-4 text-sm text-muted-foreground">Cargando…</p>
            ) : (q.data?.sessions?.length ?? 0) === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Aún nadie ha jugado esta simulación.</p>
            ) : (
              <ul className="divide-y divide-border">
                {q.data!.sessions.map((s: any) => (
                  <li key={s.id}>
                    <button
                      onClick={() => setSelectedId(s.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-accent transition ${
                        selectedId === s.id ? "bg-accent" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{s.candidate_name || "(sin nombre)"}</div>
                        <div className="flex items-center gap-1 text-xs">
                          {s.completed_at ? (
                            <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Completada</Badge>
                          ) : (
                            <Badge variant="secondary">En curso</Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {s.candidate_email || "—"} · {new Date(s.started_at).toLocaleString()}
                      </div>
                      <div className="flex items-center gap-2 text-xs mt-1">
                        <span className="inline-flex items-center gap-0.5">
                          <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" /> {s.stars}
                        </span>
                        <span className="text-muted-foreground">· {s.score} pts</span>
                        {s.admin_feedback && (
                          <span className="inline-flex items-center gap-1 text-primary">
                            <MessageSquare className="h-3 w-3" /> feedback enviado
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div>
          {selectedId ? (
            <SessionDetailPanel sessionId={selectedId} onSaved={() => q.refetch()} />
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center text-muted-foreground">
                Selecciona un candidato para ver su detalle y dejar feedback.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function CandidateFieldsEditor({
  simulationId,
  initialFields,
  onSaved,
}: {
  simulationId: string;
  initialFields: { key: string; label: string; required?: boolean }[];
  onSaved: () => void;
}) {
  const update = useServerFn(updateCandidateFields);
  const [fields, setFields] = useState(initialFields ?? []);
  const [saving, setSaving] = useState(false);

  useEffect(() => setFields(initialFields ?? []), [initialFields]);

  async function save() {
    setSaving(true);
    try {
      await update({ data: { simulationId, fields } });
      toast.success("Campos guardados");
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campos que se piden al candidato</CardTitle>
        <CardDescription>
          Nombre y email siempre son obligatorios. Añade aquí campos extra (DNI, puesto, empresa…) que quieras registrar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {fields.map((f, i) => (
          <div key={i} className="grid grid-cols-[1fr_1.5fr_auto_auto] gap-2 items-end">
            <div>
              <Label className="text-xs">Clave</Label>
              <Input
                value={f.key}
                onChange={(e) =>
                  setFields((arr) => arr.map((x, ix) => (ix === i ? { ...x, key: e.target.value } : x)))
                }
                placeholder="p.ej. dni"
              />
            </div>
            <div>
              <Label className="text-xs">Etiqueta</Label>
              <Input
                value={f.label}
                onChange={(e) =>
                  setFields((arr) => arr.map((x, ix) => (ix === i ? { ...x, label: e.target.value } : x)))
                }
                placeholder="p.ej. DNI"
              />
            </div>
            <label className="text-xs flex items-center gap-1 pb-2">
              <input
                type="checkbox"
                checked={!!f.required}
                onChange={(e) =>
                  setFields((arr) => arr.map((x, ix) => (ix === i ? { ...x, required: e.target.checked } : x)))
                }
              />
              obligatorio
            </label>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setFields((arr) => arr.filter((_, ix) => ix !== i))}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFields((arr) => [...arr, { key: "", label: "", required: false }])}
            disabled={fields.length >= 10}
          >
            <Plus className="h-4 w-4 mr-1" /> Añadir campo
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            <Save className="h-4 w-4 mr-1" /> Guardar campos
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SessionDetailPanel({ sessionId, onSaved }: { sessionId: string; onSaved: () => void }) {
  const get = useServerFn(getSimulationSessionDetail);
  const send = useServerFn(submitAdminFeedback);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["sim-session", sessionId],
    queryFn: () => get({ data: { sessionId } }),
  });
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (q.data) setFeedback(((q.data as any).admin_feedback ?? "") as string);
  }, [q.data]);

  if (q.isLoading || !q.data) {
    return (
      <Card>
        <CardContent className="py-10 text-sm text-muted-foreground">Cargando…</CardContent>
      </Card>
    );
  }

  const s = q.data as any;
  const report = s.report as any | null;
  const extraFields = (s.candidate_fields_data ?? {}) as Record<string, string>;

  async function save() {
    setSaving(true);
    try {
      await send({ data: { sessionId, feedback } });
      toast.success("Feedback guardado. El candidato lo verá en su sesión.");
      qc.invalidateQueries({ queryKey: ["sim-session", sessionId] });
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{s.candidate_name || "(sin nombre)"}</CardTitle>
        <CardDescription>{s.candidate_email || "—"}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-md border border-border p-2 text-center">
            <div className="text-xs text-muted-foreground">Estrellas</div>
            <div className="font-semibold">{s.stars}</div>
          </div>
          <div className="rounded-md border border-border p-2 text-center">
            <div className="text-xs text-muted-foreground">Puntos</div>
            <div className="font-semibold">{s.score}</div>
          </div>
          <div className="rounded-md border border-border p-2 text-center">
            <div className="text-xs text-muted-foreground">Estado</div>
            <div className="font-semibold">{s.completed_at ? "Completada" : "En curso"}</div>
          </div>
        </div>

        {Object.keys(extraFields).length > 0 && (
          <div className="rounded-md border border-border p-3 text-sm">
            <div className="text-xs text-muted-foreground mb-1">Datos del candidato</div>
            {Object.entries(extraFields).map(([k, v]) => (
              <div key={k}>
                <span className="text-muted-foreground">{k}:</span> {v}
              </div>
            ))}
          </div>
        )}

        <div className="rounded-md border border-border p-3 text-sm space-y-2">
          {report ? (
            <>
              <div className="font-medium">Informe IA · {report.outcome}</div>
              <p className="text-muted-foreground">{report.summary}</p>
            </>
          ) : (
            <p className="text-muted-foreground">
              Esta sesión aún no tiene informe IA (sin completar). Puedes descargar un informe
              provisional con las respuestas registradas hasta ahora.
            </p>
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() =>
              downloadReportPdf({
                simulation: {
                  title: s.simulation?.title ?? "Simulación",
                  objective: s.simulation?.objective ?? null,
                },
                candidate: { name: s.candidate_name, email: s.candidate_email },
                session: {
                  id: s.id,
                  startedAt: s.started_at,
                  completedAt: s.completed_at,
                  adminFeedback: s.admin_feedback,
                },
                report:
                  report ?? {
                    finalScore: s.score ?? 0,
                    stars: s.stars ?? 0,
                    outcome: "en_curso",
                    summary: "Sesión en curso: informe provisional con las respuestas registradas.",
                  },
                answers: (s.answers ?? []) as any[],
                criteriaLabels: Object.fromEntries(
                  ((s.simulation?.evaluation_criteria ?? []) as any[]).map((c) => [c.key, c.label]),
                ),
              })
            }
          >
            <Download className="h-4 w-4" /> Descargar informe PDF
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fb">Feedback para el candidato</Label>
          <Textarea
            id="fb"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={6}
            maxLength={5000}
            placeholder="Comparte impresiones, próximos pasos, áreas de mejora…"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {s.admin_feedback_at
                ? `Última actualización: ${new Date(s.admin_feedback_at).toLocaleString()}`
                : "Aún no has enviado feedback."}
            </span>
            <Button size="sm" onClick={save} disabled={saving}>
              <Save className="h-4 w-4 mr-1" /> Guardar feedback
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
