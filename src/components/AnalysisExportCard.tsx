import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileJson, Table2 } from "lucide-react";
import { toast } from "sonner";
import {
  buildMinuteTimeline,
  exportAnalysisCsv,
  exportAnalysisJson,
  type CsvKind,
  type ExportSource,
} from "@/lib/analysis-export";

const CSV_OPTIONS: { kind: CsvKind; label: string; hint: string }[] = [
  { kind: "minutes", label: "Trazabilidad por minuto", hint: "Un registro por minuto de sesión" },
  { kind: "segments", label: "Transcripción por turno", hint: "Cada intervención con su minuto" },
  { kind: "speakers", label: "Métricas por hablante", hint: "Turnos, tiempos e interrupciones" },
  { kind: "interactions", label: "Red de interacción", hint: "Quién responde a quién" },
];

/** Exportación del análisis a JSON/CSV para integrarlo con otros sistemas. */
export function AnalysisExportCard({ source }: { source: ExportSource }) {
  const minutes = useMemo(() => buildMinuteTimeline(source).length, [source]);
  const disabled = source.segments.length === 0;

  function run(fn: () => void, msg: string) {
    try {
      fn();
      toast.success(msg);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo generar la exportación");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <Download className="h-4 w-4" /> Exportar análisis
          {minutes > 0 && <Badge variant="secondary">{minutes} min trazados</Badge>}
        </CardTitle>
        <CardDescription>
          Descarga los datos objetivos de la sesión para integrarlos con otros sistemas (ATS, LMS,
          BI) o auditar la trazabilidad minuto a minuto.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Button
            size="sm"
            className="gap-2"
            disabled={disabled}
            onClick={() => run(() => exportAnalysisJson(source), "JSON exportado")}
          >
            <FileJson className="h-4 w-4" /> Exportar JSON completo
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Incluye métricas, red de interacción, transcripción, anotaciones de escena y la línea de
            tiempo por minuto (esquema <code>playnalyze.analysis.v1</code>).
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Tablas CSV</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {CSV_OPTIONS.map((opt) => (
              <Button
                key={opt.kind}
                size="sm"
                variant="outline"
                className="h-auto justify-start gap-2 py-2 text-left"
                disabled={disabled}
                onClick={() =>
                  run(() => exportAnalysisCsv(source, opt.kind), `${opt.label} exportada`)
                }
              >
                <Table2 className="h-4 w-4 shrink-0" />
                <span className="flex flex-col">
                  <span className="text-sm">{opt.label}</span>
                  <span className="text-xs font-normal text-muted-foreground">{opt.hint}</span>
                </span>
              </Button>
            ))}
          </div>
        </div>

        {disabled && (
          <p className="text-xs text-muted-foreground">
            Transcribe al menos una grabación para poder exportar el análisis.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
