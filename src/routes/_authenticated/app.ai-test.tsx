import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AI_MODELS, type AiModelId } from "@/lib/ai-models";
import { usePreferredAiModel } from "@/lib/preferred-model";
import { testAiFallback, type AiFallbackTestResult } from "@/lib/ai-test.functions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, FlaskConical, XCircle, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/ai-test")({
  head: () => ({
    meta: [
      { title: "Probar IA y fallback — Xandralyze" },
      {
        name: "description",
        content:
          "Comprueba que, si el modelo de IA elegido falla, Xandralyze cambia automáticamente al siguiente modelo disponible.",
      },
      { property: "og:title", content: "Probar IA y fallback — Xandralyze" },
      {
        property: "og:description",
        content:
          "Diagnóstico de la cadena de modelos de IA: fuerza un fallo y verifica el cambio automático de modelo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AiTestPage,
});

const STATUS_STYLE: Record<string, { icon: typeof CheckCircle2; className: string }> = {
  ok: { icon: CheckCircle2, className: "text-emerald-500" },
  error: { icon: XCircle, className: "text-destructive" },
  "forzado-fallo": { icon: AlertTriangle, className: "text-amber-500" },
};

function AiTestPage() {
  const { model, setModel } = usePreferredAiModel();
  const [forceFailures, setForceFailures] = useState(1);
  const [result, setResult] = useState<AiFallbackTestResult | null>(null);
  const runTest = useServerFn(testAiFallback);

  const test = useMutation({
    mutationFn: () => runTest({ data: { model, forceFailures } }),
    onSuccess: (res) => {
      setResult(res);
      if (res.ok && res.fellBack) toast.success("Fallback verificado correctamente");
      else if (res.ok) toast.success("El modelo respondió sin necesitar fallback");
      else toast.error("Ningún modelo de la cadena pudo responder");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="space-y-1">
        <Link
          to="/app/settings"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Volver a Ajustes
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <FlaskConical className="h-6 w-6 text-primary" aria-hidden />
          Probar IA y fallback
        </h1>
        <p className="text-muted-foreground">
          Forzamos el fallo del modelo elegido y comprobamos que la generación continúa
          automáticamente con el siguiente modelo disponible.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuración de la prueba</CardTitle>
          <CardDescription>
            Tu modelo preferido se guarda en este dispositivo y también en tu cuenta, así que se
            mantiene entre sesiones y entre web y móvil.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ai-test-model">Modelo de IA</Label>
            <Select value={model} onValueChange={(v) => setModel(v as AiModelId)}>
              <SelectTrigger id="ai-test-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AI_MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ai-test-failures">Fallos forzados antes de dejar responder</Label>
            <Select
              value={String(forceFailures)}
              onValueChange={(v) => setForceFailures(Number(v))}
            >
              <SelectTrigger id="ai-test-failures">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">0 · sin fallos (prueba normal)</SelectItem>
                <SelectItem value="1">1 · falla el modelo elegido</SelectItem>
                <SelectItem value="2">2 · fallan los dos primeros</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={() => test.mutate()} disabled={test.isPending}>
            {test.isPending ? "Probando…" : "Ejecutar prueba"}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              Resultado
              {result.ok ? (
                <Badge variant={result.fellBack ? "secondary" : "default"}>
                  {result.fellBack ? "Fallback aplicado" : "Sin fallback"}
                </Badge>
              ) : (
                <Badge variant="destructive">Fallido</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Modelo solicitado: <span className="font-mono">{result.requestedModel}</span>
              {result.usedModel && (
                <>
                  {" · "}modelo que respondió:{" "}
                  <span className="font-mono">
                    {result.usedProvider}/{result.usedModel}
                  </span>
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="space-y-2">
              {result.attempts.map((a) => {
                const style = STATUS_STYLE[a.status] ?? STATUS_STYLE["error"]!;
                const Icon = style.icon;
                return (
                  <li
                    key={a.order}
                    className="flex items-start gap-3 rounded-md border border-border p-3"
                  >
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${style.className}`} aria-hidden />
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-medium">
                        Intento {a.order}:{" "}
                        <span className="font-mono">
                          {a.provider}/{a.modelId}
                        </span>
                      </p>
                      <p className="break-words text-sm text-muted-foreground">{a.detail}</p>
                    </div>
                  </li>
                );
              })}
            </ol>

            {result.answer && (
              <p className="text-sm">
                Respuesta final: <span className="font-medium">{result.answer}</span>
              </p>
            )}
            {result.error && <p className="text-sm text-destructive">{result.error}</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
