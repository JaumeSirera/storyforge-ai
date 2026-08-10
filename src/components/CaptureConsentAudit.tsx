import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listConsentAudit } from "@/lib/capture.functions";
import { CONSENT_SCOPE_LABELS, CONSENT_SOURCE_LABELS, CONSENT_VERSION } from "@/lib/consent-version";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollText, RefreshCw, Check, X, Download } from "lucide-react";
import { toast } from "sonner";

type AuditRow = Awaited<ReturnType<typeof listConsentAudit>>[number];

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "medium" });
}

/** Auditoría de consentimientos: quién aceptó qué, cuándo y con qué versión. */
export function CaptureConsentAudit({ captureSessionId }: { captureSessionId: string }) {
  const load = useServerFn(listConsentAudit);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [busy, setBusy] = useState(true);

  const refresh = async () => {
    setBusy(true);
    try {
      setRows(await load({ data: { captureSessionId } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cargar la auditoría");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captureSessionId]);

  const grouped = useMemo(() => {
    const map = new Map<string, AuditRow[]>();
    for (const r of rows) {
      const key = r.participantName ?? (r.isSelf ? "Anfitrión" : "Sin participante asignado");
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return [...map.entries()];
  }, [rows]);

  const exportCsv = () => {
    const head = [
      "participante",
      "rol",
      "alcance",
      "aceptado",
      "aceptado_en",
      "registrado_en",
      "version",
      "origen",
      "dispositivo",
    ];
    const body = rows.map((r) =>
      [
        r.participantName ?? "",
        r.participantRole ?? "",
        CONSENT_SCOPE_LABELS[r.scope] ?? r.scope,
        r.granted ? "sí" : "no",
        r.grantedAt ?? "",
        r.recordedAt,
        r.consentVersion,
        CONSENT_SOURCE_LABELS[r.source] ?? r.source,
        (r.userAgent ?? "").replace(/[;,\n]/g, " "),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[head.join(","), ...body].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `consentimientos-${captureSessionId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <ScrollText className="h-4 w-4" /> Auditoría de consentimientos
          </CardTitle>
          <CardDescription>
            Registro verificable de quién aceptó, cuándo y con qué versión del texto. Versión vigente:{" "}
            <span className="font-mono">{CONSENT_VERSION}</span>
          </CardDescription>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={busy}>
            <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}>
            <Download className="mr-1 h-4 w-4" /> CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!busy && !rows.length && (
          <p className="text-sm text-muted-foreground">
            Todavía no hay consentimientos registrados en esta sesión.
          </p>
        )}
        {grouped.map(([name, list]) => (
          <div key={name} className="rounded-lg border">
            <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-3 py-2">
              <span className="text-sm font-medium">{name}</span>
              {list[0]?.participantRole && (
                <Badge variant="secondary">{list[0].participantRole}</Badge>
              )}
              <Badge variant="outline" className="ml-auto font-mono text-xs">
                {list[0]?.consentVersion}
              </Badge>
            </div>
            <ul className="divide-y">
              {list.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                  <span className="flex items-center gap-1.5">
                    {r.granted ? (
                      <Check className="h-4 w-4 text-emerald-600" aria-hidden />
                    ) : (
                      <X className="h-4 w-4 text-destructive" aria-hidden />
                    )}
                    {CONSENT_SCOPE_LABELS[r.scope] ?? r.scope}
                  </span>
                  <span className="text-muted-foreground">
                    {r.granted ? `Aceptado ${fmt(r.grantedAt)}` : `Rechazado ${fmt(r.recordedAt)}`}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Registrado {fmt(r.recordedAt)} · {CONSENT_SOURCE_LABELS[r.source] ?? r.source}
                  </span>
                  {r.userAgent && (
                    <span className="max-w-full truncate text-xs text-muted-foreground" title={r.userAgent}>
                      {r.userAgent}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
