import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  getMyBilling,
  listMyUsage,
  listMyPayments,
  getMyPaymentReceipt,
  createSubscriptionCheckout,
  payExtraNow,
  cancelSubscription,
} from "@/lib/billing.functions";
import { downloadReceiptPdf } from "@/lib/receipt-pdf";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CreditCard, Sparkles, Download, Receipt, Activity, Heart, Wallet, Info } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/billing")({
  head: () => ({
    meta: [
      { title: "Facturación — Xandralyze" },
      {
        name: "description",
        content:
          "Gestiona tu donación mensual voluntaria, el consumo de IA y el historial de pagos de Xandralyze.",
      },
      { property: "og:title", content: "Facturación — Xandralyze" },
      {
        property: "og:description",
        content:
          "Donación voluntaria para mantener la plataforma, consumo de IA y pagos seguros por Redsys.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
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

const KIND_LABEL: Record<string, string> = {
  subscription: "Donación mensual",
  renewal: "Renovación",
  extra: "Consumo extra de IA",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  paid: "default",
  pending: "secondary",
  failed: "destructive",
  canceled: "outline",
};

function BillingPage() {
  const getB = useServerFn(getMyBilling);
  const listU = useServerFn(listMyUsage);
  const listP = useServerFn(listMyPayments);
  const getReceipt = useServerFn(getMyPaymentReceipt);
  const startCheckout = useServerFn(createSubscriptionCheckout);
  const payExtra = useServerFn(payExtraNow);
  const cancel = useServerFn(cancelSubscription);
  const qc = useQueryClient();
  const { data: b } = useQuery({ queryKey: ["my-billing"], queryFn: () => getB() });
  const { data: rows } = useQuery({ queryKey: ["my-usage"], queryFn: () => listU({ data: { limit: 50 } }) });
  const { data: payments } = useQuery({
    queryKey: ["my-payments"],
    queryFn: () => listP({ data: { limit: 100 } }),
  });
  const toastedRef = useRef(false);
  const [donationAmount, setDonationAmount] = useState<number>(5);
  const [customAmount, setCustomAmount] = useState<string>("");

  useEffect(() => {
    if (toastedRef.current) return;
    const url = new URL(window.location.href);
    const r = url.searchParams.get("redsys");
    if (r === "ok") {
      toast.success("Pago recibido. Actualizamos tu suscripción en unos segundos.");
      toastedRef.current = true;
      url.searchParams.delete("redsys");
      window.history.replaceState({}, "", url.toString());
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["my-billing"] });
        qc.invalidateQueries({ queryKey: ["my-payments"] });
      }, 2500);
    } else if (r === "ko") {
      toast.error("Pago cancelado o rechazado.");
      toastedRef.current = true;
      url.searchParams.delete("redsys");
      window.history.replaceState({}, "", url.toString());
    }
  }, [qc]);

  const subscribe = useMutation({
    mutationFn: async () =>
      startCheckout({
        data: {
          origin: window.location.origin,
          amountCents: Math.round(donationAmount * 100),
          description: `Xandralyze — Donación ${donationAmount}€/mes`,
        },
      }),
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
        qc.invalidateQueries({ queryKey: ["my-payments"] });
      } else {
        toast.info("No hay saldo pendiente.");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const doCancel = useMutation({
    mutationFn: async () => cancel(),
    onSuccess: () => {
      toast.success("Aportación mensual cancelada. No se realizarán más cobros automáticos.");
      qc.invalidateQueries({ queryKey: ["my-billing"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const status = b?.subscriptionStatus ?? "sin_suscripcion";
  const isActive = status === "active" || status === "trialing";
  const includedPct = b && b.includedCapCents > 0 ? Math.min(100, (b.includedUsedCents / b.includedCapCents) * 100) : 0;

  async function handleDownload(paymentId: string) {
    try {
      const data = await getReceipt({ data: { paymentId } });
      downloadReceiptPdf(data);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><CreditCard className="h-6 w-6" /> Facturación</h1>
        <p className="text-muted-foreground text-sm">Donación mensual voluntaria, consumo por uso de IA e historial de pagos. Pagos procesados por Redsys.</p>
      </div>

      <Tabs defaultValue="subscription" className="w-full">
        <TabsList>
          <TabsTrigger value="subscription"><Heart className="h-4 w-4 mr-1" /> Donación</TabsTrigger>
          <TabsTrigger value="usage"><Activity className="h-4 w-4 mr-1" /> Consumo (IA)</TabsTrigger>
          <TabsTrigger value="payments"><Receipt className="h-4 w-4 mr-1" /> Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="subscription" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-destructive" /> Donación mensual
              </CardTitle>
              <Badge variant={status === "active" ? "default" : "secondary"}>
                {status === "active" ? "Activa" : status === "canceled" ? "Cancelada" : "Sin activar"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
                <Info className="inline h-4 w-4 mr-1.5 align-text-bottom" />
                Xandralyze es gratuito en uso. Esta aportación es voluntaria y mantiene la plataforma activa.
                Antes se mostraba un importe fijo de 19€; ahora <span className="font-medium text-foreground">tú eliges</span> cuánto aportar cada mes.
              </div>

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

              {!isActive ? (
                <div className="space-y-4">
                  <div>
                    <Label className="mb-2 block">Elige tu aportación mensual</Label>
                    <div className="flex flex-wrap items-center gap-2">
                      {[5, 10, 25, 50].map((a) => (
                        <Button
                          key={a}
                          type="button"
                          variant={donationAmount === a ? "default" : "outline"}
                          onClick={() => {
                            setDonationAmount(a);
                            setCustomAmount("");
                          }}
                        >
                          {a}€
                        </Button>
                      ))}
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          placeholder="Otro"
                          className="w-24"
                          value={customAmount}
                          onChange={(e) => {
                            const v = e.target.value;
                            setCustomAmount(v);
                            const n = Number(v);
                            if (v && !Number.isNaN(n) && n > 0) setDonationAmount(n);
                          }}
                        />
                        <span className="text-sm text-muted-foreground">€</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
                      <Wallet className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Aportación elegida</div>
                      <div className="text-2xl font-bold">
                        {money(donationAmount * 100, b?.currency)}
                        <span className="text-sm font-normal text-muted-foreground">/mes</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={() => subscribe.mutate()}
                    disabled={subscribe.isPending || donationAmount < 1}
                    className="w-full sm:w-auto"
                  >
                    <CreditCard className="h-4 w-4 mr-1" />
                    Donar {donationAmount}€/mes con tarjeta
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Al pulsar el botón irás a Redsys para pagar con tarjeta de forma segura. Se guardará una referencia de la tarjeta para renovar la donación mensualmente; puedes cancelarla cuando quieras.
                  </p>
                </div>
              ) : (
                <>
                  {b?.hasSavedCard && (
                    <div className="text-sm text-muted-foreground">
                      Tarjeta guardada: <span className="font-medium">{b.cardBrand ?? "•••"} — caduca {b.cardExpiry ?? "—"}</span>
                      {b.nextChargeAt && (
                        <> · próxima aportación: <span className="font-medium">{new Date(b.nextChargeAt).toLocaleDateString("es-ES")}</span></>
                      )}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-border p-3">
                    <div>
                      <div className="text-sm text-muted-foreground">Consumo extra de IA pendiente</div>
                      <div className="text-lg font-semibold">{money(b?.extraPendingCents ?? 0, b?.currency)}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => pay.mutate()}
                        disabled={pay.isPending || !b || b.extraPendingCents <= 0}
                      >
                        <CreditCard className="h-4 w-4 mr-1" />
                        Pagar {money(b?.extraPendingCents ?? 0, b?.currency)} con tarjeta
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (confirm("¿Cancelar la aportación mensual? Podrás seguir usando Xandralyze hasta el fin del periodo actual.")) {
                            doCancel.mutate();
                          }
                        }}
                        disabled={doCancel.isPending}
                      >
                        Cancelar donación
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Los pagos se procesan de forma segura mediante Redsys (VITA Training). Si tienes tarjeta guardada, el consumo extra se carga automáticamente; si no, te pedirá los datos de tarjeta en cada pago.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage" className="mt-4">
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
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Historial de pagos</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="px-3 py-2">Fecha</th>
                      <th className="px-3 py-2">Nº pedido</th>
                      <th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2">Estado</th>
                      <th className="px-3 py-2">Autorización</th>
                      <th className="px-3 py-2 text-right">Importe</th>
                      <th className="px-3 py-2 text-right">Recibo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(payments ?? []).map((p) => (
                      <tr key={p.id} className="border-t border-border">
                        <td className="px-3 py-2">{new Date(p.created_at).toLocaleString("es-ES")}</td>
                        <td className="px-3 py-2 font-mono text-xs">{p.order_code}</td>
                        <td className="px-3 py-2">{KIND_LABEL[p.kind] ?? p.kind}</td>
                        <td className="px-3 py-2">
                          <Badge variant={STATUS_VARIANT[p.status] ?? "secondary"}>{p.status}</Badge>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{p.auth_code ?? "—"}</td>
                        <td className="px-3 py-2 text-right font-medium">{money(p.amount_cents, p.currency)}</td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={p.status !== "paid"}
                            onClick={() => handleDownload(p.id)}
                            title={p.status === "paid" ? "Descargar recibo PDF" : "Solo disponible para pagos completados"}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {(!payments || payments.length === 0) && (
                      <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Sin pagos registrados aún.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
