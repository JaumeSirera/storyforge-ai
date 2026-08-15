import { useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Download, ImageDown, Table2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  formatSec,
  type SessionMetrics,
  type InteractionNetwork,
  type SpeakerMetrics,
} from "@/lib/analyze-metrics";

interface Props {
  sessionTitle: string;
  metrics: SessionMetrics | null;
  interactions: InteractionNetwork | null;
  speakerName: (key: string) => string;
}

type MetricKey = "talkSharePct" | "turns" | "interruptionsMade" | "interruptionsReceived" | "topicStarts";

const METRICS: { key: MetricKey; label: string; suffix?: string; hint: string }[] = [
  { key: "talkSharePct", label: "Reparto del tiempo", suffix: "%", hint: "Porcentaje del tiempo total de habla" },
  { key: "turns", label: "Turnos de palabra", hint: "Número de intervenciones" },
  { key: "interruptionsMade", label: "Interrumpe a otros", hint: "Entradas solapadas sobre otro hablante" },
  { key: "interruptionsReceived", label: "Es interrumpido", hint: "Veces que otro entra sobre su turno" },
  { key: "topicStarts", label: "Inicia tema", hint: "Arranques tras un silencio largo" },
];

/** Panel de insights grupales: comparativa entre participantes y visualizaciones descargables. */
export function GroupInsightsPanel({ sessionTitle, metrics, interactions, speakerName }: Props) {
  const [metricKey, setMetricKey] = useState<MetricKey>("talkSharePct");
  const chartRef = useRef<SVGSVGElement | null>(null);

  const speakers = metrics?.speakers ?? [];
  const active = METRICS.find((m) => m.key === metricKey)!;

  const rows = useMemo(() => {
    return speakers
      .map((s) => ({ ...s, name: speakerName(s.key) }))
      .sort((a, b) => Number(b[metricKey]) - Number(a[metricKey]));
  }, [speakers, metricKey, speakerName]);

  const max = Math.max(1, ...rows.map((r) => Number(r[metricKey])));

  const dynamics = useMemo(() => {
    const edges = interactions?.edges ?? [];
    return edges.slice(0, 12).map((e) => ({
      from: speakerName(e.from),
      to: speakerName(e.to),
      count: e.count,
      seconds: e.secondsSec,
    }));
  }, [interactions, speakerName]);

  if (!metrics || speakers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" /> Insights grupales
          </CardTitle>
          <CardDescription>
            Aún no hay métricas por participante. Transcribe la sesión en Analizar para comparar la
            dinámica del grupo.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const groupHighlights = buildHighlights(rows, metrics);

  function downloadCsv() {
    const header = [
      "participante",
      "tiempo_hablando_seg",
      "porcentaje_tiempo",
      "turnos",
      "turno_medio_seg",
      "turno_mas_largo_seg",
      "interrumpe",
      "es_interrumpido",
      "inicia_tema",
      "palabras",
      "primera_intervencion_seg",
    ];
    const body = rows.map((r) =>
      [
        r.name,
        r.talkTimeSec,
        r.talkSharePct,
        r.turns,
        r.avgTurnSec,
        r.longestTurnSec,
        r.interruptionsMade,
        r.interruptionsReceived,
        r.topicStarts,
        r.wordCount,
        r.firstSpokeAtSec ?? "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(";"),
    );
    const csv = [header.join(";"), ...body].join("\n");
    triggerDownload(
      new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
      `insights-grupales-${slug(sessionTitle)}.csv`,
    );
    toast.success("CSV descargado");
  }

  async function downloadPng() {
    const svg = chartRef.current;
    if (!svg) return;
    try {
      const clone = svg.cloneNode(true) as SVGSVGElement;
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      const source = new XMLSerializer().serializeToString(clone);
      const img = new Image();
      const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("No se pudo generar la imagen"));
        img.src = url;
      });
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = CHART_W * scale;
      canvas.height = chartHeight(rows.length) * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas no disponible");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
      if (!blob) throw new Error("No se pudo exportar el PNG");
      triggerDownload(blob, `grafico-${active.key}-${slug(sessionTitle)}.png`);
      toast.success("Gráfico descargado");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo descargar el gráfico");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" /> Insights grupales
          </CardTitle>
          <CardDescription>
            Comparativa objetiva entre participantes: reparto de turnos, interrupciones y dinámica de
            respuesta.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={downloadPng}>
            <ImageDown className="h-4 w-4" /> Gráfico PNG
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={downloadCsv}>
            <Table2 className="h-4 w-4" /> Datos CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-2 sm:grid-cols-3">
          {groupHighlights.map((h) => (
            <div key={h.label} className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">{h.label}</p>
              <p className="mt-1 text-sm font-semibold">{h.value}</p>
            </div>
          ))}
        </div>

        <Tabs value={metricKey} onValueChange={(v) => setMetricKey(v as MetricKey)}>
          <TabsList className="flex h-auto w-full flex-wrap justify-start">
            {METRICS.map((m) => (
              <TabsTrigger key={m.key} value={m.key} className="text-xs">
                {m.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {METRICS.map((m) => (
            <TabsContent key={m.key} value={m.key} className="mt-3 space-y-3">
              <p className="text-xs text-muted-foreground">{m.hint}</p>
              {m.key === metricKey && (
                <div className="overflow-x-auto">
                  <BarChart
                    ref={chartRef}
                    title={`${m.label} · ${sessionTitle}`}
                    rows={rows.map((r) => ({
                      name: r.name,
                      value: Number(r[m.key]),
                      label:
                        m.key === "talkSharePct"
                          ? `${r.talkSharePct}% (${formatSec(r.talkTimeSec)})`
                          : String(r[m.key]) + (m.suffix ?? ""),
                    }))}
                    max={max}
                  />
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="p-2 text-left font-medium">Participante</th>
                <th className="p-2 text-right font-medium">% tiempo</th>
                <th className="p-2 text-right font-medium">Turnos</th>
                <th className="p-2 text-right font-medium">Turno medio</th>
                <th className="p-2 text-right font-medium">Interrumpe</th>
                <th className="p-2 text-right font-medium">Interrumpido</th>
                <th className="p-2 text-right font-medium">Inicia tema</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-t border-border">
                  <td className="p-2 font-medium">{r.name}</td>
                  <td className="p-2 text-right tabular-nums">{r.talkSharePct}%</td>
                  <td className="p-2 text-right tabular-nums">{r.turns}</td>
                  <td className="p-2 text-right tabular-nums">{formatSec(r.avgTurnSec)}</td>
                  <td className="p-2 text-right tabular-nums">{r.interruptionsMade}</td>
                  <td className="p-2 text-right tabular-nums">{r.interruptionsReceived}</td>
                  <td className="p-2 text-right tabular-nums">{r.topicStarts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Dinámica de respuesta</p>
          {dynamics.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No se han detectado respuestas encadenadas entre participantes.
            </p>
          ) : (
            <ul className="space-y-2">
              {dynamics.map((d, i) => (
                <li
                  key={i}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-2 text-sm"
                >
                  <span>
                    <strong>{d.from}</strong> responde a <strong>{d.to}</strong>
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge variant="secondary">{d.count} veces</Badge>
                    <span className="text-xs text-muted-foreground">{formatSec(d.seconds)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const CHART_W = 720;
const ROW_H = 30;
const TOP = 44;
const LABEL_W = 150;

function chartHeight(count: number) {
  return TOP + Math.max(1, count) * ROW_H + 20;
}

interface BarRow {
  name: string;
  value: number;
  label: string;
}

const BarChart = ({
  ref,
  title,
  rows,
  max,
}: {
  ref: React.Ref<SVGSVGElement>;
  title: string;
  rows: BarRow[];
  max: number;
}) => {
  const H = chartHeight(rows.length);
  const barMax = CHART_W - LABEL_W - 110;
  return (
    <svg
      ref={ref}
      width={CHART_W}
      height={H}
      viewBox={`0 0 ${CHART_W} ${H}`}
      role="img"
      aria-label={title}
      className="min-w-[680px]"
    >
      <rect x={0} y={0} width={CHART_W} height={H} fill="#ffffff" />
      <text x={16} y={26} fontSize={14} fontWeight={700} fill="#253e7a" fontFamily="Helvetica, Arial">
        {title}
      </text>
      {rows.map((r, i) => {
        const y = TOP + i * ROW_H;
        const w = max > 0 ? Math.max(2, (r.value / max) * barMax) : 2;
        return (
          <g key={r.name + i}>
            <text x={16} y={y + 15} fontSize={11} fill="#3f3f46" fontFamily="Helvetica, Arial">
              {truncate(r.name, 22)}
            </text>
            <rect x={LABEL_W} y={y + 4} width={barMax} height={14} rx={4} fill="#eef1f7" />
            <rect x={LABEL_W} y={y + 4} width={w} height={14} rx={4} fill="#3b62c4" />
            <text
              x={LABEL_W + barMax + 8}
              y={y + 15}
              fontSize={11}
              fill="#52525b"
              fontFamily="Helvetica, Arial"
            >
              {r.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

function buildHighlights(rows: (SpeakerMetrics & { name: string })[], metrics: SessionMetrics) {
  const top = [...rows].sort((a, b) => b.talkTimeSec - a.talkTimeSec)[0];
  const quiet = [...rows].sort((a, b) => a.talkTimeSec - b.talkTimeSec)[0];
  const interrupter = [...rows].sort((a, b) => b.interruptionsMade - a.interruptionsMade)[0];
  return [
    {
      label: "Equilibrio de participación",
      value: `${Math.round(metrics.participationBalance * 100)}% · ${
        metrics.participationBalance >= 0.7 ? "reparto equilibrado" : "reparto desigual"
      }`,
    },
    {
      label: "Mayor y menor presencia",
      value:
        top && quiet
          ? `${top.name} (${top.talkSharePct}%) · ${quiet.name} (${quiet.talkSharePct}%)`
          : "—",
    },
    {
      label: "Interrupciones",
      value:
        interrupter && interrupter.interruptionsMade > 0
          ? `${metrics.totalInterruptions} en total · lidera ${interrupter.name} (${interrupter.interruptionsMade})`
          : `${metrics.totalInterruptions} en total`,
    },
  ];
}

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function slug(s: string) {
  return (
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 40) || "sesion"
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
