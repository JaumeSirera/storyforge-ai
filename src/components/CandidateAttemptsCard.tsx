import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAssessmentCandidates } from "@/lib/assessment-candidates.functions";
import { listExamAudit } from "@/lib/exam-audit.functions";
import {
  CANDIDATE_STATUS_LABELS,
  type AssessmentCandidate,
} from "@/lib/assessment-candidates-shared";
import {
  browserSummary,
  examAuditLabel,
  type ExamAuditEntry,
} from "@/lib/exam-audit-shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Download,
  Loader2,
  RefreshCw,
} from "lucide-react";

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
}

const STATUS_VARIANT: Record<string, "secondary" | "default" | "outline"> = {
  invited: "outline",
  started: "secondary",
  submitted: "default",
};

/** Vista de seguimiento: estado del intento, fecha de entrega e historial por aspirante. */
export function CandidateAttemptsCard({ assessmentId }: { assessmentId: string }) {
  const listCandidates = useServerFn(listAssessmentCandidates);
  const fetchAudit = useServerFn(listExamAudit);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const candidatesQ = useQuery({
    queryKey: ["assessment-candidates", assessmentId],
    queryFn: () => listCandidates({ data: { assessmentId } }),
  });
  const auditQ = useQuery({
    queryKey: ["exam-audit", assessmentId],
    queryFn: () =>
      fetchAudit({ data: { assessmentId } }) as Promise<{ entries: ExamAuditEntry[] }>,
  });

  const candidates: AssessmentCandidate[] = candidatesQ.data?.candidates ?? [];
  const entries = auditQ.data?.entries ?? [];

  const byCandidate = useMemo(() => {
    const map = new Map<string, ExamAuditEntry[]>();
    for (const e of entries) {
      const arr = map.get(e.candidateId) ?? [];
      arr.push(e);
      map.set(e.candidateId, arr);
    }
    return map;
  }, [entries]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = term
      ? candidates.filter((c) =>
          [c.name, c.email ?? "", c.identifier ?? ""].join(" ").toLowerCase().includes(term),
        )
      : candidates;
    return list.map((c) => {
      const history = byCandidate.get(c.id) ?? [];
      const deliveries = history.filter(
        (h) => h.event === "exam_submitted" || h.event === "exam_auto_submitted",
      );
      return { candidate: c, history, deliveries };
    });
  }, [candidates, byCandidate, search]);

  const loading = candidatesQ.isLoading || auditQ.isLoading;
  const fetching = candidatesQ.isFetching || auditQ.isFetching;

  const exportCsv = () => {
    const csvRows = [
      ["Aspirante", "Email", "Estado", "Inicio", "Entrega", "Entregas", "Eventos", "Tiempo agotado"],
      ...rows.map((r) => [
        r.candidate.name,
        r.candidate.email ?? "",
        CANDIDATE_STATUS_LABELS[r.candidate.status] ?? r.candidate.status,
        fmt(r.candidate.startedAt),
        fmt(r.candidate.submittedAt),
        String(r.deliveries.length),
        String(r.history.length),
        r.candidate.timeExpired ? "Sí" : "No",
      ]),
    ];
    const csv = csvRows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `intentos-aspirantes-${assessmentId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4 text-primary" aria-hidden />
            Estado de los intentos por aspirante
          </CardTitle>
          <CardDescription>
            Estado del examen, fecha de inicio y de entrega, y el historial completo de entregas e
            intentos de cada aspirante.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              candidatesQ.refetch();
              auditQ.refetch();
            }}
            disabled={fetching}
          >
            {fetching ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden />
            )}
            Actualizar
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="mr-1.5 h-4 w-4" aria-hidden />
            CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar aspirante por nombre, email o identificador…"
          aria-label="Buscar aspirante"
        />

        {(candidatesQ.isError || auditQ.isError) && (
          <p className="text-sm text-destructive">
            {((candidatesQ.error ?? auditQ.error) as Error)?.message ||
              "No se pudo cargar el seguimiento de intentos."}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando intentos…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay aspirantes inscritos en esta evaluación.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Aspirante</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Inicio</TableHead>
                  <TableHead>Entrega</TableHead>
                  <TableHead className="text-right">Entregas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ candidate: c, history, deliveries }) => {
                  const isOpen = !!open[c.id];
                  return (
                    <>
                      <TableRow key={c.id}>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setOpen((s) => ({ ...s, [c.id]: !s[c.id] }))}
                            aria-expanded={isOpen}
                            aria-label={
                              isOpen
                                ? `Ocultar historial de ${c.name}`
                                : `Ver historial de ${c.name}`
                            }
                          >
                            {isOpen ? (
                              <ChevronDown className="h-4 w-4" aria-hidden />
                            ) : (
                              <ChevronRight className="h-4 w-4" aria-hidden />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="text-sm">
                          <span className="font-medium">{c.name}</span>
                          {c.email && (
                            <span className="block text-xs text-muted-foreground">{c.email}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1">
                            <Badge variant={STATUS_VARIANT[c.status] ?? "secondary"}>
                              {CANDIDATE_STATUS_LABELS[c.status] ?? c.status}
                            </Badge>
                            {c.timeExpired && (
                              <Badge variant="destructive">Tiempo agotado</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {fmt(c.startedAt)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {fmt(c.submittedAt)}
                        </TableCell>
                        <TableCell className="text-right text-sm">{deliveries.length}</TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow key={`${c.id}-history`}>
                          <TableCell colSpan={6} className="bg-muted/40">
                            {history.length === 0 ? (
                              <p className="py-2 text-sm text-muted-foreground">
                                Sin actividad registrada para este aspirante.
                              </p>
                            ) : (
                              <ol className="space-y-2 py-2">
                                {history.map((h) => (
                                  <li
                                    key={h.id}
                                    className="flex flex-wrap items-center gap-2 text-sm"
                                  >
                                    <Badge variant="secondary">{examAuditLabel(h.event)}</Badge>
                                    <span className="whitespace-nowrap">{fmt(h.createdAt)}</span>
                                    <span className="text-muted-foreground">
                                      {browserSummary(h.userAgent)}
                                    </span>
                                    <span className="font-mono text-xs text-muted-foreground">
                                      {h.ip ?? "—"}
                                    </span>
                                  </li>
                                ))}
                              </ol>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
