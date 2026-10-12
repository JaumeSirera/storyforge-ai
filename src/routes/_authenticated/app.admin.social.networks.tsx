import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { getSocialSettings, listSocialStories, saveSocialSettings, updateSocialStory } from "@/lib/social.functions";
import { SOCIAL_NETWORKS, type SocialNetworkId } from "@/lib/social-shared";

export const Route = createFileRoute("/_authenticated/app/admin/social/networks")({
  component: NetworksPage,
});

function NetworksPage() {
  const qc = useQueryClient();
  const getSettings = useServerFn(getSocialSettings);
  const saveSettings = useServerFn(saveSocialSettings);
  const list = useServerFn(listSocialStories);
  const update = useServerFn(updateSocialStory);

  const settings = useQuery({ queryKey: ["social-settings"], queryFn: () => getSettings(), retry: 1 });
  const stories = useQuery({ queryKey: ["social-stories"], queryFn: () => list(), retry: 1 });
  const [key, setKey] = useState("");

  const saveKey = useMutation({
    mutationFn: (k: string) => saveSettings({ data: { ayrshareKey: k } }),
    onSuccess: (r) => {
      setKey("");
      qc.setQueryData(["social-settings"], r);
      toast.success(r.has_ayrshare ? "Clave de Ayrshare guardada" : "Clave de Ayrshare eliminada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setNets = useMutation({
    mutationFn: (v: { id: string; networks: SocialNetworkId[] }) => update({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["social-stories"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" /> Conexión con Ayrshare</h3>
        <p className="text-sm text-muted-foreground">
          Ayrshare publica en todas tus redes con una sola clave. Enlaza tus cuentas (Instagram, LinkedIn, Facebook…) en tu panel de Ayrshare y pega aquí la API Key. Se guarda en tu servidor y no se muestra nunca en el navegador.
        </p>
        {settings.data?.has_ayrshare && (
          <p className="inline-flex items-center gap-1.5 text-sm text-primary"><CheckCircle2 className="h-4 w-4" /> Ayrshare conectado</p>
        )}
        {settings.error && <p className="text-sm text-destructive">{(settings.error as Error).message}</p>}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder={settings.data?.has_ayrshare ? "Pega una clave nueva para sustituirla" : "API Key de Ayrshare"} />
          <Button disabled={!key.trim() || saveKey.isPending} onClick={() => saveKey.mutate(key.trim())}>Guardar</Button>
          {settings.data?.has_ayrshare && <Button variant="outline" onClick={() => { if (confirm("¿Quitar la clave de Ayrshare?")) saveKey.mutate(""); }}>Quitar</Button>}
        </div>
        <a href="https://app.ayrshare.com/api-key" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
          Obtener la clave en Ayrshare <ExternalLink className="h-3 w-3" />
        </a>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold">Redes activas por serie</h3>
        {stories.data?.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay series.</p>}
        {stories.data?.map((s) => (
          <div key={s.id} className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 font-medium">{s.title}</div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {SOCIAL_NETWORKS.map((n) => {
                const on = s.networks.includes(n.id);
                return (
                  <label key={n.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                    <span>{n.name}</span>
                    <Switch checked={on} onCheckedChange={(v) => setNets.mutate({ id: s.id, networks: v ? [...s.networks, n.id] : s.networks.filter((x) => x !== n.id) })} aria-label={`${n.name} en ${s.title}`} />
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
