import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPricingConfig, updatePricingConfig } from "@/lib/pricing.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_authenticated/app/admin/pricing")({
  component: AdminPricingPage,
});

type NumField = { key: string; label: string; hint: string };

const RATES: NumField[] = [
  { key: "openai_input_per_1k", label: "OpenAI · input / 1K tokens (cents)", hint: "Coste bruto por 1000 tokens de entrada" },
  { key: "openai_output_per_1k", label: "OpenAI · output / 1K tokens (cents)", hint: "Coste bruto por 1000 tokens de salida" },
  { key: "gemini_input_per_1k", label: "Gemini · input / 1K tokens (cents)", hint: "" },
  { key: "gemini_output_per_1k", label: "Gemini · output / 1K tokens (cents)", hint: "" },
  { key: "replicate_video_per_second", label: "Vídeo Replicate · por segundo (cents)", hint: "Estimación wall-clock" },
  { key: "replicate_lipsync_per_second", label: "Lipsync Replicate · por segundo (cents)", hint: "" },
  { key: "replicate_image_per_unit", label: "Imagen · por unidad (cents)", hint: "Personajes generados" },
  { key: "elevenlabs_per_1k_chars", label: "ElevenLabs · por 1K caracteres (cents)", hint: "" },
];

const MARGINS: NumField[] = [
  { key: "margin_user_pays_pct", label: "Margen % — usuario paga con sus claves", hint: "Tarifa de servicio sobre coste bruto" },
  { key: "margin_platform_pays_pct", label: "Margen % — plataforma paga", hint: "Margen sobre coste bruto asumido por la plataforma" },
];

function AdminPricingPage() {
  const qc = useQueryClient();
  const get = useServerFn(getPricingConfig);
  const upd = useServerFn(updatePricingConfig);
  const { data, isLoading } = useQuery({ queryKey: ["pricing-config"], queryFn: () => get() });
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!data) return;
    const f: Record<string, string> = {};
    for (const k of [...RATES, ...MARGINS].map((x) => x.key)) f[k] = String((data as any)[k] ?? "");
    f.subscription_price_cents = String((data as any).subscription_price_cents ?? 0);
    f.subscription_included_cents = String((data as any).subscription_included_cents ?? 0);
    f.currency = String((data as any).currency ?? "EUR");
    f.vat_pct = String((data as any).vat_pct ?? 21);
    setForm(f);
  }, [data]);

  const save = useMutation({
    mutationFn: (payload: Record<string, unknown>) => upd({ data: payload } as any),
    onSuccess: () => { toast.success("Guardado"); qc.invalidateQueries({ queryKey: ["pricing-config"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-muted-foreground">Cargando…</div>;

  const submit = () => {
    const payload: Record<string, unknown> = {};
    for (const f of [...RATES, ...MARGINS]) payload[f.key] = Number(form[f.key]);
    payload.subscription_price_cents = Math.round(Number(form.subscription_price_cents));
    payload.subscription_included_cents = Math.round(Number(form.subscription_included_cents));
    payload.currency = form.currency || "EUR";
    payload.vat_pct = Number(form.vat_pct);
    save.mutate(payload);
  };

  const bind = (k: string) => ({
    value: form[k] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm((s) => ({ ...s, [k]: e.target.value })),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <Card>
        <CardHeader><CardTitle>Tarifas de proveedores (coste bruto)</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {RATES.map((f) => (
            <div key={f.key}>
              <Label>{f.label}</Label>
              <Input type="number" step="0.0001" {...bind(f.key)} />
              {f.hint && <p className="text-xs text-muted-foreground mt-1">{f.hint}</p>}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Márgenes de la plataforma</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {MARGINS.map((f) => (
            <div key={f.key}>
              <Label>{f.label}</Label>
              <Input type="number" step="0.1" {...bind(f.key)} />
              {f.hint && <p className="text-xs text-muted-foreground mt-1">{f.hint}</p>}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Suscripción</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div>
            <Label>Precio suscripción (cents / mes)</Label>
            <Input type="number" step="1" {...bind("subscription_price_cents")} />
          </div>
          <div>
            <Label>Consumo incluido (cents / mes)</Label>
            <Input type="number" step="1" {...bind("subscription_included_cents")} />
          </div>
          <div>
            <Label>Moneda</Label>
            <Input {...bind("currency")} maxLength={3} />
          </div>
          <div>
            <Label>IVA (%)</Label>
            <Input type="number" step="0.01" {...bind("vat_pct")} />
            <p className="text-xs text-muted-foreground mt-1">Aplicado en los recibos PDF</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={submit} disabled={save.isPending}>Guardar cambios</Button>
      </div>
    </div>
  );
}
