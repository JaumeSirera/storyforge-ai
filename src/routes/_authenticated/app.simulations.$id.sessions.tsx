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
import { logReportEmail, listReportEmailLog } from "@/lib/report-email.functions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { loadLogoDataUrl, renderTemplate, openMailClient } from "@/lib/email-report";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Star, Save, Plus, Trash2, MessageSquare, CheckCircle2, Download, Mail, Search, FilterX } from "lucide-react";
import { downloadReportPdf } from "@/lib/report-pdf";
import { useEffect, useMemo, useState } from "react";
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
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "completed" | "in_progress">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minPoints, setMinPoints] = useState("");
  const [maxPoints, setMaxPoints] = useState("");

  const sessions = (q.data?.sessions ?? []) as any[];
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;
    const min = minPoints === "" ? null : Number(minPoints);
    const max = maxPoints === "" ? null : Number(maxPoints);
    return sessions.filter((s) => {
      const done = !!s.completed_at;
      if (status === "completed" && !done) return false;
      if (status === "in_progress" && done) return false;
      if (term) {
        const hay = [s.candidate_name ?? "", s.candidate_email ?? "", ...Object.values(s.candidate_fields_data ?? {})]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(term)) return false;
      }
      const t = new Date(s.started_at).getTime();
      if (from !== null && t < from) return false;
      if (to !== null && t > to) return false;
      const pts = s.score ?? 0;
      if (min !== null && !Number.isNaN(min) && pts < min) return false;
      if (max !== null && !Number.isNaN(max) && pts > max) return false;
      return true;
    });
  }, [sessions, search, status, dateFrom, dateTo, minPoints, maxPoints]);

  function resetFilters() {
    setSearch("");
    setStatus("all");
    setDateFrom("");
    setDateTo("");
    setMinPoints("");
    setMaxPoints("");
  }

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
            <CardDescription>
              {filtered.length} de {sessions.length} sesión(es)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por candidato o email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Buscar candidato"
              />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger aria-label="Filtrar por estado">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="completed">Completadas</SelectItem>
                <SelectItem value="in_progress">En curso</SelectItem>
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Desde</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Hasta</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Puntos mín.</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={minPoints}
                  onChange={(e) => setMinPoints(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <Label className="text-xs">Puntos máx.</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={maxPoints}
                  onChange={(e) => setMaxPoints(e.target.value)}
                  placeholder="100"
                />
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1">
              <FilterX className="h-4 w-4" /> Limpiar filtros
            </Button>
          </CardContent>
          <CardContent className="p-0">
            {q.isLoading ? (
              <p className="p-4 text-sm text-muted-foreground">Cargando…</p>
            ) : sessions.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Aún nadie ha jugado esta simulación.</p>
            ) : filtered.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Ninguna sesión coincide con los filtros.</p>
            ) : (
              <ul className="max-h-[32rem] overflow-y-auto divide-y divide-border">
                {filtered.map((s: any) => (
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
  const loadEmailSettings = useServerFn(getMyEmailSettings);
  const markSent = useServerFn(markReportEmailSent);
  const logSend = useServerFn(logReportEmail);
  const listLog = useServerFn(listReportEmailLog);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["sim-session", sessionId],
    queryFn: () => get({ data: { sessionId } }),
  });
  const settingsQ = useQuery({
    queryKey: ["my-email-settings"],
    queryFn: () => loadEmailSettings(),
  });
  const logQ = useQuery({
    queryKey: ["report-email-log", sessionId],
    queryFn: () => listLog({ data: { sessionId } }),
  });
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [sendingMail, setSendingMail] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [mailTo, setMailTo] = useState("");


  useEffect(() => {
    if (q.data) {
      setFeedback(((q.data as any).admin_feedback ?? "") as string);
      setMailTo((((q.data as any).candidate_email ?? "") as string) || "");
    }
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

  function pdfPayload(logoDataUrl: string | null) {
    return {
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
      branding: { logoDataUrl },
    };
  }

  async function downloadPdf() {
    const logo = await loadLogoDataUrl(settingsQ.data?.logoUrl || null);
    downloadReportPdf(pdfPayload(logo));
  }

  const cfg = settingsQ.data;
  const mailVars = { candidato: s.candidate_name, simulacion: s.simulation?.title };
  const previewSubject = renderTemplate(
    cfg?.subjectTemplate || "Tu informe de la simulación {{simulacion}}",
    mailVars,
  );
  const previewBody = `${renderTemplate(cfg?.bodyTemplate || "Hola {{candidato}},", mailVars)}${
    s.admin_feedback ? `\n\nFeedback del evaluador:\n${s.admin_feedback}` : ""
  }${cfg?.fromName ? `\n\n${cfg.fromName}` : ""}`;

  async function sendReportByEmail() {
    const to = (mailTo || (s.candidate_email as string | null) || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      toast.error("Indica un email de destino válido.");
      return;
    }
    setSendingMail(true);
    try {
      const logo = await loadLogoDataUrl(cfg?.logoUrl || null);
      // Descarga el PDF para adjuntarlo en el correo.
      downloadReportPdf(pdfPayload(logo));

      const opened = openMailClient({
        to,
        subject: previewSubject,
        body: previewBody,
        replyTo: cfg?.replyTo || null,
        fromEmail: cfg?.fromEmail || null,
      });

      await markSent({ data: { sessionId, to } });
      await logSend({
        data: {
          sessionId,
          recipient: to,
          subject: previewSubject,
          status: opened ? "sent" : "failed",
          ...(opened ? {} : { errorMessage: "No se pudo abrir el cliente de correo" }),
        },
      });
      setPreviewOpen(false);
      qc.invalidateQueries({ queryKey: ["sim-session", sessionId] });
      qc.invalidateQueries({ queryKey: ["report-email-log", sessionId] });
      onSaved();

      if (opened) {
        toast.success("Informe descargado y correo preparado. Adjunta el PDF y envíalo.");
      } else {
        toast.warning("Informe descargado, pero no se pudo abrir el cliente de correo.");
      }
    } catch (e: any) {
      try {
        await logSend({
          data: {
            sessionId,
            recipient: to,
            subject: previewSubject,
            status: "failed",
            errorMessage: String(e?.message ?? "Error desconocido").slice(0, 400),
          },
        });
        qc.invalidateQueries({ queryKey: ["report-email-log", sessionId] });
      } catch {
        /* ignora fallos de registro */
      }
      toast.error(e.message || "No se pudo preparar el envío");
    } finally {
      setSendingMail(false);
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
          <div className="space-y-1">
            <Label htmlFor="mailto" className="text-xs">
              Enviar a
            </Label>
            <Input
              id="mailto"
              type="email"
              value={mailTo}
              onChange={(e) => setMailTo(e.target.value)}
              placeholder="candidato@empresa.com"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="gap-2" onClick={() => void downloadPdf()}>
              <Download className="h-4 w-4" /> Descargar informe PDF
            </Button>
            <Button size="sm" className="gap-2" onClick={() => setPreviewOpen(true)}>
              <Mail className="h-4 w-4" /> Ver y enviar email
            </Button>
          </div>

          <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Vista previa del email</DialogTitle>
                <DialogDescription>
                  Revisa el asunto y el mensaje antes de enviarlo al candidato.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="rounded-md border border-border p-3 space-y-1">
                  <div>
                    <span className="text-muted-foreground">De:</span>{" "}
                    {cfg?.fromName || "(sin nombre)"} &lt;{cfg?.fromEmail || "sin remitente"}&gt;
                  </div>
                  {cfg?.replyTo && (
                    <div>
                      <span className="text-muted-foreground">Responder a:</span> {cfg.replyTo}
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Para:</span>{" "}
                    {mailTo || s.candidate_email || "—"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Asunto:</span> {previewSubject}
                  </div>
                </div>
                <div className="rounded-md border border-border p-3 whitespace-pre-wrap max-h-64 overflow-y-auto">
                  {previewBody}
                </div>
                <p className="text-xs text-muted-foreground">
                  Se adjunta el informe PDF (se descarga al confirmar) con tu logo y marca.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setPreviewOpen(false)}>
                  Cancelar
                </Button>
                <Button size="sm" disabled={sendingMail} onClick={() => void sendReportByEmail()}>
                  Confirmar y enviar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="space-y-1">
            <div className="text-xs font-medium">Historial de envíos</div>
            {logQ.isLoading ? (
              <p className="text-xs text-muted-foreground">Cargando historial…</p>
            ) : (logQ.data ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">Todavía no se ha enviado ningún informe.</p>
            ) : (
              <ul className="space-y-1">
                {(logQ.data as any[]).map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs"
                  >
                    <Badge
                      variant={
                        row.status === "sent"
                          ? "default"
                          : row.status === "failed"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {row.status === "sent"
                        ? "Enviado"
                        : row.status === "failed"
                          ? "Fallido"
                          : "Pendiente"}
                    </Badge>
                    <span className="font-medium">{row.recipient}</span>
                    <span className="text-muted-foreground">
                      {new Date(row.updated_at ?? row.created_at).toLocaleString()}
                    </span>
                    <span className="text-muted-foreground">
                      {row.attempts} intento{row.attempts === 1 ? "" : "s"}
                    </span>
                    {row.auto && <span className="text-muted-foreground">· automático</span>}
                    {row.error_message && (
                      <span className="text-destructive">· {row.error_message}</span>
                    )}
                    {row.status !== "sent" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2"
                        onClick={() => {
                          setMailTo(row.recipient);
                          setPreviewOpen(true);
                        }}
                      >
                        Reintentar
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>


          <p className="text-xs text-muted-foreground">
            Se usa la configuración de <strong>Ajustes → Correo de envío</strong> (remitente, logo,
            asunto y mensaje). El PDF se descarga para adjuntarlo al correo.
          </p>
          {s.report_email_sent_at && (
            <p className="text-xs text-primary">
              Enviado a {s.report_email_to} el {new Date(s.report_email_sent_at).toLocaleString()}
            </p>
          )}

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
