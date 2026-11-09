import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSimilarSubmissions } from "@/lib/exam-audit.functions";
import type { SimilarPair } from "@/lib/exam-similarity";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Loader2, RefreshCw } from "lucide-react";

export function SimilarSubmissionsCard({ assessmentId }: { assessmentId: string }) {
  const fetchSimilar = useServerFn(listSimilarSubmissions);
  const q = useQuery({
    queryKey: ["similar-submissions", assessmentId],
    queryFn: () =>
      fetchSimilar({ data: { assessmentId } }) as Promise<{ compared: number; pairs: SimilarPair[] }>,
  });
  const pairs = q.data?.pairs ?? [];
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5 text-primary" aria-hidden /> Respuestas parecidas
          </CardTitle>
          <CardDescription>
            Compara las respuestas escritas de todas las entregas y avisa cuando dos aspirantes
            responden casi igual a la misma pregunta (la mitad o más de grupos de 3 palabras en común).
            Es un indicio para revisar, no una prueba.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => q.refetch()} disabled={q.isFetching}>
          {q.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Actualizar
        </Button>
      </CardHeader>
      <CardContent>
        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Comparando entregas…</p>
        ) : q.isError ? (
          <p className="text-sm text-destructive">{(q.error as Error).message}</p>
        ) : pairs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay respuestas sospechosamente parecidas entre las {q.data?.compared ?? 0} entregas comparadas.
          </p>
        ) : (
          <ul className="space-y-3">
            {pairs.map((p) => (
              <li key={`${p.a.id}-${p.b.id}`} className="rounded-md border border-border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{p.a.name}</span>
                  <span className="text-muted-foreground">y</span>
                  <span className="font-medium">{p.b.name}</span>
                  <Badge variant={p.maxScore >= 0.8 ? "destructive" : "outline"}>
                    {Math.round(p.maxScore * 100)} % de coincidencia
                  </Badge>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {p.questions
                    .map((x) => `Pregunta ${x.question} (${Math.round(x.score * 100)} %)`)
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
