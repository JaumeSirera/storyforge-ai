import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { validateAssessmentSource } from "@/lib/assessments.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, HelpCircle, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

type Status = "supported" | "partial" | "unsupported";

const STATUS_META: Record<Status, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  supported: { label: "Soportada por el texto", variant: "default" },
  partial: { label: "Parcial / ambigua", variant: "secondary" },
  unsupported: { label: "No está en el texto", variant: "destructive" },
};

function StatusIcon({ status }: { status: Status }) {
  if (status === "supported") return <CheckCircle2 className="h-4 w-4 text-primary shrink-0" aria-hidden />;
  if (status === "partial") return <HelpCircle className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />;
  return <AlertTriangle className="h-4 w-4 text-destructive shrink-0" aria-hidden />;
}

export function SourceValidationCard({
  assessmentId,
  hasSourceText,
  questionCount,
}: {
  assessmentId: string;
  hasSourceText: boolean;
  questionCount: number;
}) {
  const validateFn = useServerFn(validateAssessmentSource);

  const validate = useMutation({
    mutationFn: () => validateFn({ data: { id: assessmentId } }),
    onSuccess: (res: any) => {
      if (!res?.hasSource) {
        toast.info("Esta evaluación no tiene texto base con el que comparar las preguntas.");
        return;
      }
      if (res.unsupported > 0 || res.partial > 0) {
        toast.warning(`${res.unsupported} sin soporte y ${res.partial} dudosas`);
      } else {
        toast.success("Todas las preguntas están ancladas al texto base");
      }
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo validar"),
  });

  const result = validate.data as
    | {
        hasSource: boolean;
        items: { questionId: string; index: number; prompt: string; status: Status; evidence: string; issue: string }[];
        supported: number;
        partial: number;
        unsupported: number;
      }
    | undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-primary" /> Validación contra el texto base
        </CardTitle>
        <CardDescription>
          Comprueba, antes de guardar o publicar, qué preguntas se pueden responder solo con el texto
          base y cuáles requieren información externa.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => validate.mutate()}
            disabled={validate.isPending || questionCount === 0}
            variant="secondary"
          >
            {validate.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4 mr-2" />
            )}
            Validar preguntas
          </Button>
          {!hasSourceText && (
            <p className="text-xs text-muted-foreground">
              Esta evaluación no tiene texto base guardado: la validación no podrá comparar nada.
            </p>
          )}
        </div>

        {result?.hasSource && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge>{result.supported} soportadas</Badge>
              <Badge variant="secondary">{result.partial} parciales</Badge>
              <Badge variant="destructive">{result.unsupported} sin soporte</Badge>
            </div>
            <ul className="space-y-2">
              {result.items.map((item) => (
                <li key={item.questionId} className="rounded-md border border-border p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 min-w-0">
                      <StatusIcon status={item.status} />
                      <span className="font-medium">
                        {item.index}. {item.prompt}
                      </span>
                    </div>
                    <Badge variant={STATUS_META[item.status].variant} className="shrink-0">
                      {STATUS_META[item.status].label}
                    </Badge>
                  </div>
                  {item.evidence && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Evidencia: <q>{item.evidence}</q>
                    </p>
                  )}
                  {item.issue && (
                    <p className="mt-1 text-xs text-destructive">{item.issue}</p>
                  )}
                </li>
              ))}
            </ul>
            {result.unsupported + result.partial > 0 && (
              <p className="text-xs text-muted-foreground">
                Regenera la prueba o edita esas preguntas en la rúbrica antes de publicarla.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
