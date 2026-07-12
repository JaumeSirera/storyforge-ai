import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyBilling, listMyUsage } from "@/lib/billing.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditCard, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/billing")({
  component: BillingPage,
});

function money(cents: number, currency = "EUR") {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format((cents ?? 0) / 100);
}

function BillingPage() {
  const getB = useServerFn(getMyBilling);
  const listU = useServerFn(listMyUsage);
  const { data: b } = useQuery({ queryKey: ["my-billing"], queryFn: () => getB() });
  const { data: rows } = useQuery({ queryKey: ["my-usage"], queryFn: () => listU({ data: { limit: 50 } }) });

  const status = b?.subscriptionStatus ?? "sin_suscripcion";
  const includedPct = b && b.includedCapCents > 0 ? Math.min(100, (b.includedUsedCents / b.includedCapCents) * 100) : 0;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><CreditCard className="h-6 w-6" /> Facturación</h1>
        <p className="text-muted-foreground text-sm">Suscripción y consumo por uso.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Suscripción</CardTitle>
          <Badge variant={status === "active" ? "default" : "secondary"}>{status}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Consumo incluido usado</span>
              <span className="font-medium">
                {money(b?.includedUsedCents ?? 0, b?.currency)} / {money(b?.includedCapCents ?? 0, b?.currency)}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${includedPct}%` }} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <div className="text-sm text-muted-foreground">Extra pendiente de facturar</div>
              <div className="text-lg font-semibold">{money(b?.extraPendingCents ?? 0, b?.currency)}</div>
            </div>
            <Button disabled title="Se activará al configurar Stripe">
              <Sparkles className="h-4 w-4 mr-1" /> Suscribirme
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            El pago por Stripe se activará en cuanto el administrador conecte la cuenta.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Consumo reciente</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Acción</th>
                  <th className="px-3 py-2">Proveedor</th>
                  <th className="px-3 py-2">Detalle</th>
                  <th className="px-3 py-2 text-right">Coste</th>
                </tr>
              </thead>
              <tbody>
                {(rows ?? []).map((r: any) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-3 py-2">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="px-3 py-2 capitalize">{r.action}</td>
                    <td className="px-3 py-2 capitalize">{r.provider}</td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">
                      {r.action === "text" && `${r.input_tokens ?? 0}+${r.output_tokens ?? 0} tok`}
                      {(r.action === "video" || r.action === "lipsync") && `${r.seconds ?? 0}s`}
                      {r.action === "tts" && `${r.characters ?? 0} chars`}
                      {r.action === "image" && `${r.units ?? 1} img`}
                    </td>
                    <td className="px-3 py-2 text-right">{money(r.total_cents, b?.currency)}</td>
                  </tr>
                ))}
                {(!rows || rows.length === 0) && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Sin consumo aún.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
