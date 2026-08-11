import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getIntegratedReport } from "@/lib/integrated-report.functions";
import { downloadIntegratedPdf } from "@/lib/integrated-pdf";
import { loadLogoDataUrl } from "@/lib/email-report";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  sessionId?: string;
  captureSessionId?: string;
  logoUrl?: string | null;
  variant?: "default" | "outline" | "secondary";
  className?: string;
  /** Muestra un aviso cuando no hay datos suficientes en lugar de ocultar el botón. */
  showWhenUnavailable?: boolean;
}

/**
 * Descarga el informe integrado (decisiones de la simulación + análisis de la
 * grabación). Se oculta si no hay una pareja simulación/grabación vinculable.
 */
export function IntegratedReportButton({
  sessionId,
  captureSessionId,
  logoUrl,
  variant = "secondary",
  className,
  showWhenUnavailable = false,
}: Props) {
  const fetchReport = useServerFn(getIntegratedReport);
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: ["integrated-report", sessionId ?? null, captureSessionId ?? null],
    queryFn: () =>
      fetchReport({
        data: {
          ...(sessionId ? { sessionId } : {}),
          ...(captureSessionId ? { captureSessionId } : {}),
        },
      }),
    enabled: Boolean(sessionId || captureSessionId),
    staleTime: 60_000,
  });

  const available = Boolean(q.data);

  if (!available) {
    if (!showWhenUnavailable || q.isLoading) return null;
    return (
      <p className="text-xs text-muted-foreground">
        El informe integrado estará disponible cuando la grabación y la simulación de este candidato
        estén vinculadas.
      </p>
    );
  }

  async function onDownload() {
    if (!q.data) return;
    setBusy(true);
    try {
      const logo = await loadLogoDataUrl(logoUrl || null);
      downloadIntegratedPdf({ report: q.data, branding: { logoDataUrl: logo } });
    } catch (e: any) {
      toast.error(e.message || "No se pudo generar el informe integrado");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant={variant} className={`gap-2 ${className ?? ""}`} onClick={onDownload} disabled={busy}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
      Informe integrado (PDF)
    </Button>
  );
}
