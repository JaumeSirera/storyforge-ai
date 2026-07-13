import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import {
  getMyBilling,
  listMyUsage,
  createSubscriptionCheckout,
  payExtraNow,
  cancelSubscription,
} from "@/lib/billing.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditCard, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/billing")({
  component: BillingPage,
});

function money(cents: number, currency = "EUR") {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format((cents ?? 0) / 100);
}

/** Auto-submit a hidden form POST to Redsys checkout. */
function redsysRedirect(params: {
  url: string;
  merchantParameters: string;
  signature: string;
  signatureVersion: string;
}) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = params.url;
  form.style.display = "none";
  const fields: Record<string, string> = {
    Ds_SignatureVersion: params.signatureVersion,
    Ds_MerchantParameters: params.merchantParameters,
    Ds_Signature: params.signature,
  };
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

function BillingPage() {
  const getB = useServerFn(getMyBilling);
  const listU = useServerFn(listMyUsage);
  const startCheckout = useServerFn(createSubscriptionCheckout);
  const payExtra = useServerFn(payExtraNow);
  const cancel = useServerFn(cancelSubscription);
  const qc = useQueryClient();
  const { data: b } = useQuery({ queryKey: ["my-billing"], queryFn: () => getB() });
  const { data: rows } = useQuery({ queryKey: ["my-usage"], queryFn: () => listU({ data: { limit: 50 } }) });
  const toastedRef = useRef(false);

  useEffect(() => {
    if (toastedRef.current) return;
    const url = new URL(window.location.href);
    const r = url.searchParams.get("redsys");
    if (r === "ok") {
      toast.success("Pago recibido. Actualizamos tu suscripción en unos segundos.");
      toastedRef.current = true;
      url.searchParams.delete("redsys");
      window.history.replaceState({}, "", url.toString());
      setTimeout(() => qc.invalidateQueries({ queryKey: ["my-billing"] }), 2500);
    } else if (r === "ko") {
      toast.error("Pago cancelado o rechazado.");
      toastedRef.current = true;
      url.searchParams.delete("redsys");
      window.history.replaceState({}, "", url.toString());
    }
  }, [qc]);

  const subscribe = useMutation({
    mutationFn: async () => startCheckout({ data: { origin: window.location.origin } }),
    onSuccess: (r) => redsysRedirect(r),
    onError: (e: Error) => toast.error(e.message),
  });
  const pay = useMutation({
    mutationFn: async () => payExtra({ data: { origin: window.location.origin } }),
    onSuccess: (r) => {
      if (r.mode === "redirect") {
        redsysRedirect(r);
      } else if (r.mode === "charged") {
        if (r.ok) toast.success("Cobro realizado correctamente.");
        else toast.error(`El cobro fue rechazado (código ${r.responseCode}).`);
        qc.invalidateQueries({ queryKey: ["my-billing"] });
      } else {
        toast.info("No hay saldo pendiente.");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const doCancel = useMutation({
    mutationFn: async () => cancel(),
    onSuccess: () => {
      toast.success("Suscripción cancelada. No se realizarán más cobros automáticos.");
      qc.invalidateQueries({ queryKey: ["my-billing"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const status = b?.subscriptionStatus ?? "sin_suscripcion";
  const isActive = status === "active" || status === "trialing";
  const includedPct = b && b.includedCapCents > 0 ? Math.min(100, (b.includedUsedCents / b.includedCapCents) * 100) : 0;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><CreditCard className="h-6 w-6" /> Facturación</h1>
        <p className="text-muted-foreground text-sm">Suscripción y consumo por uso. Pagos procesados por Redsys.</p>
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

          {b?.hasSavedCard && (
            <div className="text-sm text-muted-foreground">
              Tarjeta guardada: <span className="font-medium">{b.cardBrand ?? "•••"} — caduca {b.cardExpiry ?? "—"}</span>
              {b.nextChargeAt && (
                <> · próximo cobro: <span className="font-medium">{new Date(b.nextChargeAt).toLocaleDateString("es-ES")}</span></>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-border p-3">
            <div>
              <div className="text-sm text-muted-foreground">Extra pendiente de facturar</div>
              <div className="text-lg font-semibold">{money(b?.extraPendingCents ?? 0, b?.currency)}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {!isActive ? (
                <Button onClick={() => subscribe.mutate()} disabled={subscribe.isPending}>
                  <Sparkles className="h-4 w-4 mr-1" /> Suscribirme
                </Button>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => pay.mutate()}
                    disabled={pay.isPending || !b || b.extraPendingCents <= 0}
                  >
                    Pagar extra
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (confirm("¿Cancelar la renovación automática? Podrás seguir usando el servicio hasta el fin del periodo.")) {
                        doCancel.mutate();
                      }
                    }}
                    disabled={doCancel.isPending}
                  >
                    Cancelar suscripción
                  </Button>
                </>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Los pagos se procesan de forma segura mediante Redsys (VITA Training). Al suscribirte guardamos una referencia de la tarjeta para renovar automáticamente cada mes.
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
