import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  DIMENSION_DESCRIPTIONS,
  DIMENSION_LABELS,
  DIMENSION_STATUS_LABELS,
  dimensionStatus,
  gradeLabel,
} from "@/lib/assessments-shared";
import type { ScoreDimension, SubmissionRecord } from "@/lib/assessments-shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, FileText } from "lucide-react";

interface Props {
  assessmentId: string;
  submissions: SubmissionRecord[];
}

type Row = {
  key: string;
  name: string;
  identifier: string | null;
  submission: SubmissionRecord;
  score: number | null;
  maxScore: number;
  breakdown: ScoreDimension[];
  belowCount: number;
};

function DimensionRow({ dim }: { dim: ScoreDimension }) {
  const status = dimensionStatus(dim.score, dim.threshold);
  const below = status === "below";
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-medium">{DIMENSION_LABELS[dim.key]}</span>
        <span className={below ? "font-semibold text-destructive" : "text-muted-foreground"}>
          {Math.round(dim.score)} / 100 · umbral {dim.threshold} · peso {dim.weightPct}%
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-muted" role="presentation">
        <div
          className={`h-2 rounded-full ${below ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${Math.max(0, Math.min(100, dim.score))}%` }}
        />
        <div
          className="absolute top-[-2px] h-3 w-0.5 bg-foreground/60"
          style={{ left: `${Math.max(0, Math.min(100, dim.threshold))}%` }}
          aria-hidden="true"
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        {below ? (
          <span className="inline-flex items-center gap-1 text-destructive">
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            {DIMENSION_STATUS_LABELS.below}: {DIMENSION_DESCRIPTIONS[dim.key]}
          </span>
        ) : (
          DIMENSION_STATUS_LABELS[status]
        )}
      </p>
    </div>
  );
}

export function CandidateBreakdownPanel({ assessmentId, submissions }: Props) {
  const [search, setSearch] = useState("");
  const [onlyBelow, setOnlyBelow] = useState(false);

  const rows = useMemo<Row[]>(() => {
    const byCandidate = new Map<string, SubmissionRecord>();
    for (const s of submissions) {
      const key = (s.candidateIdentifier || s.candidateName || s.id).trim().toLowerCase();
      const current = byCandidate.get(key);
      if (!current || new Date(s.createdAt).getTime() > new Date(current.createdAt).getTime()) {
        byCandidate.set(key, s);
      }
    }
    return Array.from(byCandidate.entries())
      .map(([key, submission]) => {
        const breakdown = submission.evaluation?.breakdown ?? [];
        return {
          key,
          name: submission.candidateName,
          identifier: submission.candidateIdentifier,
          submission,
          score: submission.evaluation?.score ?? submission.score ?? null,
          maxScore: submission.evaluation?.maxScore ?? submission.maxScore ?? 10,
          breakdown,
          belowCount: breakdown.filter((d) => dimensionStatus(d.score, d.threshold) === "below")
            .length,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [submissions]);

  const filtered = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    const matches =
      !q || r.name.toLowerCase().includes(q) || (r.identifier ?? "").toLowerCase().includes(q);
    return matches && (!onlyBelow || r.belowCount > 0);
  });

  const alerts = rows.filter((r) => r.belowCount > 0).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Seguimiento por candidato</CardTitle>
          <CardDescription>
            Última entrega de cada candidato con su nota y el desglose por contenido, estructura,
            corrección lingüística y grafismo. Se avisa cuando alguna dimensión queda por debajo del
            umbral exigido.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o identificador"
            className="max-w-xs"
            aria-label="Buscar candidato"
          />
          <Button
            variant={onlyBelow ? "default" : "secondary"}
            size="sm"
            onClick={() => setOnlyBelow((v) => !v)}
          >
            <AlertTriangle className="mr-2 h-4 w-4" aria-hidden="true" />
            Solo con aviso ({alerts})
          </Button>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {rows.length === 0
              ? "Todavía no hay entregas de candidatos."
              : "Ningún candidato coincide con el filtro."}
          </CardContent>
        </Card>
      ) : (
        filtered.map((row) => (
          <Card key={row.key}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="text-base truncate">{row.name}</CardTitle>
                  <CardDescription>
                    {row.identifier ? `${row.identifier} · ` : ""}
                    Última entrega: {new Date(row.submission.createdAt).toLocaleString()}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {row.score !== null ? (
                    <>
                      <span className="text-2xl font-bold text-primary">
                        {row.score.toFixed(2)}
                        <span className="text-sm text-muted-foreground"> / {row.maxScore}</span>
                      </span>
                      <Badge>{gradeLabel(row.score, row.maxScore)}</Badge>
                    </>
                  ) : (
                    <Badge variant="secondary">Sin corregir</Badge>
                  )}
                  {row.belowCount > 0 ? (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                      {row.belowCount} dimensión(es) bajo umbral
                    </Badge>
                  ) : row.breakdown.length > 0 ? (
                    <Badge variant="outline" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Cumple umbrales
                    </Badge>
                  ) : null}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {row.breakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Esta entrega aún no tiene desglose por dimensiones. Vuelve a corregirla para
                  generarlo.
                </p>
              ) : (
                row.breakdown.map((dim) => <DimensionRow key={dim.key} dim={dim} />)
              )}
              <Link
                to="/app/assessments/$id/submissions/$sid"
                params={{ id: assessmentId, sid: row.submission.id }}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <FileText className="h-4 w-4" aria-hidden="true" /> Ver informe completo
              </Link>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
