import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { averageDecisionSeconds, formatSeconds, voiceAnswerCount } from "@/lib/simulation-insights";
import { Columns3 } from "lucide-react";

const MAX_COMPARE = 5;

/** Compara competencias, puntos y tiempos de varios candidatos lado a lado. */
export function CandidateComparisonCard({
  sessions,
  criteria,
  practiceCount = 0,
}: {
  sessions: any[];
  criteria: { key: string; label: string }[];
  practiceCount?: number;
}) {
  const completed = useMemo(() => sessions.filter((s) => s.completed_at), [sessions]);
  const [picked, setPicked] = useState<string[] | null>(null);
  const selectedIds =
    picked ?? [...completed].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, MAX_COMPARE).map((s) => s.id);
  const selected = completed.filter((s) => selectedIds.includes(s.id));

  const keys = useMemo(() => {
    const set = new Set<string>(criteria.map((c) => c.key));
    for (const s of selected) for (const k of Object.keys(s.competency_scores ?? {})) set.add(k);
    return [...set];
  }, [criteria, selected]);
  const label = (k: string) => criteria.find((c) => c.key === k)?.label ?? k;

  const best = (vals: (number | null)[], higher = true) => {
    const nums = vals.filter((v): v is number => v != null);
    if (nums.length < 2 || nums.every((n) => n === nums[0])) return null;
    return higher ? Math.max(...nums) : Math.min(...nums);
  };

  const toggle = (id: string) => {
    const cur = selectedIds;
    if (cur.includes(id)) setPicked(cur.filter((x) => x !== id));
    else if (cur.length < MAX_COMPARE) setPicked([...cur, id]);
  };

  const rows: { label: string; values: (number | null)[]; fmt?: (v: number | null) => string; higher?: boolean }[] = [
    { label: "Puntos", values: selected.map((s) => s.score ?? 0) },
    { label: "Estrellas", values: selected.map((s) => s.stars ?? 0) },
    ...keys.map((k) => ({ label: label(k), values: selected.map((s) => Number(s.competency_scores?.[k] ?? 0)) })),
    { label: "Tiempo medio por decisión", values: selected.map((s) => averageDecisionSeconds(s.answers)), fmt: formatSeconds, higher: false },
    { label: "Respuestas por voz", values: selected.map((s) => voiceAnswerCount(s.answers)) },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Columns3 className="h-5 w-5 text-primary" aria-hidden /> Comparar candidatos
        </CardTitle>
        <CardDescription>
          Elige hasta {MAX_COMPARE} sesiones completadas. Se resalta el mejor valor de cada fila.
          {practiceCount > 0 && ` Hay ${practiceCount} sesión(es) de práctica que no se incluyen.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {completed.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay sesiones completadas para comparar.</p>
        ) : (
          <>
            <div className="flex max-h-40 flex-wrap gap-3 overflow-y-auto">
              {completed.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={selectedIds.includes(s.id)}
                    onCheckedChange={() => toggle(s.id)}
                    disabled={!selectedIds.includes(s.id) && selectedIds.length >= MAX_COMPARE}
                  />
                  {s.candidate_name || s.candidate_email || "Sin nombre"}
                  <span className="text-xs text-muted-foreground">
                    {new Date(s.completed_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                  </span>
                </label>
              ))}
            </div>
            {selected.length > 0 && (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead />
                      {selected.map((s) => (
                        <TableHead key={s.id}>
                          {s.candidate_name || "Sin nombre"}
                          <span className="block text-xs font-normal text-muted-foreground">
                            {new Date(s.completed_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}
                          </span>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => {
                      const top = best(r.values, r.higher !== false);
                      return (
                        <TableRow key={r.label}>
                          <TableCell className="text-sm font-medium">{r.label}</TableCell>
                          {r.values.map((v, i) => (
                            <TableCell
                              key={selected[i].id}
                              className={`text-sm tabular-nums ${top != null && v === top ? "font-bold text-primary" : ""}`}
                            >
                              {r.fmt ? r.fmt(v) : (v ?? "—")}
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
