import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  compareSessionScenes,
  listComparableSessions,
  type ScenesComparison,
} from "@/lib/compare-scenes.functions";
import { getCaptureSession } from "@/lib/capture.functions";
import { formatSec } from "@/lib/analyze-metrics";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, GitCompare, Info, Loader2, Scale, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/capture/$id/compare")({
  head: () => ({
    meta: [
      { title: "Comparar escenas entre sesiones | Playnalyze" },
      {
        name: "description",
        content:
          "Compara las escenas de dos sesiones grabadas y descubre patrones de comportamiento similares con evidencias temporales en cada sesión.",
      },
      { property: "og:title", content: "Comparar escenas entre sesiones | Playnalyze" },
      {
        property: "og:description",
        content:
          "Patrones compartidos, diferencias observables y evidencias con minutos exactos en ambas sesiones.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ComparePage,
});

function EvidenceList({
  title,
  sessionId,
  items,
}: {
  title: string;
  sessionId: string;
  items: ScenesComparison["patterns"][number]["sessionAEvidence"];
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="mt-2 space-y-2">
        {items.map((e, i) => (
          <li key={i} className="text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="font-mono text-[11px]">
                {formatSec(e.startSec)}–{formatSec(e.endSec)}
              </Badge>
              <span className="font-medium">{e.sceneTitle}</span>
              <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
                <Link to="/app/capture/$id/scenes" params={{ id: sessionId }}>
                  Ver escenas
                </Link>
              </Button>
            </div>
            <p className="mt-1 text-muted-foreground">{e.observation}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ComparePage() {
  const { id } = Route.useParams();
  const getSession = useServerFn(getCaptureSession);
  const listSessions = useServerFn(listComparableSessions);
  const compare = useServerFn(compareSessionScenes);

  const [otherId, setOtherId] = useState<string>("");
  const [focus, setFocus] = useState("");
  const [result, setResult] = useState<ScenesComparison | null>(null);

  const { data: session } = useQuery({
    queryKey: ["capture-session", id],
    queryFn: () => getSession({ data: { id } }),
  });

  const { data: comparable = [], isLoading } = useQuery({
    queryKey: ["comparable-sessions"],
    queryFn: () => listSessions(),
  });

  const currentHasScenes = useMemo(
    () => comparable.some((s) => s.id === id),
    [comparable, id],
  );
  const others = useMemo(() => comparable.filter((s) => s.id !== id), [comparable, id]);

  const run = useMutation({
    mutationFn: () =>
      compare({
        data: { sessionAId: id, sessionBId: otherId, focus: focus.trim() || undefined },
      }),
    onSuccess: (data) => {
      setResult(data);
      toast.success("Comparativa generada");
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo comparar"),
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <Link
        to="/app/capture/$id/scenes"
        params={{ id }}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> Volver a Escenas
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Comparar escenas {session?.session ? `· ${session.session.title}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Compara esta sesión con otra ya analizada: la IA destaca patrones de comportamiento
          similares con evidencias temporales en ambas sesiones, siempre sobre hechos observables.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GitCompare className="h-4 w-4" /> Sesión a comparar
          </CardTitle>
          <CardDescription>
            Solo aparecen sesiones con película resumen generada.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!currentHasScenes && (
            <div className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Esta sesión aún no tiene escenas.{" "}
                <Link
                  to="/app/capture/$id/scenes"
                  params={{ id }}
                  className="font-medium underline"
                >
                  Genera la película resumen
                </Link>{" "}
                antes de comparar.
              </span>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="other-session">Segunda sesión</Label>
              <Select value={otherId} onValueChange={setOtherId} disabled={isLoading}>
                <SelectTrigger id="other-session">
                  <SelectValue
                    placeholder={
                      isLoading
                        ? "Cargando sesiones…"
                        : others.length
                          ? "Selecciona una sesión"
                          : "No hay otras sesiones con escenas"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {others.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.title} · {s.sceneCount} escenas
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="focus">Foco (opcional)</Label>
              <Input
                id="focus"
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                placeholder="Ej.: toma de decisiones, gestión del desacuerdo…"
                maxLength={500}
              />
            </div>
          </div>

          <Button
            className="gap-2"
            disabled={!otherId || !currentHasScenes || run.isPending}
            onClick={() => run.mutate()}
          >
            {run.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {run.isPending ? "Comparando…" : "Comparar sesiones"}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Scale className="h-4 w-4" /> {result.headline}
              </CardTitle>
              <CardDescription>
                {result.sessionA.title} ({result.sessionA.sceneCount} escenas) ·{" "}
                {result.sessionB.title} ({result.sessionB.sceneCount} escenas)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">{result.summary}</p>
            </CardContent>
          </Card>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Patrones similares</h2>
            {result.patterns.map((p, i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base">{p.pattern}</CardTitle>
                    <Badge variant="outline">{p.kind}</Badge>
                    <Badge>Similitud {p.similarity}/5</Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                  <EvidenceList
                    title={result.sessionA.title}
                    sessionId={result.sessionA.id}
                    items={p.sessionAEvidence}
                  />
                  <EvidenceList
                    title={result.sessionB.title}
                    sessionId={result.sessionB.id}
                    items={p.sessionBEvidence}
                  />
                </CardContent>
              </Card>
            ))}
          </section>

          {result.differences.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Diferencias observables</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {result.differences.map((d, i) => (
                  <div key={i} className="rounded-lg border p-3 text-sm">
                    <p className="font-medium">{d.aspect}</p>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <p className="text-muted-foreground">
                        <span className="font-medium text-foreground">{result.sessionA.title}: </span>
                        {d.sessionA}
                      </p>
                      <p className="text-muted-foreground">
                        <span className="font-medium text-foreground">{result.sessionB.title}: </span>
                        {d.sessionB}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recomendaciones</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {result.recommendations.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
