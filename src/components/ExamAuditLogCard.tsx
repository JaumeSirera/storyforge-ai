import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listExamAudit } from "@/lib/exam-audit.functions";
import {
  browserSummary,
  examAuditLabel,
  type ExamAuditEntry,
} from "@/lib/exam-audit-shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, Download, Loader2, RefreshCw, ShieldCheck } from "lucide-react";

const DANGER_EVENTS = new Set(["exam_resubmit_attempt", "exam_submit_rejected_time"]);

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "medium" });
}

export function ExamAuditLogCard({ assessmentId }: { assessmentId: string }) {
  const fetchAudit = useServerFn(listExamAudit);
  const [filter, setFilter] = useState("");

  const q = useQuery({
    queryKey: ["exam-audit", assessmentId],
    queryFn: () =>
      fetchAudit({ data: { assessmentId } }) as Promise<{ entries: ExamAuditEntry[] }>,
  });

  const entries = useMemo(() => {
    const all = q.data?.entries ?? [];
    const needle = filter.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((e) =>
      [e.candidateName, examAuditLabel(e.event), e.ip ?? "", browserSummary(e.userAgent)]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [q.data, filter]);

  const exportCsv = () => {
    const rows = [
      ["Fecha", "Aspirante", "Evento", "IP", "Navegador", "User agent", "Versión cliente"],
      ...entries.map((e) => [
        formatDate(e.createdAt),
        e.candidateName,
        examAuditLabel(e.event),
        e.ip ?? "",
        browserSummary(e.userAgent),
        e.userAgent ?? "",
        e.clientVersion ?? "",
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria-examen-${assessmentId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
            Log de auditoría del examen
          </CardTitle>
          <CardDescription>
            Registro del servidor con fecha y hora, IP, navegador y versión del cliente de cada
            inicio, entrega e intento de reenvío.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => q.refetch()} disabled={q.isFetching}>
            {q.isFetching ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden />
            )}
            Actualizar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            disabled={entries.length === 0}
          >
            <Download className="mr-1.5 h-4 w-4" aria-hidden />
            CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrar por aspirante, evento, IP o navegador…"
          aria-label="Filtrar registros de auditoría"
        />

        {q.isError && (
          <p className="text-sm text-destructive">
            {(q.error as Error).message || "No se pudo cargar el log de auditoría."}
          </p>
        )}

        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando registros…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay actividad registrada para esta evaluación.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha y hora</TableHead>
                  <TableHead>Aspirante</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Navegador</TableHead>
                  <TableHead>Cliente</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDate(e.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm">{e.candidateName}</TableCell>
                    <TableCell>
                      <Badge variant={DANGER_EVENTS.has(e.event) ? "destructive" : "secondary"}>
                        {DANGER_EVENTS.has(e.event) && (
                          <AlertTriangle className="mr-1 h-3 w-3" aria-hidden />
                        )}
                        {examAuditLabel(e.event)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{e.ip ?? "—"}</TableCell>
                    <TableCell className="text-sm" title={e.userAgent ?? undefined}>
                      {browserSummary(e.userAgent)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{e.clientVersion ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
